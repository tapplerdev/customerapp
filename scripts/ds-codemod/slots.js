/**
 * Rule 5: a `*className` prop on one of our components becomes that
 * component's style slot, but only once the component declares the slot.
 *
 * The slot for `className` is `style`; for `fooClassName` or `classNameFoo`
 * it is `fooStyle` (`textClassName` -> `textStyle`, `classNameTitle` ->
 * `titleStyle`). "Declares" means the component's own props type names it
 * (an interface, type alias, intersection, Omit/Pick of one, followed
 * through imports); a `style` that only arrives through `extends ViewProps`
 * doesn't count, because nothing says where it lands.
 *
 * If the component still reads the className prop, the slot must land on
 * the same element (that element's `style` reads the slot): DmInput declares
 * `style`, but it goes to the TextInput while `className` styles the box
 * around it, so its className call sites must wait. A component that no
 * longer reads the className prop at all is trusted to have moved it.
 */
const path = require("path")
const traverse = require("@babel/traverse").default

const { TWIN_RENAMES, twinsOf } = require("./twins")
const { textSlotModel } = require("./typetwin")
const {
  ROOT,
  SHARED,
  findExport,
  parseFile,
  resolveSource,
  topLevel,
} = require("./modules")

const slotName = (attr) => {
  if (attr === "className") return "style"
  if (attr.endsWith("ClassName"))
    return `${attr.slice(0, -"ClassName".length)}Style`
  if (attr.startsWith("className")) {
    const rest = attr.slice("className".length)
    return `${rest[0].toLowerCase()}${rest.slice(1)}Style`
  }
  return null
}

const typeName = (node) =>
  node.type === "Identifier"
    ? node.name
    : node.type === "TSQualifiedName"
      ? `${typeName(node.left)}.${node.right.name}`
      : null

const FC = new Set([
  "FC",
  "React.FC",
  "FunctionComponent",
  "React.FunctionComponent",
  "VFC",
  "React.VFC",
])

const literalKeys = (node) => {
  if (!node) return []
  if (node.type === "TSLiteralType" && node.literal.type === "StringLiteral")
    return [node.literal.value]
  if (node.type === "TSUnionType") return node.types.flatMap(literalKeys)
  return null
}

/**
 * Members of a type: { own: Map(name -> typeText), external: [names] }, and
 * `keys`, every member's name (methods too), with `open` when the type takes
 * keys no name says (an index signature, a computed key). `file` is where
 * `node` sits.
 */
const membersOf = (node, file, depth = 0) => {
  const out = {
    own: new Map(),
    docs: new Map(),
    origin: new Map(),
    keys: new Set(),
    open: false,
    external: [],
  }
  if (!node || depth > 10) return out
  const merge = (m) => {
    for (const [k, v] of m.own) out.own.set(k, v)
    for (const [k, v] of m.docs || []) out.docs.set(k, v)
    for (const [k, v] of m.origin || []) out.origin.set(k, v)
    for (const k of m.keys || m.own.keys()) out.keys.add(k)
    if (m.open) out.open = true
    out.external.push(...m.external)
  }
  const { code } = parseFile(file)
  const keyOf = (m) =>
    m.computed
      ? null
      : m.key.type === "Identifier"
        ? m.key.name
        : typeof m.key.value === "string"
          ? m.key.value
          : null
  const addMembers = (members) => {
    for (const m of members) {
      const key =
        m.type === "TSPropertySignature" || m.type === "TSMethodSignature"
          ? keyOf(m)
          : null
      if (key === null) {
        out.open = true
        continue
      }
      out.keys.add(key)
      if (m.type === "TSPropertySignature") {
        const t = m.typeAnnotation
          ? code.slice(
              m.typeAnnotation.typeAnnotation.start,
              m.typeAnnotation.typeAnnotation.end
            )
          : ""
        out.own.set(key, t)
        out.origin.set(key, file)
        const doc = (m.leadingComments || []).map((c) => c.value).join("\n")
        if (doc) out.docs.set(key, doc)
      }
    }
  }
  switch (node.type) {
    case "TSTypeLiteral":
      addMembers(node.members)
      return out
    case "TSInterfaceDeclaration":
      addMembers(node.body.body)
      for (const h of node.extends || [])
        merge(namedType(typeName(h.expression), h.typeParameters, file, depth))
      return out
    case "TSTypeAliasDeclaration":
      return membersOf(node.typeAnnotation, file, depth + 1)
    case "TSIntersectionType":
      node.types.forEach((t) => merge(membersOf(t, file, depth + 1)))
      return out
    case "TSParenthesizedType":
      return membersOf(node.typeAnnotation, file, depth + 1)
    case "TSTypeReference":
      return namedType(
        typeName(node.typeName),
        node.typeParameters,
        file,
        depth
      )
    default:
      return out
  }
}

