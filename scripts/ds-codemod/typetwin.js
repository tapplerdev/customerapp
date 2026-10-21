/**
 * *Type twins (W1.5 B2): the typography a caller's class puts on a
 * component's text, written as the text's type prop (`titleType`), the
 * rest as its style twin (`titleStyle`).
 *
 * A text slot is read from the component's own source: the element its
 * class prop lands on is a module const bound to tappler-shared's
 * ClassNameText, given the class as className and fontClassName, its own
 * type (`{...TITLE}`, literal props, a local merged from them) and the
 * caller's type as twinType. A small evaluator works the element's props out
 * twice: with the class given and no type (today), and with the type given
 * and no class (converted). What each draws comes from the way ClassNameText
 * and ds Text draw a text, through the real textStyle, legacyFontLayer and
 * withType loaded from tappler-shared. A site converts only if the two agree
 * for every combination of its conditions, in both languages.
 */
const path = require("path")
const traverse = require("@babel/traverse").default

const { NwResolveError, resolve } = require("../nw-resolve")
const { assignments, atomsOf, evaluate } = require("./classexpr")
const { synthesize } = require("./dmtext")
const { SHARED_SRC, load, loadDs } = require("./dsload")
const { parseFile, resolveSource } = require("./modules")
const { Unconvertible, styleFromIR } = require("./plain")
const { deepEqual, evalStyle, flatten } = require("./styles")

const TYPO_KEYS = ["fontSize", "lineHeight", "fontFamily", "fontWeight"]
const WEIGHTS = ["regular", "medium", "semibold", "bold"]
const FAMILIES = ["auto", "latin", "arabic", "system"]
const STEPS = ["tight", "normal", "loose"]
const ALIGN = { start: "left", center: "center", end: "right" }
const ALIGN_OF = { left: "start", center: "center", right: "end" }
const AR = 1.32

// Something the evaluator can't work out statically.
class Opaque extends Error {}

const SLOTS_MODULE = path.join(SHARED_SRC, "components", "classNameSlots.ts")
const HELPERS_MODULE = path.join(SHARED_SRC, "helpers", "helpers.ts")
let slots
const slotsModule = () => {
  if (!slots) {
    loadDs()
    slots = load(SLOTS_MODULE)
  }
  return slots
}
const helpersModule = () => {
  slotsModule()
  return load(HELPERS_MODULE)
}

// ---------------------------------------------------------------------------
// The slot element, read from the component's source

const pathsOf = new Map()
// { fnPath } for a component function node in its file, by traversal.
const fnPathOf = (file, fn) => {
  const key = `${file}#${fn.start}`
  if (pathsOf.has(key)) return pathsOf.get(key)
  const { ast } = parseFile(file)
  let found = null
  traverse(ast, {
    Function(p) {
      if (p.node === fn) {
        found = p
        p.stop()
      }
    },
  })
  pathsOf.set(key, found)
  return found
}

const isClassNameTextTag = (elementPath, file) => {
  const n = elementPath.node.name
  if (n.type !== "JSXIdentifier") return false
  const b = elementPath.scope.getBinding(n.name)
  if (!b || !b.path.isVariableDeclarator()) return false
  const init = b.path.node.init
  if (!init || init.type !== "Identifier") return false
  const ib = b.path.scope.getBinding(init.name)
  if (!ib || !ib.path.isImportSpecifier()) return false
  const imported = ib.path.node.imported.name || ib.path.node.imported.value
  const source = ib.path.parent.source.value
  if (imported !== "ClassNameText") return false
  const target = resolveSource(file, source)
  return (
    target.kind === "file" &&
    path.resolve(target.file) === path.resolve(SLOTS_MODULE)
  )
}

/**
 * The model of the text a component draws a class prop on: { file, fnPath,
 * element (path), classLocal, typeLocal, styleLocal, propsName } or
 * { error }.
 */