const namedType = (name, typeParameters, file, depth) => {
  const params = typeParameters ? typeParameters.params : []
  if (["Omit", "Pick"].includes(name) && params.length === 2) {
    const inner = membersOf(params[0], file, depth + 1)
    const keys = literalKeys(params[1])
    if (!keys)
      return {
        own: new Map(),
        docs: new Map(),
        origin: new Map(),
        external: [`${name}<...>`],
      }
    const keep = ([k]) =>
      name === "Omit" ? !keys.includes(k) : keys.includes(k)
    return {
      own: new Map([...inner.own].filter(keep)),
      external: inner.external,
      docs: new Map([...inner.docs].filter(keep)),
      origin: new Map([...inner.origin].filter(keep)),
      // Pick names its keys; Omit keeps whatever the inner type leaves open
      keys:
        name === "Pick"
          ? new Set(keys)
          : new Set([...inner.keys].filter((k) => !keys.includes(k))),
      open: name === "Omit" && inner.open,
    }
  }
  if (["Partial", "Required", "Readonly"].includes(name) && params.length === 1)
    return membersOf(params[0], file, depth + 1)
  // React.ComponentProps<typeof X>: X's own props type (proapp's MainModal
  // wraps shared's this way).
  if (
    [
      "ComponentProps",
      "React.ComponentProps",
      "ComponentPropsWithoutRef",
      "React.ComponentPropsWithoutRef",
    ].includes(name) &&
    params.length === 1 &&
    params[0].type === "TSTypeQuery" &&
    params[0].exprName.type === "Identifier"
  ) {
    const def = componentDef(file, params[0].exprName.name)
    if (!def) return empty([name])
    const { propsType } = componentShape(def)
    return propsType ? membersOf(propsType, def.file, depth + 1) : empty([name])
  }
  if (!name || name.includes("."))
    return {
      own: new Map(),
      docs: new Map(),
      origin: new Map(),
      external: [name || "?"],
    }
  const { ast } = parseFile(file)
  const found = topLevel(ast, name)
  if (!found)
    return {
      own: new Map(),
      docs: new Map(),
      origin: new Map(),
      external: [name],
    }
  if (found.kind === "decl") return membersOf(found.node, file, depth + 1)
  const target = resolveSource(file, found.source)
  if (target.kind !== "file") return empty([`${found.source}:${name}`])
  const def = findExport(target.file, found.imported)
  if (!def || !def.node)
    return {
      own: new Map(),
      docs: new Map(),
      origin: new Map(),
      external: [name],
    }
  return membersOf(def.node, def.file, depth + 1)
}

const empty = (external = []) => ({
  own: new Map(),
  docs: new Map(),
  origin: new Map(),
  external,
})

/** The declaration a name in `file` refers to, through its import. */
const componentDef = (file, name) => {
  const { ast } = parseFile(file)
  const found = topLevel(ast, name)
  if (!found) return null
  if (found.kind === "decl") return { file, node: found.node, name }
  const target = resolveSource(file, found.source)
  if (target.kind !== "file") return null
  const def = findExport(target.file, found.imported)
  return def && def.node ? def : null
}

/** The function and props type of a component declaration. */
const componentShape = (def) => {
  let node = def.node
  let propsType = null
  let fn = null
  const fromFn = (f) => {
    fn = f
    const p = f.params && f.params[0]
    if (p && p.typeAnnotation && !propsType)
      propsType = p.typeAnnotation.typeAnnotation
  }
  if (node.type === "VariableDeclarator") {
    const ann = node.id.typeAnnotation && node.id.typeAnnotation.typeAnnotation
    if (
      ann &&
      ann.type === "TSTypeReference" &&
      FC.has(typeName(ann.typeName)) &&
      ann.typeParameters
    )
      propsType = ann.typeParameters.params[0]
    node = node.init
  }
  if (!node) return { fn, propsType }
  if (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression" ||
    node.type === "FunctionDeclaration"
  )
    fromFn(node)
  else if (node.type === "CallExpression") {
    // memo(...), forwardRef<Ref, Props>(...)
    if (
      node.typeParameters &&
      node.typeParameters.params.length === 2 &&
      !propsType
    )
      propsType = node.typeParameters.params[1]
    const f = node.arguments.find(
      (a) =>
        a.type === "ArrowFunctionExpression" || a.type === "FunctionExpression"
    )
    if (f) fromFn(f)
    const inner = node.arguments.find((a) => a.type === "CallExpression")
    if (!f && inner) {
      const nested = componentShape({ ...def, node: inner })
      fn = nested.fn
      propsType = propsType || nested.propsType
    }
  }
  return { fn, propsType }
}

/**
 * Whether a component plainly reads no `style`: its props are destructured
 * with no `style` key and no rest. NativeWind hands a component it wraps a
 * style instead of className, so for one like that the classes draw nothing
 * (customerapp's SkeletonLoader, PromoLine, OrderBill and the question
 * buttons, imported by file path). Anything less plain (a props object, a
 * rest) may pass style on: false.
 */
const ignoresStyle = (def) => {
  const { fn } = componentShape(def)
  const param = fn && fn.params[0]
  if (!param || param.type !== "ObjectPattern") return false
  return param.properties.every(
    (p) =>
      p.type === "ObjectProperty" &&
      !p.computed &&
      (p.key.type === "Identifier" ? p.key.name : p.key.value) !== "style"
  )
}

// How a component uses one of its props, reference by reference:
//   class-part   a plain part of a className (the whole value, a clsx
//                argument, a template expression)
//   style-whole  the whole value of a `style`
//   style-first  the first entry of a `style` array (right after the class
//                styles NativeWind puts first, before any inline style)
//   other        anything else (a default with ||, a .match(), a spread into
//                an object, a later array entry, another prop)
const usesOf = (def, fn, prop) => {
  const { ast } = parseFile(def.file)
  const uses = []
  if (!fn) return uses
  const param = fn.params[0]
  let local = null
  let propsName = null
  if (param && param.type === "ObjectPattern") {
    for (const p of param.properties)
      if (p.type === "ObjectProperty" && !p.computed) {
        const key = p.key.type === "Identifier" ? p.key.name : p.key.value
        if (key === prop) {
          const v =
            p.value.type === "AssignmentPattern" ? p.value.left : p.value
          if (v.type === "Identifier") local = v.name
        }
      }
  } else if (param && param.type === "Identifier") propsName = param.name
  const classify = (ref) => {
    const attr = ref.findParent((x) => x.isJSXAttribute())
    const name = attr && attr.node.name.name
    const container = attr && attr.get("value")
    const root =
      container && container.isJSXExpressionContainer()
        ? container.get("expression")
        : null
    const element = attr ? attr.parentPath.node : null
    if (!root) return { kind: "other", element, attr: name }
    if (name === "className") {
      let x = ref
      while (x.node !== root.node) {
        const parent = x.parentPath
        const ok =
          (parent.isCallExpression() &&
            parent.node.arguments.includes(x.node) &&
            parent.get("callee").isIdentifier()) ||
          (parent.isArrayExpression() &&
            parent.parentPath.isCallExpression()) ||
          (parent.isTemplateLiteral() &&
            parent.node.expressions.includes(x.node))
        if (!ok)
          return {
            kind: "other",
            element,
            attr: name,
            why: `${prop} is read in a ${parent.node.type} inside className`,
          }
        x = parent
      }
      return { kind: "class-part", element, attr: name }
    }
    if (name === "style") {
      if (ref.node === root.node)
        return { kind: "style-whole", element, attr: name }
      if (root.isArrayExpression() && root.node.elements[0] === ref.node)
        return { kind: "style-first", element, attr: name }
      return {
        kind: "other",
        element,
        attr: name,
        why: `${prop} isn't the first style on its element`,
      }
    }
    return {
      kind: "other",
      element,
      attr: name,
      why: `${prop} is passed on as \`${name || "something else"}\``,
    }
  }
  traverse(ast, {
    Function(fp) {
      if (fp.node !== fn) return
      fp.traverse({
        Identifier(p) {
          if (
            local &&
            p.node.name === local &&
            p.isReferencedIdentifier() &&
            p.scope.getBinding(local) &&
            p.scope.getBinding(local).path.findParent((x) => x.node === fn)
          )
            uses.push(classify(p))
        },
        MemberExpression(p) {
          if (
            propsName &&
            p.get("object").isIdentifier({ name: propsName }) &&
            !p.node.computed &&
            p.node.property.name === prop
          )
            uses.push(classify(p))
        },
      })
      fp.stop()
    },
  })
  return uses
}