const textSlotModel = (def, fn, attr, typeProp, styleProp) => {
  if (!fn) return { error: `${def.name}'s function isn't readable` }
  const fnPath = fnPathOf(def.file, fn)
  if (!fnPath) return { error: `${def.name}'s function isn't readable` }
  const param = fn.params[0]
  const localFor = (prop) => {
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
  const classLocal = localFor(attr)
  if (!classLocal)
    return { error: `${def.name} doesn't destructure \`${attr}\`` }
  const elements = []
  fnPath.traverse({
    JSXOpeningElement(p) {
      const cls = p.node.attributes.find(
        (a) =>
          a.type === "JSXAttribute" &&
          a.name.name === "className" &&
          a.value &&
          a.value.type === "JSXExpressionContainer" &&
          a.value.expression.type === "Identifier" &&
          a.value.expression.name === classLocal
      )
      if (cls) elements.push(p)
    },
  })
  if (elements.length !== 1)
    return {
      error: `\`${attr}\` lands on ${elements.length} elements in ${def.name}`,
    }
  const [element] = elements
  if (!isClassNameTextTag(element, def.file))
    return { error: `\`${attr}\` doesn't land on a ClassNameText slot` }
  return {
    file: def.file,
    name: def.name,
    fnPath,
    element,
    param,
    classLocal,
    typeProp,
    styleProp,
    attr,
  }
}

// ---------------------------------------------------------------------------
// The evaluator

const STYLE_TWIN = Object.freeze({ __styleTwin: true })
const STRING_METHODS = new Set([
  "match",
  "includes",
  "replace",
  "trim",
  "split",
  "startsWith",
  "endsWith",
])

/**
 * A scenario: `prop(key)` gives a component prop's value (the class, the
 * type, the style twin's marker, or a call site's literal).
 */
const makeEval = (model, scenario) => {
  const { file } = model
  const propKey = (name) => {
    const param = model.param
    if (!param || param.type !== "ObjectPattern") return null
    for (const p of param.properties)
      if (p.type === "ObjectProperty" && !p.computed) {
        const v = p.value.type === "AssignmentPattern" ? p.value.left : p.value
        if (v.type === "Identifier" && v.name === name)
          return {
            key: p.key.type === "Identifier" ? p.key.name : p.key.value,
            fallback:
              p.value.type === "AssignmentPattern" ? p.value.right : null,
          }
      }
    return null
  }
  const imported = (p) => {
    const source = p.parent.source.value
    const target = resolveSource(file, source)
    if (target.kind !== "file") throw new Opaque(`an import of ${source}`)
    const mod = load(target.file)
    if (p.isImportNamespaceSpecifier()) return mod
    if (p.isImportDefaultSpecifier())
      return mod && mod.__esModule ? mod.default : mod
    return mod[p.node.imported.name || p.node.imported.value]
  }
  const ev = (p, depth = 0) => {
    if (!p || !p.node) return undefined
    if (depth > 60) throw new Opaque("too deep")
    const n = p.node
    const sub = (key) => ev(p.get(key), depth + 1)
    switch (n.type) {
      case "StringLiteral":
      case "NumericLiteral":
      case "BooleanLiteral":
        return n.value
      case "NullLiteral":
        return null
      case "RegExpLiteral":
        return new RegExp(n.pattern, n.flags)
      case "TemplateLiteral": {
        let out = ""
        n.quasis.forEach((q, i) => {
          out += q.value.cooked
          if (i < n.expressions.length)
            out += String(ev(p.get(`expressions.${i}`), depth + 1))
        })
        return out
      }
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
      case "TSTypeAssertion":
      case "ParenthesizedExpression":
        return sub("expression")
      case "Identifier":
        return evIdent(p, depth)
      case "ObjectExpression": {
        const out = {}
        for (const prop of p.get("properties")) {
          if (prop.isSpreadElement()) {
            const v = ev(prop.get("argument"), depth + 1)
            if (v != null) Object.assign(out, v)
          } else if (prop.isObjectProperty() && !prop.node.computed) {
            const k = prop.node.key
            const key = k.type === "Identifier" ? k.name : k.value
            out[key] = ev(prop.get("value"), depth + 1)
          } else throw new Opaque("a method or computed key")
        }
        return out
      }
      case "ArrayExpression":
        return p
          .get("elements")
          .flatMap((e) =>
            !e.node
              ? [undefined]
              : e.isSpreadElement()
                ? [...(ev(e.get("argument"), depth + 1) || [])]
                : [ev(e, depth + 1)]
          )
      case "MemberExpression":
      case "OptionalMemberExpression": {
        const o = sub("object")
        if (o == null) {
          if (n.optional) return undefined
          throw new Opaque("a member of nothing")
        }
        const k = n.computed ? sub("property") : n.property.name
        return o[k]
      }
      case "CallExpression":
      case "OptionalCallExpression": {
        const callee = p.get("callee")
        const args = p.get("arguments").map((a) => ev(a, depth + 1))
        if (
          callee.isMemberExpression() ||
          callee.isOptionalMemberExpression()
        ) {
          const obj = ev(callee.get("object"), depth + 1)
          if (obj == null) {
            if (callee.node.optional || n.optional) return undefined
            throw new Opaque("a call on nothing")
          }
          const name = callee.node.property.name
          if (typeof obj === "string" && STRING_METHODS.has(name))
            return obj[name](...args)
          if (typeof obj[name] === "function" && LOADED.has(obj))
            return obj[name](...args)
          throw new Opaque(`a call to ${name}`)
        }
        if (callee.isIdentifier() && /^use[A-Z]/.test(callee.node.name))
          throw new Opaque(`a hook (${callee.node.name})`)
        const f = ev(callee, depth + 1)
        if (typeof f === "function" && CALLABLE.has(f)) return f(...args)
        throw new Opaque("a call")
      }
      case "ConditionalExpression":
        return sub("test") ? sub("consequent") : sub("alternate")
      case "LogicalExpression": {
        const l = sub("left")
        if (n.operator === "&&") return l ? sub("right") : l
        if (n.operator === "||") return l ? l : sub("right")
        return l ?? sub("right")
      }
      case "UnaryExpression": {
        const v = sub("argument")
        if (n.operator === "!") return !v
        if (n.operator === "-") return -v
        if (n.operator === "void") return undefined
        throw new Opaque(`unary ${n.operator}`)
      }
      case "BinaryExpression": {
        const l = sub("left")
        const r = sub("right")
        switch (n.operator) {
          case "===":
            return l === r
          case "!==":
            return l !== r
          case "==":
            // eslint-disable-next-line eqeqeq
            return l == r
          case "!=":
            // eslint-disable-next-line eqeqeq
            return l != r
          default:
            throw new Opaque(`binary ${n.operator}`)
        }
      }
      default:
        throw new Opaque(n.type)
    }
  }
  const evIdent = (p, depth) => {
    const name = p.node.name
    if (name === "undefined") return undefined
    const b = p.scope.getBinding(name)
    if (!b) throw new Opaque(`the global ${name}`)
    if (b.kind === "param") {
      const k = propKey(name)
      if (!k) throw new Opaque(`the parameter ${name}`)
      const v = scenario.prop(k.key)
      if (v !== undefined || !k.fallback) return v
      // a default value, evaluated where it's written
      let fallback = null
      model.fnPath.get("params.0").traverse({
        AssignmentPattern(q) {
          if (q.node.right === k.fallback) fallback = q.get("right")
        },
      })
      return fallback ? ev(fallback, depth + 1) : undefined
    }
    if (b.path.isVariableDeclarator()) {
      if (!b.constant || b.path.node.id.type !== "Identifier")
        throw new Opaque(`${name} isn't a constant`)
      return ev(b.path.get("init"), depth + 1)
    }
    if (
      b.path.isImportSpecifier() ||
      b.path.isImportDefaultSpecifier() ||
      b.path.isImportNamespaceSpecifier()
    ) {
      const v = imported(b.path)
      if (v && (typeof v === "object" || typeof v === "function")) {
        LOADED.add(v)
        if (typeof v === "function") CALLABLE.add(v)
      }
      return v
    }
    throw new Opaque(`${name} (${b.path.node.type})`)
  }
  return ev
}

// Values from our own loaded modules: their functions may be called (style
// helpers, px, withType), and their objects' methods.
const LOADED = new WeakSet()
const CALLABLE = new WeakSet()

const DRAWN = new Set([
  "size",
  "weight",
  "leading",
  "color",
  "align",
  "family",
  "base",
  "className",
  "fontClassName",
  "twinStyle",
  "twinType",
  "style",
  "legacyStyle",
])

/** The props the slot element gives ClassNameText in a scenario. */
const slotProps = (model, scenario) => {
  const ev = makeEval(model, scenario)
  const props = {}
  for (const a of model.element.get("attributes")) {
    if (a.isJSXSpreadAttribute()) {
      const v = ev(a.get("argument"))
      if (v != null) Object.assign(props, v)
      continue
    }
    const name = a.node.name.name
    if (!DRAWN.has(name)) continue
    const value = a.get("value")
    props[name] = !a.node.value
      ? true
      : value.isJSXExpressionContainer()
        ? ev(value.get("expression"))
        : a.node.value.value
  }
  return props
}

// ---------------------------------------------------------------------------
// What ClassNameText and ds Text draw

const flatStyle = (v, twin) => {
  if (v === STYLE_TWIN) return twin
  if (Array.isArray(v)) return v.map((x) => flatStyle(x, twin))
  return v
}

/**
 * The text's flattened style. `classString`: what NativeWind resolves on the
 * element (undefined when no class); `twin`: the caller's style twin.
 */
const drawText = (ds, lang, props, classString, twin) => {
  const {
    base,
    style,
    className,
    fontClassName,
    twinStyle,
    twinType,
    legacyStyle,
    ...own
  } = props
  const { legacyFontLayer, withType } = slotsModule()
  const merged = twinType ? withType(own, twinType) : own
  if (merged.size === undefined) throw new Opaque("a text with no size")
  // NativeWind resolved a class string: its styles first in `style`, the
  // className taken off; ClassNameText then draws DmText's font layer.
  const classStyle = classString ? resolveClass(classString) : undefined
  const resolved = !!classString && !!fontClassName
  const layer = resolved
    ? legacyFontLayer(lang, merged, fontClassName)
    : undefined
  if (resolved && twinType) throw new Opaque("a class and a type together")
  return flatten([
    ds.textStyle(
      lang,
      merged.size,
      merged.weight,
      merged.leading,
      merged.family
    ),
    { color: ds.color.text[merged.color || "primary"] },
    { textAlign: ALIGN[merged.align || "start"] },
    flatStyle(base, twin),
    classStyle,
    flatStyle(style, twin),
    flatStyle(twinStyle, twin),
    layer,
    flatStyle(legacyStyle, twin),
  ])
}

const resolveClass = (classString) => {
  try {
    return resolve(classString).style
  } catch (error) {
    if (error instanceof NwResolveError)
      throw new Unconvertible(
        "unresolvable-class",
        error.problems.map((p) => `${p.class}: ${p.reason}`).join("; ")
      )
    throw error
  }
}

// ---------------------------------------------------------------------------
// The type that draws what the class drew

const leadingCandidates = (ds, size, en, ar) => {
  const out = []
  if (ds.TEXT_SIZES.includes(size))
    for (const s of STEPS) if (s in ds.LEADING[size]) out.push(s)
  out.push("legacy")
  out.push(en.lineHeight)
  if (typeof ar.lineHeight === "number")
    out.push({ legacy: Math.round((ar.lineHeight / AR) * 1000) / 1000 })
  if (en.lineHeight === ar.lineHeight) out.push({ fixed: en.lineHeight })
  return out
}

const sameTypo = (got, want) =>
  got.fontSize === want.fontSize &&
  got.lineHeight === want.lineHeight &&
  got.fontFamily === want.fontFamily

/** size, weight, family, leading for what a text drew in en and ar, or null. */
const typographyOf = (ds, en, ar, prefer) => {
  const size = en.fontSize
  if (ar.fontSize !== size || typeof size !== "number" || size <= 0) return null
  const families = [...new Set([prefer.family || "auto", ...FAMILIES])]
  const weights = [...new Set([prefer.weight || "regular", ...WEIGHTS])]
  for (const leading of leadingCandidates(ds, size, en, ar))
    for (const family of families)
      for (const weight of family === "system" ? ["regular"] : weights) {
        const e = ds.textStyle("en", size, weight, leading, family)
        const a = ds.textStyle("ar", size, weight, leading, family)
        if (sameTypo(e, en) && sameTypo(a, ar))
          return { size, weight, family, leading }
      }
  return null
}

const colorToken = (ds, value) =>
  Object.keys(ds.color.text).find((k) => ds.color.text[k] === value) || null

const onScale = (ds, size) => ds.TEXT_SIZES.includes(size)

const printLeading = (l, uses) => {
  if (typeof l === "number") {
    uses.px = true
    return `px(${l})`
  }
  if (l && typeof l === "object" && "fixed" in l) {
    uses.px = true
    return `{ fixed: px(${l.fixed}) }`
  }
  if (l && typeof l === "object" && "legacy" in l) {
    uses.px = true
    return `{ legacy: px(${l.legacy}) }`
  }
  return JSON.stringify(l)
}

const TYPE_KEYS = ["size", "leading", "weight", "family", "color", "align"]

const printType = (ds, t, uses) => {
  const parts = []
  for (const k of TYPE_KEYS) {
    if (!(k in t)) continue
    const v = t[k]
    if (k === "size")
      parts.push(`size: ${onScale(ds, v) ? v : ((uses.px = true), `px(${v})`)}`)
    else if (k === "leading") parts.push(`leading: ${printLeading(v, uses)}`)
    else parts.push(`${k}: ${JSON.stringify(v)}`)
  }
  return `{ ${parts.join(", ")} }`
}

/**
 * The type twin and style twin for a class on a text slot, or Unconvertible.
 * `site(name)`: a call site prop's value ({ value } or { opaque: true }).
 */
const convertTextSlot = ({ ds, ir, table, registry, hint, model, site }) => {
  const atomIds = [...atomsOf(ir)]
  let envs
  try {
    envs = assignments(atomIds)
  } catch (error) {
    throw new Unconvertible("too-many-conditions", error.message)
  }
  const siteProp = (key) => {
    const v = site(key)
    if (v && v.opaque)
      throw new Opaque(`the call site's \`${key}\` isn't a literal`)
    return v ? v.value : undefined
  }
  const scenario = (cls, type) => ({
    prop: (key) =>
      key === model.attr
        ? cls
        : model.typeProp && key === model.typeProp
          ? type
          : model.styleProp && key === model.styleProp
            ? STYLE_TWIN
            : siteProp(key),
  })
  let combos
  try {
    // the component's own props with no class and no type: its defaults
    const D = slotProps(model, scenario(undefined, undefined))
    combos = envs.map((env) => {
      const str = evaluate(ir, env)
      const before = slotProps(model, scenario(str || undefined, undefined))
      const want = {
        en: drawText(ds, "en", before, str, undefined),
        ar: drawText(ds, "ar", before, str, undefined),
      }
      if ("fontWeight" in want.en)
        throw new Unconvertible(
          "fontWeight-class",
          "the text's classes set fontWeight, which Text leaves to the face"
        )
      const typo = typographyOf(ds, want.en, want.ar, D)
      if (!typo)
        throw new Unconvertible(
          "leading-not-expressible",
          `${want.en.fontSize}/${want.en.lineHeight} (en), ${want.ar.fontSize}/${want.ar.lineHeight} (ar), ${want.en.fontFamily || "system"} / ${want.ar.fontFamily || "system"}: no *Type draws it`
        )
      if (
        want.en.color !== want.ar.color ||
        want.en.textAlign !== want.ar.textAlign
      )
        throw new Unconvertible(
          "not-expressible",
          "colour or alignment differs by language"
        )
      return { env, str, D, want, typo }
    })
  } catch (error) {
    if (error instanceof Opaque)
      throw new Unconvertible(
        "waiting-on-component",
        `${model.name}'s text for \`${model.attr}\` isn't readable here: ${error.message}`
      )
    throw error
  }

  const colorAsProp = combos.every((c) => colorToken(ds, c.want.en.color))
  const alignAsProp = combos.every((c) => ALIGN_OF[c.want.en.textAlign])
  const exclude = new Set(TYPO_KEYS)
  if (colorAsProp) exclude.add("color")
  if (alignAsProp) exclude.add("textAlign")
  const style = styleFromIR(ir, {
    table,
    registry,
    hint,
    exclude,
    fontIsDead: false,
  })

  // Each combination's type: what differs from the text's own, a size with
  // its leading (SizeBringsLeading); checked by drawing it.
  const same = (a, b) => deepEqual(a, b)
  for (const c of combos) {
    const { D, typo } = c
    const full = { ...typo }
    if (colorAsProp) full.color = colorToken(ds, c.want.en.color)
    if (alignAsProp) full.align = ALIGN_OF[c.want.en.textAlign]
    const minimal = {}
    if (!same(full.size, D.size) || !same(full.leading, D.leading)) {
      minimal.size = full.size
      minimal.leading = full.leading
    }
    if (full.weight !== (D.weight || "regular")) minimal.weight = full.weight
    if (full.family !== (D.family || "auto")) minimal.family = full.family
    if ("color" in full && full.color !== (D.color || "primary"))
      minimal.color = full.color
    if ("align" in full && full.align !== (D.align || "start"))
      minimal.align = full.align
    const twin = flatten(evalStyle(style.expr, c.env, registry.a))
    const draws = (t) => {
      try {
        const props = slotProps(
          model,
          scenario(undefined, Object.keys(t).length ? t : undefined)
        )
        return ["en", "ar"].every((lang) =>
          deepEqual(drawText(ds, lang, props, undefined, twin), c.want[lang])
        )
      } catch (error) {
        if (error instanceof Opaque) return false
        throw error
      }
    }
    const withSize = { size: full.size, leading: full.leading, ...minimal }
    c.type = [minimal, withSize, full].find(draws)
    if (!c.type)
      throw new Unconvertible(
        "not-expressible",
        `no ${model.typeProp} draws what \`${c.str}\` drew on ${model.name}'s text`
      )
  }

  const uses = { px: false }
  const refs = []
  const empty = (t) => Object.keys(t).length === 0
  let typeAttr = null
  if (!combos.every((c) => empty(c.type))) {
    const s = synthesize(
      combos.map((c) => ({
        env: c.env,
        value: empty(c.type) ? undefined : c.type,
      })),
      atomIds,
      table,
      (t) => (t === undefined ? "undefined" : printType(ds, t, uses)),
      refs
    )
    typeAttr =
      "constant" in s
        ? `${model.typeProp}={${printType(ds, s.constant, uses)}}`
        : `${model.typeProp}={${s.expr}}`
  }
  return {
    typeAttr,
    style,
    refs,
    uses,
    combos: combos.length,
  }
}

// ---------------------------------------------------------------------------
// Fields: DmInput's and DmAuthInput's input and placeholder classes as
// FieldType (build-w15-api.md item 4)

const WEIGHT_OF = {
  400: "regular",
  500: "medium",
  600: "semibold",
  700: "bold",
}
const FIELD_SIZE = 13
const FIELD_LEADING = 16

/**
 * What a field draws from its input classes, the way DmInput and DmAuthInput
 * read them: the last text-N is the size (a state, 13 until a class sets
 * it), text-N, the first custom### and every leading-[Npx] are taken out
 * before NativeWind, and the face and Arabic line height come from
 * fieldFont over the whole string (the field's own 400 and 16 under it).
 *
 * `raised` is DmInput's placeholder once it has risen over a value (or
 * always, with isTextAnimAlways): fieldFont over the same string and type,
 * with 700 as its own face. A class's face wins there too, so a field whose
 * classes say font-custom400 drew its raised label regular, and a type that
 * leaves the weight out draws it bold. At rest the placeholder draws the
 * field's face, which `fontFamily` already is.
 */
const fieldDraws = (lang, classString, type) => {
  const { fieldFont } = slotsModule()
  const sizes = classString ? classString.match(/text-(\d+)/g) || [] : []
  const size = type
    ? (type.size ?? FIELD_SIZE)
    : sizes.length
      ? Number(sizes[sizes.length - 1].slice(5))
      : FIELD_SIZE
  const face = type
    ? { weight: type.weight, leading: type.arabicLeading }
    : undefined
  const font = fieldFont(lang, "regular", face, classString || undefined)
  const raised = fieldFont(lang, "bold", face, classString || undefined)
  return {
    fontSize: size,
    fontFamily: font.fontFamily,
    lineHeight: font.lineHeight,
    raised: { fontFamily: raised.fontFamily, lineHeight: raised.lineHeight },
  }
}

/**
 * Whether a field's classes name a face: the font layer reads one out of
 * them (takeFontStyles, in either language), so it is the face of the field
 * and of DmInput's raised placeholder alike, whatever their own.
 */
const namesFace = (classString) => {
  const { takeFontStyles } = helpersModule()
  return ["en", "ar"].some(
    (lang) => takeFontStyles(classString, lang).fontFamily !== undefined
  )
}

/**
 * What of a field and its placeholder `got` draws differently from `want`,
 * or null. DmAuthInput's placeholder draws its own face (bold over a value,
 * else regular) from an effect that runs after the field's, whatever the
 * classes or the type say, so only DmInput's raised placeholder is checked.
 */
const fieldDiffers = (component, got, want) => {
  const keys = ["fontSize", "fontFamily", "lineHeight"]
  if (keys.some((key) => got[key] !== want[key])) return "the field"
  if (
    component === "DmInput" &&
    (got.raised.fontFamily !== want.raised.fontFamily ||
      got.raised.lineHeight !== want.raised.lineHeight)
  )
    return "the raised placeholder"
  return null
}

const stripField = (classString) =>
  classString
    .replace(/text-(\d+)/g, "")
    .replace(/custom(\d{3})/, "")
    .replace(/leading-\[\d+px\]/g, "")

/**
 * One combination of a field's classes: the FieldType that draws what they
 * drew, and what of them draws nothing (their fontSize and face on the
 * field; their size, face and colour on the placeholder, which only keeps
 * its English line height).
 */
const fieldCombo = (component, fieldStr, placeholderStr) => {
  const type = {}
  const dead = []
  if (fieldStr !== undefined) {
    const classStyle = resolveClass(stripField(fieldStr))
    for (const key of ["fontWeight", "lineHeight"])
      if (key in classStyle)
        throw new Unconvertible(
          "not-expressible",
          `the field's classes set ${key}, which inputType can't carry`
        )
    const want = {
      en: fieldDraws("en", fieldStr, null),
      ar: fieldDraws("ar", fieldStr, null),
    }
    if (
      (fieldStr.match(/text-(\d+)/g) || []).length &&
      want.en.fontSize !== FIELD_SIZE
    )
      type.size = want.en.fontSize
    const weight = WEIGHTS.find(
      (w) =>
        fieldDraws("en", "", { weight: w }).fontFamily === want.en.fontFamily &&
        fieldDraws("ar", "", { weight: w }).fontFamily === want.ar.fontFamily
    )
    if (!weight)
      throw new Unconvertible(
        "font-not-expressible",
        `the field's face ${want.en.fontFamily} / ${want.ar.fontFamily} is no weight's`
      )
    // A class that names a face names the weight, regular included: regular
    // is the field's own face, but not its raised placeholder's (bold, until
    // a face is named), so font-custom400 left out of the type turns a
    // filled field's floating label bold.
    if (weight !== "regular" || namesFace(fieldStr)) type.weight = weight
    const n = Math.round((want.ar.lineHeight / AR) * 1000) / 1000
    if (n !== FIELD_LEADING) type.arabicLeading = n
    for (const lang of ["en", "ar"]) {
      const got = fieldDraws(lang, "", type)
      const part = fieldDiffers(component, got, want[lang])
      if (part)
        throw new Unconvertible(
          "not-expressible",
          `inputType would draw ${part} as ${JSON.stringify(got)} where the classes drew ${JSON.stringify(want[lang])} (${lang})`
        )
    }
    for (const key of ["fontSize", "fontFamily"])
      if (key in classStyle)
        dead.push({
          class: `${key} in ${component}'s inputClassName`,
          reason: `the field draws its own ${key === "fontSize" ? "size" : "face"} over it`,
        })
  }
  if (placeholderStr !== undefined) {
    const classStyle = resolveClass(placeholderStr)
    if ("fontWeight" in classStyle)
      throw new Unconvertible(
        "not-expressible",
        "the placeholder's classes set fontWeight, which inputType can't carry"
      )
    if (
      component === "DmAuthInput" &&
      placeholderStr.split(/\s+/).some((t) => /custom\d{3}/.test(t))
    )
      throw new Unconvertible(
        "not-expressible",
        "DmAuthInput's placeholder reads a font class into its face, which inputType has no key for"
      )
    if (typeof classStyle.lineHeight === "number")
      type.placeholderLeading = classStyle.lineHeight
    for (const key of ["fontSize", "fontFamily", "color"])
      if (key in classStyle)
        dead.push({
          class: `${key} in ${component}'s placeholder class`,
          reason:
            key === "fontSize"
              ? "the placeholder's animation draws its size over it"
              : key === "fontFamily"
                ? "the placeholder draws the field's face over it"
                : "the placeholder draws placeholderTextColor over it",
        })
  }
  return { type, dead }
}

/**
 * DmInput's and DmAuthInput's input and placeholder classes together (both
 * write one `inputType`), as FieldType and the two style twins, or
 * Unconvertible. `irs`: { field, placeholder }, either null.
 */
const convertFields = ({
  ds,
  irs,
  table,
  registry,
  hints,
  component,
  typeProp,
}) => {
  const ids = new Set()
  for (const ir of Object.values(irs))
    if (ir) for (const id of atomsOf(ir)) ids.add(id)
  const atomIds = [...ids]
  let envs
  try {
    envs = assignments(atomIds)
  } catch (error) {
    throw new Unconvertible("too-many-conditions", error.message)
  }
  const dead = new Map()
  const combos = envs.map((env) => {
    const fieldStr = irs.field ? evaluate(irs.field, env) : undefined
    const placeholderStr = irs.placeholder
      ? evaluate(irs.placeholder, env)
      : undefined
    const c = fieldCombo(component, fieldStr, placeholderStr)
    for (const d of c.dead) dead.set(d.class, d)
    return {
      env,
      type: c.type,
      sized: !!fieldStr && (fieldStr.match(/text-(\d+)/g) || []).length > 0,
    }
  })
  // The size is a state the classes set: a combination with no text-N keeps
  // whatever an earlier one set, which no type can follow.
  if (irs.field && new Set(combos.map((c) => c.sized)).size > 1)
    throw new Unconvertible(
      "not-expressible",
      "a text-N in some states only: the field keeps the size an earlier state set"
    )
  const styles = {}
  if (irs.field)
    styles.field = styleFromIR(irs.field, {
      table,
      registry,
      hint: hints.field,
      exclude: new Set(TYPO_KEYS),
      fontIsDead: false,
    })
  if (irs.placeholder)
    styles.placeholder = styleFromIR(irs.placeholder, {
      table,
      registry,
      hint: hints.placeholder,
      exclude: new Set([...TYPO_KEYS, "color"]),
      fontIsDead: false,
    })
  const uses = { px: false }
  const refs = []
  const printField = (t) => {
    const parts = []
    if ("size" in t)
      parts.push(
        `size: ${onScale(ds, t.size) ? t.size : ((uses.px = true), `px(${t.size})`)}`
      )
    if ("weight" in t) parts.push(`weight: ${JSON.stringify(t.weight)}`)
    for (const k of ["arabicLeading", "placeholderLeading"])
      if (k in t) {
        uses.px = true
        parts.push(`${k}: px(${t[k]})`)
      }
    return `{ ${parts.join(", ")} }`
  }
  const empty = (t) => Object.keys(t).length === 0
  let typeAttr = null
  if (!combos.every((c) => empty(c.type))) {
    const s = synthesize(
      combos.map((c) => ({
        env: c.env,
        value: empty(c.type) ? undefined : c.type,
      })),
      atomIds,
      table,
      (t) => (t === undefined ? "undefined" : printField(t)),
      refs
    )
    typeAttr =
      "constant" in s
        ? `${typeProp}={${printField(s.constant)}}`
        : `${typeProp}={${s.expr}}`
  }
  return { typeAttr, styles, refs, uses, dead: [...dead.values()] }
}

module.exports = {
  Opaque,
  convertFields,
  convertTextSlot,
  textSlotModel,
  // for the codemod's tests: what a field draws, and the proof's comparison
  fieldDiffers,
  fieldDraws,
}