// The local a component destructures a prop into, if it does.
const localOf = (fn, prop) => {
  const param = fn && fn.params[0]
  if (!param || param.type !== "ObjectPattern") return null
  for (const p of param.properties)
    if (p.type === "ObjectProperty" && !p.computed) {
      const key = p.key.type === "Identifier" ? p.key.name : p.key.value
      if (key !== prop) continue
      const v = p.value.type === "AssignmentPattern" ? p.value.left : p.value
      return v.type === "Identifier" ? v.name : null
    }
  return null
}

const SHARED_COMPONENTS = path.join(SHARED, "src", "components") + path.sep

const LANDING_TAGS =
  /^(DmView|DmText|View|Text|Animated\.\w+|SafeAreaView|ScrollView|Image|TextInput|TouchableOpacity|Pressable)$/

const tagOf = (element) => {
  const n = element.name
  if (n.type === "JSXIdentifier") return n.name
  if (n.type === "JSXMemberExpression" && n.object.type === "JSXIdentifier")
    return `${n.object.name}.${n.property.name}`
  return "?"
}

const cache = new Map()

/**
 * What a component offers for a call-site attribute: { ok: true, slot,
 * text } or { ok: false, code, detail }.
 */
const slotFor = (def, attr) => {
  const key = `${def.file}#${def.name}#${attr}`
  if (cache.has(key)) return cache.get(key)
  const result = computeSlot(def, attr)
  cache.set(key, result)
  return result
}

/**
 * Slots whose contract the codemod can't read off the code, taken from the
 * component's own notes (build-p2b.md) and pinned by the parity tests that
 * shipped with them. `unless`: props that, set at the call site, would come
 * before the slot and so change what wins.
 */
// By file under the app root, then class prop. proapp's one entry was its
// HeaderOnboarding (style lands on the root through rootStyle, after
// bordered and gutter); customerapp has none yet.
const KNOWN = {}

/**
 * A slot a component declares in its props' docs: `@dsSlot classNameTitle`
 * on titleStyle, optionally `@dsSlot className unless bordered gutter`.
 * For a component whose slot isn't plainly `style={slot}` where the class
 * name lands (the structural check below), its author states the contract
 * and proves it with a parity test.
 */
const tagged = (members, attr) => {
  for (const [name, doc] of members.docs) {
    const m = doc.match(
      new RegExp(`@dsSlot\\s+${attr}\\b(?:\\s+unless\\s+([\\w ,]+))?`)
    )
    if (m)
      return {
        slot: name,
        unless: m[1] ? m[1].split(/[\s,]+/).filter(Boolean) : [],
      }
  }
  return null
}

/**
 * Typed props a component gives for what it reads out of a className
 * (SettingsItem's `className?.includes("border-0")`), stated in the prop's
 * docs:
 *   @dsFromClass <classAttr> <token> <value>
 * A call site whose <classAttr> holds the whole class <token> sets the prop
 * to <value> (true, false, a number or a "string"). The token's own style
 * still moves with the rest of the classes: the prop stands for the parse.
 * The component's parity test is what proves the two say the same.
 */
const fromClassRules = (members, attr) => {
  const rules = []
  for (const [prop, doc] of members.docs)
    for (const m of doc.matchAll(/@dsFromClass\s+(\S+)\s+(\S+)\s+(\S+)/g)) {
      if (m[1] !== attr) continue
      let literal
      try {
        literal = JSON.parse(m[3])
      } catch {
        return {
          error: `\`${prop}\`'s @dsFromClass value ${m[3]} isn't true, false, a number or a "string"`,
        }
      }
      rules.push({ prop, token: m[2], literal })
    }
  return { rules }
}

// A tag bound to one of tappler-shared's className slots (classNameSlots.ts):
// "view" for classNameSlot(Host), "text" for ClassNameText. It draws the
// component's base, the caller's classes, then the style it's given.
const slotTag = (def, element) => {
  const name = tagOf(element)
  const { ast } = parseFile(def.file)
  const found = topLevel(ast, name)
  if (!found || found.kind !== "decl" || !found.node.init) return null
  const init = found.node.init
  const fromSlots = (local, wanted) => {
    const imp = topLevel(ast, local)
    return (
      imp &&
      imp.kind === "import" &&
      /(^|\/)classNameSlots$/.test(imp.source) &&
      wanted.includes(imp.imported)
    )
  }
  if (
    init.type === "CallExpression" &&
    init.callee.type === "Identifier" &&
    fromSlots(init.callee.name, ["classNameSlot", "lazyClassNameSlot"])
  )
    return "view"
  if (init.type === "Identifier" && fromSlots(init.name, ["ClassNameText"]))
    return "text"
  return null
}

/**
 * S8: ClassNameText takes a caller's class string twice, as `className`
 * (NativeWind resolves it and takes it off) and as `fontClassName` (what
 * DmText's font layer read: the face, the Arabic leading). An element that
 * gives it only the first draws a caller's font-customNNN and Arabic
 * leading-[Npx] as nothing, at every call site still passing classes. The
 * reason, or null.
 */
const fontLayerGap = (def, fn, attr) => {
  const local = localOf(fn, attr)
  if (!local) return null
  const isLocal = (v) =>
    v &&
    v.type === "JSXExpressionContainer" &&
    v.expression.type === "Identifier" &&
    v.expression.name === local
  const elements = new Set(
    usesOf(def, fn, attr)
      .filter((u) => u.attr === "className")
      .map((u) => u.element)
  )
  for (const e of elements) {
    if (slotTag(def, e) !== "text") continue
    const font = e.attributes.find(
      (a) => a.type === "JSXAttribute" && a.name.name === "fontClassName"
    )
    if (!font || !isLocal(font.value))
      return `<${tagOf(e)}> (ClassNameText) takes \`${attr}\` as className but not as fontClassName, so a caller's font and Arabic leading classes draw nothing`
  }
  return null
}

// Every prop the component can get is named: the props type has no key it
// can't read (an import from a package, an index signature), and the
// component takes them as `({ a, b })`, with no `...rest` to pass others on.
const closedProps = (members, fn) => {
  if (!members.keys || members.open || members.external.length) return false
  if (!fn) return false
  // (a forwardRef's second parameter is the ref)
  let param = fn.params[0]
  if (!param) return true
  if (param.type === "AssignmentPattern") param = param.left
  return (
    param.type === "ObjectPattern" &&
    !param.properties.some((p) => p.type === "RestElement")
  )
}

const computeSlot = (def, attr) => {
  const slot = slotName(attr)
  if (!slot)
    return {
      ok: false,
      code: "waiting-on-component",
      detail: `no slot name for \`${attr}\``,
    }
  const relFile = path.relative(ROOT, def.file)
  const known = KNOWN[relFile] && KNOWN[relFile][attr]
  if (known)
    return {
      ok: true,
      slot: known.slot,
      text: false,
      unless: known.unless || [],
    }
  const { fn, propsType } = componentShape(def)
  if (!propsType)
    return {
      ok: false,
      code: "waiting-on-component",
      detail: `${def.name} has no props type the codemod can read`,
    }
  const members = membersOf(propsType, def.file)
  const fromClass = fromClassRules(members, attr)
  if (fromClass.error)
    return {
      ok: false,
      code: "waiting-on-component",
      detail: `${def.name}: ${fromClass.error}`,
    }
  // A prop the component takes and then drops (proapp's MainModal draws its
  // own buttons and drops every button class) is dead either way: leave it.
  const local = localOf(fn, attr)
  if (local && usesOf(def, fn, attr).length === 0)
    return {
      ok: false,
      code: "discarded-by-component",
      detail: `${def.name} takes \`${attr}\` and draws nothing with it: delete it by hand (pass 2)`,
    }
  // A class attribute that isn't a prop at all: the props type names every
  // key it takes and the component destructures them with no rest, so the
  // attribute reaches nothing (a type error at a .tsx site).
  if (!local && closedProps(members, fn) && !members.keys.has(attr))
    return {
      ok: false,
      code: "not-a-prop",
      detail: `\`${attr}\` isn't a ${def.name} prop, so it draws nothing: delete it`,
    }
  // tappler-shared's converted components: the twins declared after it.
  const origin = members.origin && members.origin.get(attr)
  if (origin && origin.startsWith(SHARED_COMPONENTS)) {
    const component = path.basename(origin).replace(/\.[jt]sx?$/, "")
    const twin = twinsOf(members, attr, component)
    // the element the shared component draws the class on (S8)
    const shared = findExport(origin, "default")
    const sharedFn = shared && shared.node && componentShape(shared).fn
    const gap = sharedFn && fontLayerGap(shared, sharedFn, attr)
    if (twin && gap)
      return { ok: false, code: "waiting-on-component", detail: gap }
    if (twin) {
      if (
        twin.style &&
        localOf(fn, twin.style) &&
        usesOf(def, fn, twin.style).length === 0
      )
        return {
          ok: false,
          code: "waiting-on-component",
          detail: `${def.name} drops \`${twin.style}\`, the twin of \`${attr}\``,
        }
      const text = /DsTextStyle/.test(twin.styleType)
      return {
        ok: true,
        slot: twin.style,
        styleType: twin.styleType,
        text,
        // the text the *Type emulation reads (typetwin.js)
        textModel:
          text && twin.type && sharedFn
            ? textSlotModel(shared, sharedFn, attr, twin.type, twin.style)
            : null,
        field:
          /\bTextStyle\b/.test(twin.styleType) &&
          !/DsTextStyle/.test(twin.styleType),
        typeTwin: twin.type,
        parsed: [...twin.parsed, ...fromClass.rules],
        unless: [],
      }
    }
  }
  const tag = tagged(members, attr)
  if (tag) {
    const typeText = members.own.get(tag.slot) || ""
    const twin = twinsOf(members, attr, def.name)
    return {
      ok: true,
      slot: tag.slot,
      styleType: typeText,
      text: /TextStyle/.test(typeText),
      typeTwin: twin && twin.type,
      textModel:
        twin && twin.type && /DsTextStyle/.test(typeText)
          ? textSlotModel(def, fn, attr, twin.type, tag.slot)
          : null,
      parsed: fromClass.rules,
      unless: tag.unless,
    }
  }
  if (!members.own.has(slot))
    return {
      ok: false,
      code: "waiting-on-component",
      detail: `${def.name} doesn't declare \`${slot}\``,
    }
  const typeText = members.own.get(slot)
  const wait = (detail) => ({
    ok: false,
    code: "waiting-on-component",
    detail: `${def.name}: ${detail}`,
  })
  if (!/StyleProp</.test(typeText))
    return wait(
      `\`${slot}\` is typed ${typeText || "?"}, which takes no style array`
    )
  // ClassNameText takes the class string twice: as className (NativeWind
  // resolves it) and as fontClassName (DmText's font layer reads it).
  const classUses = usesOf(def, fn, attr).filter(
    (u) =>
      !(
        u.attr === "fontClassName" &&
        slotTag(def, u.element) === "text" &&
        u.element.attributes.some(
          (a) =>
            a.type === "JSXAttribute" &&
            a.name.name === "className" &&
            a.value &&
            a.value.type === "JSXExpressionContainer" &&
            a.value.expression.type === "Identifier" &&
            a.value.expression.name === localOf(fn, attr)
        )
      )
  )
  // ClassNameText takes the caller's style twin as twinStyle, drawn after
  // the classes (its `style` is for the classes NativeWind resolves).
  const slotUses = usesOf(def, fn, slot).map((u) =>
    u.attr === "twinStyle" &&
    u.kind === "other" &&
    slotTag(def, u.element) === "text"
      ? { ...u, kind: "style-whole" }
      : u
  )
  const gap = fontLayerGap(def, fn, attr)
  if (gap) return wait(gap)
  const odd = [
    ...classUses.filter((u) => u.kind !== "class-part"),
    ...slotUses.filter(
      (u) => u.kind !== "style-whole" && u.kind !== "style-first"
    ),
  ]
  if (odd.length)
    return wait(
      odd[0].why ||
        `\`${attr}\` or \`${slot}\` is used in a way the codemod can't follow`
    )
  const classEls = new Set(classUses.map((u) => u.element))
  const slotEls = new Set(slotUses.map((u) => u.element))
  if (classUses.length) {
    const same =
      classEls.size === slotEls.size &&
      [...classEls].every((e) => slotEls.has(e))
    if (!same) return wait(`\`${slot}\` doesn't land where \`${attr}\` does`)
    const elsewhere = [...classEls].find(
      (e) => !LANDING_TAGS.test(tagOf(e)) && !slotTag(def, e)
    )
    if (elsewhere)
      return wait(
        `\`${attr}\` lands on <${tagOf(elsewhere)}>, a component: that one converts first`
      )
  } else if (slotUses.length === 0)
    return wait(`\`${slot}\` reaches no element`)
  const landsOnText = [...classEls, ...slotEls].some(
    (e) => /^(DmText|Text)$/.test(tagOf(e)) || slotTag(def, e) === "text"
  )
  const twin = twinsOf(members, attr, def.name)
  return {
    ok: true,
    slot,
    styleType: typeText,
    text: landsOnText || /TextStyle/.test(typeText),
    typeTwin: twin && twin.type,
    textModel:
      twin && twin.type && /DsTextStyle/.test(typeText)
        ? textSlotModel(def, fn, attr, twin.type, slot)
        : null,
    parsed: fromClass.rules,
    unless: [],
  }
}

/**
 * Twins a call site passes under a name the component has renamed
 * (TWIN_RENAMES): [{ from, to }] for the ones this component declares the
 * new name of, the site passes the old one and not the new.
 */
const twinRenames = (def, attrNames) => {
  const table = TWIN_RENAMES[def.name]
  if (!table) return []
  const { propsType } = componentShape(def)
  if (!propsType) return []
  const members = membersOf(propsType, def.file)
  return Object.entries(table)
    .filter(
      ([from, to]) =>
        attrNames.includes(from) &&
        !attrNames.includes(to) &&
        members.own.has(to)
    )
    .map(([from, to]) => ({ from, to }))
}

module.exports = {
  KNOWN,
  componentShape,
  ignoresStyle,
  membersOf,
  slotFor,
  slotName,
  slotTag,
  twinRenames,
}
