/**
 * One file through the codemod: find every element with a class attribute
 * (and every DmText), decide what NativeWind does with it today, apply the
 * matching rule, and splice the result into the source.
 */
const fs = require("fs")
const path = require("path")
const traverse = require("@babel/traverse").default

const {
  AtomTable,
  Dynamic,
  assignments,
  atomsOf,
  buildIR,
  evaluate,
} = require("./classexpr")
const { loadDs } = require("./dsload")
const { convertDmText, TEXT_PROPS } = require("./dmtext")
const { convertActionBtn } = require("./actionbtn")
const { Unconvertible, styleFromIR } = require("./plain")
const {
  ignoresStyle,
  slotFor,
  styleArrayReads,
  twinRenames,
} = require("./slots")
const { convertFields, convertTextSlot } = require("./typetwin")
const { FIELDS, HAND_EDITS, bannedKeys } = require("./twins")
const { checkStyleAttr, sheetObject } = require("./stylecheck")
const { readTextStyle } = require("./textstyle")
const {
  StyleRegistry,
  camel,
  printEntries,
  printLiteral,
  printStyle,
  refsOf,
} = require("./styles")
const { resolve } = require("../nw-resolve")
const {
  SHARED,
  findExport,
  parseCode,
  rel,
  resolveSource,
} = require("./modules")

const CLASS_ATTR = /^className|ClassName$/

// The class attributes that drew nothing at e30b19a (dead-at-e30b19a.json):
// refused whatever their component reads now, so a W1 twin can't make them
// draw (review-ca-w0 M3).
const DEAD_AT_E30B19A = Object.freeze(
  // eslint-disable-next-line global-require
  require("./dead-at-e30b19a.json").sites.map((d) => Object.freeze(d))
)

const squashSpace = (s) => s.replace(/\s+/g, " ").trim()

/** A class attribute's classes as dead-at-e30b19a.json keys them. */
const classesText = (attrPath, code) => {
  const v = attrPath.node.value
  if (!v) return ""
  if (v.type === "StringLiteral") return squashSpace(v.value)
  const e = v.type === "JSXExpressionContainer" ? v.expression : v
  return squashSpace(code.slice(e.start, e.end))
}

const UI_DIR = path.join(SHARED, "src", "components", "UI")
const PRIMITIVES = {
  [path.join(UI_DIR, "DmText", "DmText.tsx")]: "DmText",
  [path.join(UI_DIR, "DmView", "DmView.tsx")]: "DmView",
  [path.join(UI_DIR, "ActionBtn", "ActionBtn.tsx")]: "ActionBtn",
}
const DS_SOURCE = "@tappler/shared/src/ds"
const PALETTE_SOURCE = "@tappler/shared/src/styles/colors"
// The app's own colours, written by yarn ds:colors.
const APP_PALETTE_SOURCE = "styles/dsColors"

const BOOLEAN_NAME =
  /^(is|has|should|can|show|was|did|will|are|need|needs|allow|enable|with|use)[A-Z_0-9]|^(disabled?|visible|active|selected|checked|open|loading|focused|editable|valid|error|rtl|isRTL|isAr|isEn|first|last|expanded|collapsed|hidden|pressed|enabled|required|empty)$/

// ---------------------------------------------------------------------------
// What a tag is

const tagText = (nameNode) =>
  nameNode.type === "JSXIdentifier"
    ? nameNode.name
    : nameNode.type === "JSXMemberExpression"
      ? `${tagText(nameNode.object)}.${nameNode.property.name}`
      : null

// A bare <DmText> or <ActionBtn> (no class attribute) is converted too; only
// imports named so (or a default import of their path) are worth resolving.
const maybePrimitive = (openingPath) => {
  const n = openingPath.node.name
  if (n.type !== "JSXIdentifier") return false
  const binding = openingPath.scope.getBinding(n.name)
  if (!binding) return false
  const p = binding.path
  if (p.isImportSpecifier())
    return ["DmText", "ActionBtn"].includes(
      p.node.imported.name || p.node.imported.value
    )
  if (p.isImportDefaultSpecifier())
    return /(DmText|ActionBtn)(\/(DmText|ActionBtn))?$/.test(
      p.parent.source.value
    )
  return false
}

const rootIdentifier = (nameNode) =>
  nameNode.type === "JSXMemberExpression"
    ? rootIdentifier(nameNode.object)
    : nameNode

/**
 * { kind, def?, source?, name } for an element's tag:
 *   dmtext | dmview | actionbtn       the shared primitives
 *   host                              react-native, or a package NativeWind
 *                                     transforms (it wraps the element)
 *   scoped                            a package NativeWind won't transform
 *   component                         one of ours (src or tappler-shared)
 *   local                             defined in this file
 *   unknown
 */
const classifyTag = (openingPath, file) => {
  const nameNode = openingPath.node.name
  const name = tagText(nameNode)
  const root = rootIdentifier(nameNode)
  if (root.type !== "JSXIdentifier") return { kind: "unknown", name }
  if (/^[a-z]/.test(root.name)) return { kind: "intrinsic", name }
  const binding = openingPath.scope.getBinding(root.name)
  if (!binding) return { kind: "unknown", name }
  const p = binding.path
  if (
    p.isImportSpecifier() ||
    p.isImportDefaultSpecifier() ||
    p.isImportNamespaceSpecifier()
  ) {
    const source = p.parent.source.value
    const imported = p.isImportDefaultSpecifier()
      ? "default"
      : p.isImportNamespaceSpecifier()
        ? "*"
        : p.node.imported.name || p.node.imported.value
    const target = resolveSource(file, source)
    if (target.kind === "package") {
      // NativeWind's own test (get-import-blocked-components.js): a package
      // name with a "/" (a scope, a deep import) doesn't match its "*".
      return {
        kind: source.includes("/") ? "scoped" : "host",
        source,
        name,
        isMember: nameNode.type === "JSXMemberExpression",
      }
    }
    if (target.kind !== "file") return { kind: "unknown", source, name }
    if (!/\.(tsx?|jsx?)$/.test(target.file))
      return { kind: "asset", source, name }
    if (nameNode.type === "JSXMemberExpression")
      return { kind: "unknown", source, name }
    const def = findExport(target.file, imported)
    if (!def || !def.node) {
      if (def && def.package)
        return {
          kind: def.package.includes("/") ? "scoped" : "host",
          source: def.package,
          name,
        }
      return { kind: "unknown", source, name }
    }
    const primitive = PRIMITIVES[def.file]
    if (primitive) return { kind: primitive.toLowerCase(), def, source, name }
    return { kind: "component", def, source, name }
  }
  if (nameNode.type === "JSXMemberExpression") return { kind: "unknown", name }
  return { kind: "local", name, def: { file, node: p.node, name: root.name } }
}

// tappler-shared's text slot (classNameSlots.ts), as imported or through a
// module-level alias (`const Title = ClassNameText`), however it's imported.
const SLOTS_FILE = /(^|[/\\])classNameSlots\.tsx?$/
const isClassNameText = (openingPath, file) => {
  const n = openingPath.node.name
  if (n.type !== "JSXIdentifier") return false
  const imported = (binding) => {
    if (!binding || !binding.path.isImportSpecifier()) return false
    const name =
      binding.path.node.imported.name || binding.path.node.imported.value
    const target = resolveSource(file, binding.path.parent.source.value)
    if (target.kind !== "file") return false
    const def = findExport(target.file, name)
    return !!(
      def &&
      def.file &&
      SLOTS_FILE.test(def.file) &&
      (def.name || name) === "ClassNameText"
    )
  }
  const binding = openingPath.scope.getBinding(n.name)
  if (imported(binding)) return true
  if (!binding || !binding.constant || !binding.path.isVariableDeclarator())
    return false
  const init = binding.path.node.init
  return (
    !!init &&
    init.type === "Identifier" &&
    imported(binding.path.scope.getBinding(init.name))
  )
}

// ---------------------------------------------------------------------------
// Readable keys for StyleSheet entries

const tKey = (children) => {
  for (const c of children) {
    if (c.type !== "JSXExpressionContainer") continue
    const e = c.expression
    if (
      e.type === "CallExpression" &&
      e.callee.type === "Identifier" &&
      e.callee.name === "t" &&
      e.arguments[0] &&
      e.arguments[0].type === "StringLiteral"
    ) {
      const parts = e.arguments[0].value.split(/[.:]/)
      return parts[parts.length - 1]
    }
  }
  return null
}

const ROLE = [
  [/SafeAreaView$/, "safeArea"],
  [/ScrollView$|FlatList$|SectionList$/, "scroll"],
  [/MapView$/, "map"],
  [/TextInput$/, "input"],
  [/Image(Background)?$/, "image"],
  [/ActivityIndicator$/, "spinner"],
  [/DropShadow$/, "shadow"],
  [/KeyboardAvoidingView$/, "keyboardAvoider"],
  [/^Animated\./, "animated"],
  [/^HeaderOnboarding$/, "header"],
]

const childHint = (el) => {
  const tag = tagText(el.openingElement.name) || ""
  const leaf = tag.split(".").pop()
  if (leaf === "DmText" || leaf === "Text")
    return tKey(el.children || []) || "text"
  if (leaf === "ActionBtn" || leaf === "Button") return "button"
  for (const [re, role] of ROLE) if (re.test(tag)) return role
  if (/Icon$/.test(leaf)) return "icon"
  if (/Input$/.test(leaf)) return "input"
  if (/Checbox$|Checkbox$/.test(leaf)) return "checkbox"
  if (/^Header/.test(leaf)) return "header"
  return leaf === "DmView" || leaf === "View" ? "box" : camel(leaf)
}

const classText = (openingNode) => {
  const attr = openingNode.attributes.find(
    (a) => a.type === "JSXAttribute" && a.name.name === "className"
  )
  if (!attr || !attr.value) return ""
  return attr.value.type === "StringLiteral"
    ? attr.value.value
    : JSON.stringify(attr.value.expression)
}

/** A readable StyleSheet key for an element's styles. */
const hintFor = (openingPath, tag, kind) => {
  const testId = openingPath.node.attributes.find(
    (a) =>
      a.type === "JSXAttribute" &&
      a.name.name === "testID" &&
      a.value &&
      a.value.type === "StringLiteral"
  )
  if (testId) return camel(testId.value.value)
  const element = openingPath.parentPath.node
  if (kind === "dmtext") {
    const key = tKey(element.children || [])
    return key ? camel(key) : "text"
  }
  if (kind === "actionbtn") return "button"
  for (const [re, role] of ROLE) if (re.test(tag)) return role
  // The element a component returns at the top.
  const parent = openingPath.parentPath.parentPath
  if (
    parent &&
    (parent.isReturnStatement() ||
      parent.isArrowFunctionExpression() ||
      (parent.isParenthesizedExpression && parent.isParenthesizedExpression()))
  )
    return "container"
  if (kind !== "dmview" && !/^(View|TouchableOpacity|Pressable)$/.test(tag))
    return camel(tag.split(".").pop())
  const children = (element.children || []).filter(
    (c) =>
      !(c.type === "JSXText" && c.value.trim() === "") &&
      !(
        c.type === "JSXExpressionContainer" &&
        c.expression.type === "JSXEmptyExpression"
      )
  )
  const mapped = children.some(
    (c) =>
      c.type === "JSXExpressionContainer" &&
      /"name":"map"/.test(JSON.stringify(c.expression))
  )
  if (mapped) return "list"
  const rowish = /\bflex-row\b/.test(classText(openingPath.node))
  const elements = children.filter((c) => c.type === "JSXElement")
  if (elements.length === 1 && children.length === 1)
    return `${childHint(elements[0])}${rowish ? "Row" : "Wrap"}`
  return rowish ? "row" : "box"
}

// ---------------------------------------------------------------------------
// Constants a className may name

const makeIdentifierResolver = (
  file,
  code,
  table,
  clsxNames,
  inlined = new Set()
) => {
  const resolveIdentifier = (idPath, depth = 0) => {
    if (depth > 6) return null
    const name = idPath.node.name
    const binding = idPath.scope.getBinding(name)
    if (!binding) return null
    const ir = readBinding(idPath, binding, depth)
    if (ir) inlined.add(binding)
    return ir
  }
  const readBinding = (idPath, binding, depth) => {
    const p = binding.path
    if (p.isVariableDeclarator()) {
      if (!binding.constant || !p.node.init) return null
      const init = p.get("init")
      // Only a value whose conditions read the same bindings here as there.
      const ir = buildIR(init, table, {
        clsxNames,
        resolveIdentifier: (q) => resolveIdentifier(q, depth + 1),
      })
      // Its conditions move to every element that uses it: only pure ones.
      const atoms = [...require("./classexpr").atomsOf(ir)]
      if (atoms.some((id) => !table.atoms[id].pure)) return null
      const sameScope = sameBindings(init, idPath)
      return sameScope ? ir : null
    }
    if (p.isImportSpecifier() || p.isImportDefaultSpecifier()) {
      const source = p.parent.source.value
      const imported = p.isImportDefaultSpecifier()
        ? "default"
        : p.node.imported.name
      const target = resolveSource(file, source)
      if (target.kind !== "file") return null
      const def = findExport(target.file, imported)
      if (!def || !def.node || def.node.type !== "VariableDeclarator")
        return null
      return staticString(def.node.init)
    }
    return null
  }
  return resolveIdentifier
}

// A constant from another file: plain strings only (its conditions, if it
// had any, would read that file's variables).
const staticString = (node) => {
  if (!node) return null
  if (node.type === "StringLiteral") return { t: "str", v: node.value }
  if (node.type === "TemplateLiteral" && node.expressions.length === 0)
    return { t: "str", v: node.quasis[0].value.cooked }
  if (node.type === "TSAsExpression") return staticString(node.expression)
  return null
}

const sameBindings = (initPath, usePath) => {
  let same = true
  const check = (p) => {
    if (!p.isReferencedIdentifier()) return
    const name = p.node.name
    if (initPath.scope.getBinding(name) !== usePath.scope.getBinding(name))
      same = false
  }
  if (initPath.isIdentifier()) check(initPath)
  initPath.traverse({ Identifier: check })
  return same
}

// ---------------------------------------------------------------------------
// What a component used to read out of a class string itself

/**
 * The props a twin registry's PARSED rules write for a site (twins.js):
 * `radius={20}` for MainModal's copied rounded-20, `height={63}` for
 * DmInput's h-[63], JobLocationMap's whole height class as `height`. A token
 * present in some states and not others, or worth different values, can't
 * be one prop: the site stays.
 */
const propAttr = (name, value) =>
  typeof value === "string"
    ? `${name}=${JSON.stringify(value)}`
    : `${name}={${printLiteral(value)}}`

// The typography a class IR carries in some combination (what a text's and
// a field's font layers read: a size, a line height, a face, a weight, or
// DmText's font-customNNN and 1-2 digit leading-[Npx]), or null.
const typographyIn = (ir) => {
  for (const env of assignments([...atomsOf(ir)])) {
    const str = evaluate(ir, env)
    const tokens = str.split(/\s+/).filter(Boolean)
    if (tokens.some((t) => /custom\d{3}|^leading-\[\d{1,2}px\]$/.test(t)))
      return "a font or leading class"
    let style
    try {
      style = resolve(str).style
    } catch {
      continue
    }
    const key = ["fontSize", "lineHeight", "fontFamily", "fontWeight"].find(
      (k) => k in style
    )
    if (key) return key
  }
  return null
}

// A call site attribute's value, for a component the codemod reads: a
// literal, true for a bare attribute, or opaque.
const siteValue = (attrPath) => {
  if (!attrPath) return undefined
  const v = attrPath.node.value
  if (!v) return { value: true }
  if (v.type === "StringLiteral") return { value: v.value }
  if (v.type === "JSXExpressionContainer") {
    const e = v.expression
    if (
      e.type === "StringLiteral" ||
      e.type === "NumericLiteral" ||
      e.type === "BooleanLiteral"
    )
      return { value: e.value }
    if (e.type === "NullLiteral") return { value: null }
    if (e.type === "Identifier" && e.name === "undefined")
      return { value: undefined }
  }
  return { opaque: true }
}

// A class string the component draws as a typed prop the codemod can't prove
// from the classes (twins.js HAND_EDITS): the edit, said in the reason.
const handEditFor = (def, attrName, attrPath, attrs) => {
  if (!def || !def.file) return null
  const component = path.basename(def.file).replace(/\.[jt]sx?$/, "")
  const rules = (HAND_EDITS[component] || {})[attrName] || []
  const v = siteValue(attrPath)
  if (!rules.length || !v || v.opaque || typeof v.value !== "string")
    return null
  const classes = v.value.trim().split(/\s+/).join(" ")
  const hit = rules.find(
    (r) =>
      r.classes === classes &&
      Object.entries(r.when || {}).every(([prop, want]) => {
        const got = siteValue(attrs[prop])
        return !!got && !got.opaque && got.value === want
      })
  )
  return hit ? `${hit.edit}: ${hit.why}` : null
}

// The keys a PARSED rule takes out of the style twin, when it fires in
// every combination (it can't follow one that comes and goes).
const consumedKeys = (rules, strs) =>
  new Set(
    rules
      .filter((r) => r.consume && strs.every((str) => rule(r).test(str)))
      .map((r) => r.key)
  )
const rule = (r) => new RegExp(r.match.source)

/**
 * The props a component's parsed rules write. `tokens`: { name -> the values
 * a prop takes as they are }; a value off them is written px(n).
 */
const parsedProps = (rules, result, tokens = {}) => {
  const attrs = []
  let noStyle = false
  let px = false
  for (const rule of rules) {
    // @dsFromClass: a whole class token stands for a typed prop. The
    // component's own parse may read the token inside a longer class
    // (SettingsItem's `className?.includes("border-0")` sees it in
    // `border-0.5`), so a class string the two readings disagree on is left.
    if (rule.token !== undefined) {
      const hits = result.combos.map((c) => {
        const classes = c.str.split(/\s+/)
        const whole = classes.includes(rule.token)
        const inside = classes.find(
          (cls) => cls !== rule.token && cls.includes(rule.token)
        )
        if (!whole && inside)
          throw new Unconvertible(
            "parse-disagrees",
            `\`${inside}\` holds \`${rule.token}\` inside it: the component may read it as \`${rule.token}\` (its own parse) where \`${rule.prop}\` reads whole classes, so convert it by hand`
          )
        return whole
      })
      if (hits.every((h) => !h)) continue
      if (!hits.every(Boolean))
        throw new Unconvertible(
          "not-expressible",
          `\`${rule.token}\` is there in some states only; \`${rule.prop}\` can't follow it`
        )
      attrs.push(propAttr(rule.prop, rule.literal))
      continue
    }
    if (rule.whole) {
      const only =
        result.combos.length === 1 &&
        Object.keys(result.combos[0].expected).join() === rule.key
      if (only) {
        attrs.push(propAttr(rule.prop, result.combos[0].expected[rule.key]))
        noStyle = true
      }
      continue
    }
    const hits = result.combos.map((c) => c.str.match(rule.match))
    if (hits.every((h) => !h)) continue
    if (!hits.every(Boolean))
      throw new Unconvertible(
        "not-expressible",
        `\`${hits.find(Boolean)[0]}\` is there in some states only; \`${rule.prop}\` can't follow it`
      )
    const values = hits.map((h) => resolve(h[0]).style[rule.key])
    if (
      values.some((v) => v === undefined) ||
      new Set(values.map(String)).size > 1
    )
      throw new Unconvertible(
        "not-expressible",
        `\`${hits[0][0]}\` doesn't give one \`${rule.prop}\``
      )
    // A rule that takes its key out of the style twin (DmInput's height)
    // stands for the class that draws it: the component's parse must have
    // found that class, whole, and no later class may draw the key instead
    // (`min-h-[63]` holds `h-[63]`; `h-[50] h-[63]` draws 63 but places by 50).
    if (rule.consume)
      result.combos.forEach((c, i) => {
        // the classes' whole style, before the twin's refused keys go
        const drawn = (c.r ? c.r.style : c.expected)[rule.key]
        if (!c.str.split(/\s+/).includes(hits[i][0]) || drawn !== values[i])
          throw new Unconvertible(
            "parse-disagrees",
            `the component reads \`${hits[i][0]}\` for \`${rule.prop}\` out of "${c.str.trim()}", whose ${rule.key} is ${drawn === undefined ? "no class's" : drawn}: convert it by hand`
          )
      })
    const scale = rule.tokens && tokens[rule.tokens]
    if (scale && typeof values[0] === "number" && !scale.includes(values[0])) {
      px = true
      attrs.push(`${rule.prop}={px(${values[0]})}`)
    } else attrs.push(propAttr(rule.prop, values[0]))
  }
  return { attrs, noStyle, px }
}

// ---------------------------------------------------------------------------
// Conditions that call something: never run more often than before

const condRefs = (expr, out = []) => {
  if (!expr) return out
  if (expr.k === "if") {
    out.push(expr.cond.id)
    condRefs(expr.then, out)
    condRefs(expr.else, out)
  } else if (expr.k === "arr") expr.items.forEach((x) => condRefs(x, out))
  return out
}

/**
 * A condition with a call in it (`watch("phone").length < 11`) may move
 * from the className to the style or a prop of the same element, but it
 * must not run more times than the source runs it.
 */
const checkConditionUse = (table, used) => {
  const n = new Map()
  for (const id of used) n.set(id, (n.get(id) || 0) + 1)
  for (const [id, k] of n) {
    const atom = table.atoms[id]
    if (!atom.pure && k > atom.count)
      throw new Unconvertible(
        "impure-condition",
        `\`${atom.src}\` calls a function; converted it would run ${k} times where it runs ${atom.count}`
      )
  }
}

// ---------------------------------------------------------------------------
// Splicing

const lineStart = (code, i) => code.lastIndexOf("\n", i - 1) + 1
const lineEnd = (code, i) => {
  const n = code.indexOf("\n", i)
  return n === -1 ? code.length : n
}

const attrSeparator = (code, attr, fallbackFrom) => {
  const start = attr ? attr.start : fallbackFrom
  const before = code.slice(lineStart(code, start), start)
  if (attr && /^\s*$/.test(before)) return `\n${before}`
  return " "
}

/** Removing an attribute, and the line it sat alone on. */
const removalEdit = (code, attr) => {
  const ls = lineStart(code, attr.start)
  const le = lineEnd(code, attr.end)
  if (
    /^\s*$/.test(code.slice(ls, attr.start)) &&
    /^\s*$/.test(code.slice(attr.end, le)) &&
    le < code.length
  )
    return { start: ls, end: le + 1, text: "" }
  const start = code[attr.start - 1] === " " ? attr.start - 1 : attr.start
  return { start, end: attr.end, text: "" }
}

const applyEdits = (code, edits) => {
  const sorted = [...edits].sort((x, y) => y.start - x.start || y.end - x.end)
  for (let i = 1; i < sorted.length; i++)
    if (
      sorted[i].end > sorted[i - 1].start &&
      !(
        sorted[i].start === sorted[i].end &&
        sorted[i - 1].start === sorted[i - 1].end
      )
    )
      throw new Error(
        `ds-codemod: internal: overlapping edits at ${sorted[i].start}-${sorted[i].end} and ${sorted[i - 1].start}-${sorted[i - 1].end}`
      )
  let out = code
  for (const e of sorted)
    out = out.slice(0, e.start) + e.text + out.slice(e.end)
  return out
}

// ---------------------------------------------------------------------------
// Names this file can use

const bindingNames = (ast) => {
  const names = new Set()
  traverse(ast, {
    Scope(p) {
      for (const n of Object.keys(p.scope.bindings)) names.add(n)
    },
    Identifier(p) {
      if (!p.scope.getBinding(p.node.name)) names.add(p.node.name)
    },
  })
  return names
}

// Names a scope inside the file binds again (a callback's `a`, a local
// `px`): an import of that name is shadowed there.
const innerBindingNames = (ast) => {
  const names = new Set()
  traverse(ast, {
    Scope(p) {
      if (p.isProgram()) return
      for (const n of Object.keys(p.scope.bindings)) names.add(n)
    },
  })
  return names
}

const freeName = (taken, wanted, ...fallbacks) => {
  for (const n of [wanted, ...fallbacks]) if (!taken.has(n)) return n
  for (let i = 2; ; i++)
    if (!taken.has(`${fallbacks[fallbacks.length - 1]}${i}`))
      return `${fallbacks[fallbacks.length - 1]}${i}`
}

// ---------------------------------------------------------------------------
// The co-located styles file

/**
 * Where new StyleSheet entries go: the object this file already imports
 * from ./styles, a new named export in an existing ./styles.ts, or a new
 * ./styles.ts.
 */
// The object a styles file exports as `exportName` through StyleSheet.create,
// read from its current text (earlier files in the same run may have added
// to it): the object node, or null when it isn't one plain literal.
const sheetIn = (code, exportName) => {
  const ast = parseCode(code)
  const local = (name) => {
    for (const stmt of ast.program.body) {
      const decl =
        stmt.type === "ExportNamedDeclaration" && stmt.declaration
          ? stmt.declaration
          : stmt
      if (decl.type === "VariableDeclaration")
        for (const d of decl.declarations)
          if (d.id.type === "Identifier" && d.id.name === name) return d.init
    }
    return null
  }
  for (const stmt of ast.program.body) {
    if (exportName === "default" && stmt.type === "ExportDefaultDeclaration") {
      const d = stmt.declaration
      return sheetObject(d.type === "Identifier" ? local(d.name) : d)
    }
    if (exportName !== "default" && stmt.type === "ExportNamedDeclaration") {
      if (stmt.declaration && stmt.declaration.type === "VariableDeclaration")
        for (const d of stmt.declaration.declarations)
          if (d.id.name === exportName) return sheetObject(d.init)
      for (const sp of stmt.specifiers || [])
        if (
          !stmt.source &&
          (sp.exported.name || sp.exported.value) === exportName
        )
          return sheetObject(local(sp.local.name))
    }
  }
  return null
}

/**
 * Where new StyleSheet entries go: the object this file already imports
 * from ./styles, a new named export in an existing ./styles.ts, or a new
 * ./styles.ts. `io` reads files as the run has left them so far (several
 * components in one directory share one styles.ts).
 */
const planStyles = (file, ast, io) => {
  const dir = path.dirname(file)
  const stylesFile = ["styles.ts", "styles.tsx", "styles.js"]
    .map((n) => path.join(dir, n))
    .find((f) => io.exists(f))
  const base = path.basename(file).replace(/\.[jt]sx?$/, "")
  const isStyles = (source) =>
    stylesFile &&
    source.startsWith(".") &&
    [stylesFile, stylesFile.replace(/\.[jt]sx?$/, "")].includes(
      path.resolve(dir, source)
    )
  let imported = null
  for (const stmt of ast.program.body) {
    if (stmt.type !== "ImportDeclaration" || !isStyles(stmt.source.value))
      continue
    for (const sp of stmt.specifiers) {
      if (sp.type === "ImportDefaultSpecifier")
        imported = { local: sp.local.name, export: "default" }
      else if (sp.type === "ImportSpecifier")
        imported = imported || {
          local: sp.local.name,
          export: sp.imported.name,
        }
    }
  }
  const code = stylesFile ? io.read(stylesFile) : null
  if (stylesFile && imported) {
    const obj = sheetIn(code, imported.export)
    if (obj)
      return {
        mode: "merge",
        file: stylesFile,
        local: imported.local,
        code,
        object: obj,
        taken: obj.properties
          .filter((p) => p.type === "ObjectProperty")
          .map((p) => (p.key.type === "Identifier" ? p.key.name : p.key.value)),
      }
  }
  const exportName = `${camel(base)}Styles`
  if (stylesFile) {
    // Taken export names: another file of this directory may have appended
    // its own already.
    const taken = new Set(
      (code.match(/export const (\w+)/g) || []).map((m) => m.slice(13))
    )
    let name = exportName
    for (let n = 2; taken.has(name); n++) name = `${exportName}${n}`
    return {
      mode: "append",
      file: stylesFile,
      exportName: name,
      code,
      taken: [],
    }
  }
  return { mode: "create", file: path.join(dir, "styles.ts"), taken: [] }
}

const quoteOf = (code, ast) => {
  const imp = ast.program.body.find((s) => s.type === "ImportDeclaration")
  return imp && code[imp.source.start] === "'" ? "'" : '"'
}

const stylesOutput = (plan, registry, q) => {
  const entries = printEntries(registry).join("\n")
  const sharedImport = `import colors from ${q}${PALETTE_SOURCE}${q}\n`
  const appImport = `import dsColors from ${q}${APP_PALETTE_SOURCE}${q}\n`
  const needsShared =
    registry.usesPalette &&
    !(
      plan.code &&
      /import\s+colors\s+from\s+["'][^"']*styles\/colors["']/.test(plan.code)
    )
  const needsApp =
    registry.usesAppPalette &&
    !(
      plan.code &&
      /import\s+dsColors\s+from\s+["'][^"']*styles\/dsColors["']/.test(
        plan.code
      )
    )
  const paletteImport =
    (needsShared ? sharedImport : "") + (needsApp ? appImport : "")
  const needsPalette = needsShared || needsApp
  if (plan.mode === "create")
    return [
      `import { StyleSheet } from ${q}react-native${q}\n`,
      needsPalette ? paletteImport : "",
      `\nexport default StyleSheet.create({\n${entries}\n})\n`,
    ].join("")
  let code = plan.code
  const addImport = (src, line) => {
    if (!line) return src
    const ast = parseCode(src)
    const imports = ast.program.body.filter(
      (s) => s.type === "ImportDeclaration"
    )
    const at = imports.length ? imports[imports.length - 1].end : 0
    return `${src.slice(0, at)}${at ? "\n" : ""}${line.trimEnd()}${at ? "" : "\n"}${src.slice(at)}`
  }
  if (plan.mode === "merge") {
    const obj = plan.object
    const close = obj.end - 1
    const inner = code.slice(obj.start + 1, close)
    const needsComma = obj.properties.length > 0 && !/,\s*$/.test(inner)
    const indent = "  "
    const text = `${needsComma ? "," : ""}\n${printEntries(registry, indent).join("\n")}\n`
    // Keep the closing brace's own line.
    const trimmedEnd = close - (inner.length - inner.trimEnd().length)
    code = `${code.slice(0, trimmedEnd)}${text}${code.slice(close)}`
    return addImport(code, needsPalette ? paletteImport : "")
  }
  // append: a new named export
  const hasSheet =
    /import\s*\{[^}]*\bStyleSheet\b[^}]*\}\s*from\s*["']react-native["']/.test(
      code
    )
  code = addImport(
    code,
    hasSheet ? "" : `import { StyleSheet } from ${q}react-native${q}\n`
  )
  code = addImport(code, needsPalette ? paletteImport : "")
  return `${code.trimEnd()}\n\nexport const ${plan.exportName} = StyleSheet.create({\n${entries}\n})\n`
}

// ---------------------------------------------------------------------------

const elementOf = (openingPath) => openingPath.parentPath

const attrsByName = (openingPath) => {
  const out = {}
  openingPath.get("attributes").forEach((a) => {
    if (a.isJSXAttribute() && a.node.name.type === "JSXIdentifier")
      out[a.node.name.name] = a
  })
  return out
}

const hasSpread = (openingPath) =>
  openingPath.node.attributes.some((a) => a.type === "JSXSpreadAttribute")

/**
 * Converts one file's source. Returns { code, styles, sites, latent,
 * changed } and writes nothing.
 * options.wraps: the probe's wraps for this file ([{ line, component }]).
 */
const convertSource = (code, file, options = {}) => {
  const ds = loadDs()
  const ast = parseCode(code)
  const sites = []
  const latent = []
  const edits = []
  const relFile = rel(file)
  const deadSites = (options.deadSites || DEAD_AT_E30B19A).filter(
    (d) => d.file === relFile
  )
  const wraps = (options.wraps || []).map((w) => ({ ...w, used: false }))
  const isWrapped = (line, tag) => {
    const hit = wraps.find(
      (w) =>
        !w.used &&
        w.line === line &&
        (w.component === tag ||
          w.local === tag ||
          // an alias the probe followed (`const Title = ClassNameText`,
          // `createAnimatedComponent(Animated.ScrollView)`)
          (w.via || []).includes(tag) ||
          tag.endsWith(`.${w.component}`) ||
          w.component === tag.split(".").pop())
    )
    if (hit) hit.used = true
    return !!hit
  }

  const names = bindingNames(ast)
  // The design system's names the file imports already, by export name (a
  // re-run, once a component it waited on has its twins): reused as they
  // are, unless a scope inside the file binds the name again, where the
  // import isn't what a site would reach (the px guard below then refuses).
  // Any other name some other binding holds gets a free one.
  const dsImported = new Map()
  for (const stmt of ast.program.body)
    if (
      stmt.type === "ImportDeclaration" &&
      stmt.source.value === DS_SOURCE &&
      stmt.importKind !== "type"
    )
      for (const s of stmt.specifiers)
        if (s.type === "ImportSpecifier" && s.importKind !== "type")
          dsImported.set(s.imported.name || s.imported.value, s.local.name)
  const shadowed = innerBindingNames(ast)
  const dsName = (exported, ...fallbacks) => {
    const local = dsImported.get(exported)
    return local !== undefined && !shadowed.has(local)
      ? local
      : freeName(names, exported, ...fallbacks)
  }
  const nameFor = {
    Text: dsName("Text", "DsText"),
    Button: dsName("Button", "DsButton"),
    a: dsName("a", "atoms", "dsAtoms"),
    px: dsName("px", "dsPx"),
  }
  const io = options.io || {
    read: (f) => fs.readFileSync(f, "utf8"),
    exists: (f) => fs.existsSync(f),
  }
  const plan = planStyles(file, ast, io)
  const registry = new StyleRegistry({
    taken: plan.taken,
    palette: ds.palette,
    appPalette: ds.appPalette,
    a: ds.a,
  })
  const stylesLocal =
    plan.mode === "merge"
      ? plan.local
      : plan.mode === "append"
        ? freeName(names, plan.exportName, `${plan.exportName}Ds`)
        : freeName(names, "styles", "dsStyles")
  // StyleSheet for StyleSheet.absoluteFill: the file's own react-native
  // import of it if there is one.
  let rnImport = null
  let rnStyleSheet = null
  for (const stmt of ast.program.body)
    if (
      stmt.type === "ImportDeclaration" &&
      stmt.source.value === "react-native" &&
      stmt.importKind !== "type"
    ) {
      rnImport = rnImport || stmt
      for (const sp of stmt.specifiers)
        if (
          sp.type === "ImportSpecifier" &&
          (sp.imported.name || sp.imported.value) === "StyleSheet"
        )
          rnStyleSheet = sp.local.name
    }
  const styleSheetName =
    rnStyleSheet || freeName(names, "StyleSheet", "RNStyleSheet")
  const printNames = {
    atoms: nameFor.a,
    styles: stylesLocal,
    styleSheet: styleSheetName,
  }
  const uses = {
    Text: false,
    Button: false,
    a: false,
    px: false,
    styles: false,
    StyleSheet: false,
  }
  const looks = []

  let clsxNames = new Set()
  for (const stmt of ast.program.body)
    if (stmt.type === "ImportDeclaration" && stmt.source.value === "clsx")
      for (const s of stmt.specifiers) clsxNames.add(s.local.name)

  const converted = new Set() // opening element nodes converted
  const removedClsxCalls = new Set()
  const removedAttrs = new Set() // class attributes the codemod replaced
  const replacedStyles = new Set() // style attributes written anew or removed
  const inlinedBindings = new Set() // class-string constants read into them

  const record = (site) => sites.push({ file: relFile, ...site })

  traverse(ast, {
    JSXOpeningElement(openingPath) {
      const node = openingPath.node
      let classAttrs = openingPath
        .get("attributes")
        .filter(
          (a) =>
            a.isJSXAttribute() &&
            a.node.name.type === "JSXIdentifier" &&
            CLASS_ATTR.test(a.node.name.name)
        )
      const tag = tagText(node.name)
      if (!tag) return
      screenHeader(openingPath, tag)
      if (classAttrs.length === 0 && !maybePrimitive(openingPath)) return
      const info = classifyTag(openingPath, file)
      if (
        classAttrs.length === 0 &&
        info.kind !== "dmtext" &&
        info.kind !== "actionbtn"
      )
        return
      const line = (classAttrs[0] ? classAttrs[0].node : node).loc.start.line
      const wrapped =
        classAttrs.some((a) => a.node.name.name === "className") &&
        isWrapped(
          classAttrs.find((a) => a.node.name.name === "className").node.loc
            .start.line,
          tag
        )
      const base = { tag, kind: info.kind, wrapped }

      // Classes that draw nothing are left for a person to delete, never
      // converted, which would make them draw:
      // - the ones frozen at e30b19a, whatever their component reads now (a
      //   W1 twin would make them draw: review-ca-w0 M3);
      // - a className NativeWind turns into a style for a component that
      //   reads no style.
      // The wrap turns only className into style: a component's other class
      // props reach it as written and go on below like anyone's (H3).
      const readsNoStyle = () =>
        info.kind === "component" && !!info.def && ignoresStyle(info.def)
      // A frozen row is the component, under its tag or the definition it
      // resolves to (an import renamed since), and the attribute: whatever
      // its classes say now. At e30b19a every such attribute in the file
      // drew nothing (NativeWind wraps by import, and the component read no
      // style), and a token changed or added since would draw once
      // converted (review-ca-w0, the T re-check's L2).
      const defName =
        info.def &&
        (info.def.name && info.def.name !== "default"
          ? info.def.name
          : path.basename(info.def.file).replace(/\.[jt]sx?$/, ""))
      const frozenFor = (attr) =>
        deadSites.filter(
          (d) => (d.component === tag || d.component === defName) && d.attr === attr
        )
      const dead = []
      for (const a of classAttrs) {
        const attr = a.node.name.name
        const classes = classesText(a, code)
        const frozen = frozenFor(attr)
        if (frozen.length) {
          const asFrozen = frozen.some((d) => d.classes === classes)
          dead.push({
            a,
            detail:
              (asFrozen
                ? `dead at e30b19a: delete the class first. At e30b19a NativeWind wrapped <${tag}> here and handed it these classes as a style it didn't read, so they drew nothing; pass 1 keeps them that way, and a style or a twin would draw them`
                : `dead at e30b19a, changed since: delete the class first. At e30b19a NativeWind wrapped every <${frozen[0].component}> ${attr} in this file and handed it its classes as a style it didn't read, so they drew nothing; these classes (${classes}) aren't any of e30b19a's (${[...new Set(frozen.map((d) => d.classes))].join("; ")}), so they were edited or added since. Pass 1 keeps them refused: a style or a twin would draw them. Delete them, or convert by hand a class that must draw`) +
              (info.kind === "component" && !readsNoStyle()
                ? ` (<${tag}> may read style now)`
                : ""),
          })
        } else if (attr === "className" && wrapped && readsNoStyle())
          dead.push({
            a,
            detail: `NativeWind wraps <${tag}> here (an import it can't trace to a folder), so it gets className as style, and ${info.def.name} reads no style: those classes draw nothing today. Delete them (latent) rather than move them to a twin`,
          })
      }
      for (const { a, detail } of dead)
        record({
          ...base,
          line: a.node.loc.start.line,
          attr: a.node.name.name,
          status: "left",
          reason: "wrapped-ignores-style",
          detail,
        })
      if (dead.length) {
        classAttrs = classAttrs.filter((a) => !dead.some((d) => d.a === a))
        if (classAttrs.length === 0) return
      }
      // What a left class prop that the wrap passed on as written says first:
      // it draws today (unless the component never reads it).
      const rawNote = (attrName, reason) =>
        wrapped &&
        info.kind === "component" &&
        attrName !== "className" &&
        !["not-a-prop", "discarded-by-component", "hand-edit"].includes(reason)
          ? `NativeWind's wrap turns only className into style, so \`${attrName}\` reaches <${tag}> as written and draws today: keep it. `
          : ""

      const leaveAll = (reason, detail) => {
        for (const a of classAttrs)
          record({
            ...base,
            line: a.node.loc.start.line,
            attr: a.node.name.name,
            status: "left",
            reason,
            detail,
          })
        if (classAttrs.length === 0)
          record({ ...base, line, attr: null, status: "left", reason, detail })
      }
      const table = new AtomTable(code)
      const inlined = new Set()
      const resolveIdentifier = makeIdentifierResolver(
        file,
        code,
        table,
        clsxNames,
        inlined
      )
      const irOf = (attrPath) => {
        if (!attrPath) return null
        const v = attrPath.node.value
        if (!v)
          throw new Dynamic("a class attribute with no value", attrPath.node)
        if (v.type === "StringLiteral") return { t: "str", v: v.value }
        if (v.type !== "JSXExpressionContainer")
          throw new Dynamic("an unexpected class attribute value", v)
        return buildIR(attrPath.get("value.expression"), table, {
          clsxNames,
          resolveIdentifier,
        })
      }
      const hint = hintFor(openingPath, tag, info.kind)
      const attrs = attrsByName(openingPath)

      // The element is fully converted: its clsx calls are gone with it.
      const done = () => {
        converted.add(node)
        forgetClsx(classAttrs)
        for (const a of classAttrs) removedAttrs.add(a.node)
        for (const b of inlined) inlinedBindings.add(b)
      }

      const cp = registry.checkpoint()
      const looksBefore = looks.length
      const editsBefore = edits.length
      try {
        // A component's own text slot: its className and fontClassName pass
        // the component's caller's classes on, so they convert at the call
        // sites (a spread there is the text's own type).
        if (isClassNameText(openingPath, file)) {
          const forwarded = []
          for (const a of classAttrs)
            try {
              irOf(a)
            } catch (error) {
              if (!(error instanceof Dynamic)) throw error
              const v = a.node.value
              const e = v.type === "JSXExpressionContainer" ? v.expression : v
              forwarded.push(code.slice(e.start, e.end))
            }
          if (forwarded.length < classAttrs.length)
            throw new Unconvertible(
              "text-slot-class",
              `a class written on <${tag}>, tappler-shared's text slot (ClassNameText): give the text its own props by hand`
            )
          throw new Dynamic(
            `<${tag}> is tappler-shared's text slot (ClassNameText), and \`${forwarded[0]}\` comes from this component's caller: it converts at the call sites`
          )
        }
        if (hasSpread(openingPath))
          throw new Unconvertible(
            "spread-props",
            "the element spreads props, which may carry className or style"
          )
        if (wrapped && (info.kind === "dmtext" || info.kind === "actionbtn"))
          throw new Unconvertible(
            "wrapped-today",
            `NativeWind wraps this ${info.kind === "dmtext" ? "DmText" : "ActionBtn"} at the call site today, so it gets style and no className (a BUG for ds:probe): fix it by hand`
          )

        if (info.kind === "dmtext") {
          for (const a of classAttrs)
            if (a.node.name.name !== "className")
              throw new Unconvertible(
                "unknown-attr",
                `\`${a.node.name.name}\` on DmText`
              )
          if (attrs.onPress)
            throw new Unconvertible(
              "pressable-dmtext",
              "DmText wraps a pressable text in a Pressable; Text puts onPress on the text itself, a different host tree"
            )
          const clash = TEXT_PROPS.find((n) => attrs[n])
          if (clash)
            throw new Unconvertible(
              "prop-collision",
              `\`${clash}\` would become a Text token prop`
            )
          const ir = irOf(attrs.className)
          // Typography in the element's own style: read it, so it can join
          // the props (textstyle.js); anything it can't read stays.
          const styleOk = checkStyleAttr(attrs.style, file)
          const textStyle =
            !styleOk.ok && styleOk.code === "typography-in-style"
              ? readTextStyle(attrs.style, { file, code, ds })
              : null
          const result = convertDmText({
            ds,
            ir,
            table,
            registry,
            hint,
            existingStyleOk: textStyle ? textStyle : styleOk,
            styleLayer: textStyle && textStyle.ok ? textStyle : null,
          })
          checkConditionUse(table, [
            ...condRefs(result.styleExpr),
            ...result.refs,
          ])
          emitElement({
            openingPath,
            rename: nameFor.Text,
            placements: [
              {
                attr: attrs.className || null,
                attrs: result.attrs,
                withStyle: true,
              },
            ],
            styleExpr: result.styleExpr,
            styleAttr: attrs.style,
            replaceStyle: result.replacesStyle,
          })
          uses.Text = true
          if (result.uses.px) uses.px = true
          done()
          for (const a of classAttrs)
            record({
              ...base,
              line: a.node.loc.start.line,
              attr: "className",
              status: "converted",
              combos: result.combos,
              flags: result.counts,
              dropped: result.dropped,
              deadStyle: result.deadStyle,
            })
          if (classAttrs.length === 0)
            record({
              ...base,
              line,
              attr: null,
              status: "converted",
              combos: result.combos,
              flags: result.counts,
              dropped: [],
              deadStyle: result.deadStyle,
            })
          pushLatent(classAttrs[0], tag, result.dropped)
          pushLatent(attrs.style, tag, result.deadStyle)
          return
        }

        if (info.kind === "actionbtn") {
          const hasChildren = (elementOf(openingPath).node.children || []).some(
            (c) => !(c.type === "JSXText" && c.value.trim() === "")
          )
          // Without onPress, ActionBtn's View still carries `disabled` and
          // Button's doesn't: a listed delta (native ignores the prop).
          const result = convertActionBtn({
            ds,
            attrs,
            irOf: (n) => irOf(attrs[n]),
            table,
            registry,
            hint,
            hasChildren,
            lookConst,
            proven: options.provenLooks,
          })
          checkConditionUse(table, [
            ...condRefs(result.styleExpr),
            ...result.refs,
          ])
          // Every prop where the first class attribute was; the other class
          // attributes and the ones that became props go.
          const first = attrs.className || attrs.textClassName || null
          const placements = [
            { attr: first, attrs: result.attrs, withStyle: true },
          ]
          for (const n of ["className", "textClassName", ...result.removed])
            if (attrs[n] && attrs[n] !== first)
              placements.push({ attr: attrs[n], attrs: [], withStyle: false })
          emitElement({
            openingPath,
            rename: nameFor.Button,
            placements,
            styleExpr: result.styleExpr,
            styleAttr: null,
            renameAttrs: result.renames,
          })
          uses.Button = true
          if (result.uses.px) uses.px = true
          done()
          // Each attribute's dropped classes, on its own line: the layout's
          // (className), the label's and the label box's.
          const droppedIn = (a) => result.droppedBy[a.node.name.name] || []
          for (const a of classAttrs)
            record({
              ...base,
              line: a.node.loc.start.line,
              attr: a.node.name.name,
              status: "converted",
              combos: result.combos,
              dropped: droppedIn(a),
            })
          if (classAttrs.length === 0)
            record({
              ...base,
              line,
              attr: null,
              status: "converted",
              combos: result.combos,
              dropped: [],
            })
          for (const a of classAttrs) pushLatent(a, tag, droppedIn(a))
          return
        }

        // Everything else styles from `className` (or a slot).
        const styleTarget = (() => {
          if (info.kind === "intrinsic")
            throw new Unconvertible("unknown-tag", `<${tag}>`)
          if (info.kind === "asset")
            throw new Unconvertible(
              "ignored-today",
              `<${tag}> is an asset (${info.source}): NativeWind leaves its className raw and nothing reads it`
            )
          if (info.kind === "dmview" || info.kind === "host") return "style"
          if (info.kind === "scoped")
            throw new Unconvertible(
              "ignored-today",
              `${info.source} is a package NativeWind leaves alone: the className reaches it raw and is ignored today`
            )
          if (info.kind === "local" || (info.kind === "component" && wrapped)) {
            if (!wrapped)
              throw new Unconvertible(
                "waiting-on-component",
                `same-file <${tag}> that NativeWind doesn't wrap`
              )
            // Wrapped, a component gets className as style (one that reads
            // no style lost its className above) and its other class props
            // as written: those take their slots like an unwrapped one's.
            return info.kind === "component" ? "wrapped-component" : "style"
          }
          if (info.kind === "component") return null
          throw new Unconvertible("unknown-tag", `can't tell what <${tag}> is`)
        })()

        // A twin the site passes under a name the component renamed takes
        // the new one, so a class moving to that twin joins it there.
        const slotted = !styleTarget || styleTarget === "wrapped-component"
        if (slotted && info.def)
          for (const r of twinRenames(info.def, Object.keys(attrs))) {
            const attr = attrs[r.from]
            edits.push({
              start: attr.node.name.start,
              end: attr.node.name.end,
              text: r.to,
            })
            attrs[r.to] = attr
            delete attrs[r.from]
          }

        const slotAttrs = []
        for (const a of classAttrs) {
          const attrName = a.node.name.name
          let slot
          let text = false
          let twin = null
          let asArray = false
          if (
            styleTarget === "style" ||
            (styleTarget === "wrapped-component" && attrName === "className")
          ) {
            if (attrName !== "className")
              throw new Unconvertible(
                "unknown-attr",
                `\`${attrName}\` on <${tag}>, which only NativeWind's className styles`
              )
            slot = "style"
            // NativeWind hands a wrapped component its className as a style
            // array: one that reads `style` as an object draws the classes
            // nothing there, and gets an array written in their place, or
            // is left when its `style` takes no array (styleArrayReads).
            const read =
              styleTarget === "wrapped-component" && info.def
                ? styleArrayReads(info.def)
                : null
            if (read && read.reads && !read.takesArray) {
              record({
                ...base,
                line: a.node.loc.start.line,
                attr: attrName,
                status: "left",
                reason: "waiting-on-component",
                detail: `NativeWind hands <${tag}> its className as a style array, and ${info.def.name} ${read.reads}, so the classes draw nothing there today; written as an object they would draw, and its \`style\` takes no array`,
              })
              continue
            }
            asArray = !!(read && read.reads)
          } else {
            const edit = handEditFor(info.def, attrName, a, attrs)
            if (edit) {
              record({
                ...base,
                line: a.node.loc.start.line,
                attr: attrName,
                status: "left",
                reason: "hand-edit",
                detail: edit,
              })
              continue
            }
            const s = slotFor(info.def, attrName)
            if (!s.ok) {
              record({
                ...base,
                line: a.node.loc.start.line,
                attr: attrName,
                status: "left",
                reason: s.code,
                detail: rawNote(attrName, s.code) + s.detail,
              })
              continue
            }
            const blocked = (s.unless || []).find((n) => attrs[n])
            if (blocked) {
              record({
                ...base,
                line: a.node.loc.start.line,
                attr: attrName,
                status: "left",
                reason: "waiting-on-component",
                detail:
                  rawNote(attrName, "waiting-on-component") +
                  `the call site sets \`${blocked}\`, which comes before ${tag}'s \`${s.slot}\` and would now lose to it`,
              })
              continue
            }
            slot = s.slot
            text = s.text
            twin = s
          }
          slotAttrs.push({
            attrPath: a,
            slot,
            text,
            asArray,
            field: !!(twin && twin.field),
            typeTwin: twin && twin.typeTwin,
            styleType: twin && twin.styleType,
            textModel: twin && twin.textModel,
            parsed: (twin && twin.parsed) || [],
          })
        }
        if (slotAttrs.length === 0) return
        // Convert each class attribute that has a destination.
        const pending = []
        // A field's input and placeholder classes with typography in them
        // write one inputType together.
        const fieldSpec = info.def && FIELDS[info.def.name]
        if (fieldSpec) {
          const of = (name) =>
            slotAttrs.find((x) => x.attrPath.node.name.name === name)
          const field = of(fieldSpec.field)
          const placeholder = of(fieldSpec.placeholder)
          const joint = [field, placeholder].filter(Boolean)
          const cpFields = registry.checkpoint()
          try {
            const irs = {
              field: field ? irOf(field.attrPath) : null,
              placeholder: placeholder ? irOf(placeholder.attrPath) : null,
            }
            if (Object.values(irs).some((ir) => ir && typographyIn(ir))) {
              if (attrs[fieldSpec.typeProp])
                throw new Unconvertible(
                  "prop-collision",
                  `the call site passes \`${fieldSpec.typeProp}\` already`
                )
              const conv = convertFields({
                ds,
                irs,
                table,
                registry,
                hints: {
                  field: `${hint}Input`,
                  placeholder: `${hint}Placeholder`,
                },
                component: info.def.name,
                typeProp: fieldSpec.typeProp,
              })
              const jointPending = []
              joint.forEach((x, i) => {
                const result =
                  conv.styles[x === field ? "field" : "placeholder"]
                const banned = bannedKeys(x.styleType)
                for (const c of result.combos) {
                  const key = Object.keys(c.expected).find((k) => banned.has(k))
                  if (key)
                    throw new Unconvertible(
                      "twin-refuses-key",
                      `\`${x.slot}\` takes no \`${key}\` (${c.r.provenance[key] || key})`
                    )
                }
                jointPending.push({
                  ...x,
                  result,
                  extra: {
                    attrs: i === 0 && conv.typeAttr ? [conv.typeAttr] : [],
                    noStyle: false,
                    px: i === 0 && conv.uses.px,
                  },
                  typeRefs: i === 0 ? conv.refs : [],
                  dead: i === 0 ? conv.dead : [],
                })
              })
              pending.push(...jointPending)
              slotAttrs.splice(
                0,
                slotAttrs.length,
                ...slotAttrs.filter((x) => !joint.includes(x))
              )
            }
          } catch (error) {
            if (
              !(error instanceof Unconvertible) &&
              !(error instanceof Dynamic)
            )
              throw error
            registry.rollback(cpFields)
            for (const x of joint) {
              const reason = error instanceof Dynamic ? "dynamic" : error.code
              record({
                ...base,
                line: x.attrPath.node.loc.start.line,
                attr: x.attrPath.node.name.name,
                status: "left",
                reason,
                detail:
                  rawNote(x.attrPath.node.name.name, reason) +
                  (error instanceof Dynamic ? error.message : error.detail),
              })
            }
            slotAttrs.splice(
              0,
              slotAttrs.length,
              ...slotAttrs.filter((x) => !joint.includes(x))
            )
          }
        }
        for (const s of slotAttrs) {
          // One attribute that can't move doesn't hold back the others.
          const cpAttr = registry.checkpoint()
          try {
            const ir = irOf(s.attrPath)
            const slotKey = s.slot || s.parsed.map((r) => r.prop).join("")
            // A rule's prop carries a key the twin refuses (DmInput's height).
            const consumed = consumedKeys(
              s.parsed,
              assignments([...atomsOf(ir)]).map((env) => evaluate(ir, env))
            )
            const slotHint =
              slotKey === "style"
                ? hint
                : `${hint}${slotKey[0].toUpperCase()}${slotKey.replace(/Style$/, "").slice(1)}`
            let result = styleFromIR(ir, {
              table,
              registry,
              hint: slotHint,
              // a text's and a field's font layers read these tokens
              fontIsDead: !s.text && !s.field,
              exclude: consumed,
            })
            let typed = null
            const typography =
              (s.text || s.field) &&
              result.combos
                .map(
                  (c) =>
                    ["fontSize", "lineHeight", "fontFamily", "fontWeight"].find(
                      (k) => k in c.r.style
                    ) ||
                    // what DmText's takeFontStyles reads from its className:
                    // the face, and in Arabic a 1-2 digit leading-[Npx]
                    (c.str
                      .split(/\s+/)
                      .some((t) =>
                        /custom\d{3}|^leading-\[\d{1,2}px\]$/.test(t)
                      ) &&
                      "a font or leading class")
                )
                .find(Boolean)
            if (typography) {
              const model = s.textModel
              if (!(s.text && s.typeTwin && model && !model.error))
                throw new Unconvertible(
                  "typography-in-text-slot",
                  `\`${s.attrPath.node.name.name}\` lands on a text and carries typography (${typography})${
                    s.typeTwin
                      ? model && model.error
                        ? `: \`${s.typeTwin}\` can't be worked out (${model.error})`
                        : `: it goes in \`${s.typeTwin}\`, which pass 1 doesn't write for a field yet`
                      : ": it needs the component's token props"
                  }`
                )
              if (attrs[s.typeTwin])
                throw new Unconvertible(
                  "prop-collision",
                  `the call site passes \`${s.typeTwin}\` already`
                )
              // The class's typography as the *Type, the rest as the twin.
              registry.rollback(cpAttr)
              typed = convertTextSlot({
                ds,
                ir,
                table,
                registry,
                hint: slotHint,
                model,
                site: (key) => siteValue(attrs[key]),
              })
              result = typed.style
            }
            // What the twin's type refuses can't go there (a type error).
            const banned = bannedKeys(s.styleType)
            for (const c of result.combos) {
              const key = Object.keys(c.expected).find((k) => banned.has(k))
              if (key)
                throw new Unconvertible(
                  "twin-refuses-key",
                  `\`${s.slot}\` takes no \`${key}\` (${c.r.provenance[key] || key})`
                )
            }
            const extra = parsedProps(s.parsed, result, {
              radius: Object.values(ds.radius),
            })
            if (typed && typed.typeAttr) {
              extra.attrs.unshift(typed.typeAttr)
              if (typed.uses.px) extra.px = true
            }
            if (!s.slot && !extra.noStyle)
              throw new Unconvertible(
                "waiting-on-component",
                `${tag} has no style twin for \`${s.attrPath.node.name.name}\``
              )
            pending.push({
              ...s,
              result,
              extra,
              typeRefs: typed ? typed.refs : [],
            })
          } catch (error) {
            if (
              !(error instanceof Unconvertible) &&
              !(error instanceof Dynamic)
            )
              throw error
            registry.rollback(cpAttr)
            const reason = error instanceof Dynamic ? "dynamic" : error.code
            record({
              ...base,
              line: s.attrPath.node.loc.start.line,
              attr: s.attrPath.node.name.name,
              status: "left",
              reason,
              detail:
                rawNote(s.attrPath.node.name.name, reason) +
                (error instanceof Dynamic ? error.message : error.detail),
            })
          }
        }
        if (pending.length === 0) return
        checkConditionUse(
          table,
          pending.flatMap((p) => [...condRefs(p.result.expr), ...p.typeRefs])
        )
        for (const p of pending) {
          if (p.extra.px) uses.px = true
          emitElement({
            openingPath,
            rename: null,
            placements: [
              {
                attr: p.attrPath,
                attrs: p.extra.attrs,
                withStyle: !p.extra.noStyle,
              },
            ],
            styleExpr: p.extra.noStyle ? null : p.result.expr,
            styleAttr: (p.slot && attrs[p.slot]) || null,
            styleName: p.slot,
            asArray: !!p.asArray,
          })
          record({
            ...base,
            line: p.attrPath.node.loc.start.line,
            attr: p.attrPath.node.name.name,
            status: "converted",
            slot: [
              p.extra.noStyle ? null : p.slot,
              ...p.extra.attrs.map((x) => x.split("=")[0]),
            ]
              .filter(Boolean)
              .join(" + "),
            combos: p.result.combos.length,
            dropped: p.result.dropped,
            deadStyle: p.dead || [],
          })
          pushLatent(p.attrPath, tag, p.result.dropped)
          pushLatent(p.attrPath, tag, p.dead || [])
        }
        if (pending.length === classAttrs.length) done()
        else {
          forgetClsx(pending.map((p) => p.attrPath))
          for (const p of pending) removedAttrs.add(p.attrPath.node)
          for (const b of inlined) inlinedBindings.add(b)
        }
      } catch (error) {
        if (!(error instanceof Unconvertible) && !(error instanceof Dynamic))
          throw error
        // Nothing of an abandoned conversion survives: no entries, no looks,
        // no edits.
        registry.rollback(cp)
        looks.length = looksBefore
        edits.length = editsBefore
        return error instanceof Dynamic
          ? leaveAll("dynamic", error.message)
          : leaveAll(error.code, error.detail)
      }
    },
  })

  function pushLatent(attrPath, tag, dropped) {
    for (const d of dropped || [])
      latent.push({
        file: relFile,
        line: attrPath ? attrPath.node.loc.start.line : null,
        tag,
        class: d.class,
        reason: d.reason,
      })
  }

  function lookConst(look) {
    const json = JSON.stringify(look)
    let found = looks.find((l) => l.json === json)
    if (!found) {
      const base = lookName(look)
      const name = freeName(
        names,
        `disabledLook${base}`,
        `dsDisabledLook${base}`
      )
      names.add(name)
      found = { json, name, look }
      looks.push(found)
    }
    return found.name
  }

  /**
   * <Screen header={{ ... }}> hands the object to HeaderOnboarding, so a
   * class key in it follows HeaderOnboarding's slots: `className` becomes
   * `style` (unless the object also sets bordered, gutter or style), the
   * others wait. Pass 1 never writes a <Screen>; this is for the screens
   * converted by hand that still carry a class key there.
   */
  function screenHeader(openingPath, tag) {
    const header = openingPath
      .get("attributes")
      .find((a) => a.isJSXAttribute() && a.node.name.name === "header")
    if (!header) return
    const v = header.get("value")
    if (
      !v.isJSXExpressionContainer() ||
      !v.get("expression").isObjectExpression()
    )
      return
    const info = classifyTag(openingPath, file)
    if (!info.def || rel(info.def.file) !== "src/components/Screen/Screen.tsx")
      return
    const obj = v.get("expression")
    const props = obj.get("properties")
    const keyOf = (p) =>
      p.isObjectProperty() && !p.node.computed
        ? p.node.key.type === "Identifier"
          ? p.node.key.name
          : p.node.key.value
        : null
    const keys = new Set(props.map(keyOf).filter(Boolean))
    for (const p of props) {
      const key = keyOf(p)
      if (!key || !CLASS_ATTR.test(key)) continue
      const base = {
        tag: `${tag} header`,
        kind: "component",
        wrapped: false,
        line: p.node.loc.start.line,
        attr: `header.${key}`,
      }
      const blocked = ["bordered", "gutter", "style"].find((k) => keys.has(k))
      if (key !== "className" || blocked) {
        record({
          ...base,
          status: "left",
          reason: "waiting-on-component",
          detail: blocked
            ? `the header also sets \`${blocked}\`, which HeaderOnboarding's style would now beat`
            : `HeaderOnboarding has no slot for \`${key}\``,
        })
        continue
      }
      const table = new AtomTable(code)
      const cp = registry.checkpoint()
      try {
        const ir = buildIR(p.get("value"), table, {
          clsxNames,
          resolveIdentifier: makeIdentifierResolver(
            file,
            code,
            table,
            clsxNames
          ),
        })
        const result = styleFromIR(ir, {
          table,
          registry,
          hint: "header",
          fontIsDead: true,
        })
        checkConditionUse(table, condRefs(result.expr))
        const refs = refsOf(result.expr)
        if (refs.atoms) uses.a = true
        if (refs.entries) uses.styles = true
        if (refs.rnFill) uses.StyleSheet = true
        if (refs.rnFill) uses.StyleSheet = true
        edits.push(
          result.expr
            ? {
                start: p.node.start,
                end: p.node.end,
                text: `style: ${printStyle(result.expr, printNames, PRINT_OPTS)}`,
              }
            : {
                start: p.node.start,
                end: p.node.end + (code[p.node.end] === "," ? 1 : 0),
                text: "",
              }
        )
        record({
          ...base,
          status: "converted",
          slot: "style",
          combos: result.combos.length,
          dropped: result.dropped,
        })
        latent.push(
          ...result.dropped.map((d) => ({
            file: relFile,
            line: base.line,
            tag: base.tag,
            class: d.class,
            reason: d.reason,
          }))
        )
      } catch (error) {
        if (!(error instanceof Unconvertible) && !(error instanceof Dynamic))
          throw error
        registry.rollback(cp)
        record({
          ...base,
          status: "left",
          reason: error instanceof Dynamic ? "dynamic" : error.code,
          detail: error instanceof Dynamic ? error.message : error.detail,
        })
      }
    }
  }

  function forgetClsx(attrPaths) {
    for (const a of attrPaths)
      a.traverse({
        CallExpression(c) {
          if (
            c.node.callee.type === "Identifier" &&
            clsxNames.has(c.node.callee.name)
          )
            removedClsxCalls.add(c.node)
        },
      })
  }

  /**
   * Writes one element's conversion as edits: the tag, the class
   * attribute(s) (each replaced by its placement's new attributes, or
   * removed), and the style.
   */
  function emitElement(spec) {
    const {
      openingPath,
      rename,
      placements,
      styleExpr,
      styleAttr,
      styleName = "style",
      renameAttr = null,
      renameAttrs = [],
      // Write `styleExpr` as the whole of the existing style attribute
      // (removing the attribute when it is null), instead of putting it
      // before what the attribute already holds.
      replaceStyle = false,
      // Always an array, as NativeWind hands a wrapped component its
      // className (styleArrayReads)
      asArray = false,
    } = spec
    const node = openingPath.node
    if (rename) {
      edits.push({ start: node.name.start, end: node.name.end, text: rename })
      const closing = openingPath.parentPath.node.closingElement
      if (closing)
        edits.push({
          start: closing.name.start,
          end: closing.name.end,
          text: rename,
        })
    }
    for (const r of [...(renameAttr ? [renameAttr] : []), ...renameAttrs])
      edits.push({
        start: r.attr.node.name.start,
        end: r.attr.node.name.end,
        text: r.to,
      })
    const refs = refsOf(styleExpr)
    if (refs.atoms) uses.a = true
    if (refs.entries) uses.styles = true
    if (refs.rnFill) uses.StyleSheet = true
    let styleText = null
    if (replaceStyle && styleAttr) {
      replacedStyles.add(styleAttr.node)
      const e = styleAttr.node.value.expression
      edits.push(
        styleExpr
          ? {
              start: e.start,
              end: e.end,
              text: printStyle(styleExpr, printNames, PRINT_OPTS),
            }
          : removalEdit(code, styleAttr.node)
      )
    } else if (styleExpr) {
      if (styleAttr) {
        const e = styleAttr.node.value.expression
        const items = styleExpr.k === "arr" ? styleExpr.items : [styleExpr]
        const printed = items
          .map((x) => printStyle(x, printNames, PRINT_OPTS))
          .join(", ")
        if (e.type === "ArrayExpression") {
          const at = e.start + 1
          edits.push({
            start: at,
            end: at,
            text: e.elements.length ? `${printed}, ` : printed,
          })
        } else {
          edits.push({ start: e.start, end: e.start, text: `[${printed}, ` })
          edits.push({ start: e.end, end: e.end, text: "]" })
        }
      } else if (asArray && styleExpr.k !== "arr")
        styleText = `${styleName}={[${printStyle(styleExpr, printNames, PRINT_OPTS)}]}`
      else
        styleText = `${styleName}={${printStyle(styleExpr, printNames, PRINT_OPTS)}}`
    }
    for (const place of placements) {
      let style = place.withStyle ? styleText : null
      if (style && place.attr) {
        const sep = attrSeparator(code, place.attr.node)
        const indent = sep.startsWith("\n") ? sep.slice(1) : null
        // One attribute per line already: break a long array the way
        // prettier would, so the file reads the same as its neighbours.
        if (
          indent !== null &&
          styleExpr.k === "arr" &&
          indent.length + style.length > 80
        )
          style = `${styleName}={[\n${styleExpr.items
            .map((x) => `${indent}  ${printStyle(x, printNames, PRINT_OPTS)},`)
            .join("\n")}\n${indent}]}`
      }
      const list = [...place.attrs, ...(style ? [style] : [])]
      if (place.attr) {
        const sep = attrSeparator(code, place.attr.node)
        const text = list.join(sep)
        edits.push(
          text
            ? { start: place.attr.node.start, end: place.attr.node.end, text }
            : removalEdit(code, place.attr.node)
        )
      } else if (list.length) {
        const first = node.attributes[0]
        const sep = first ? attrSeparator(code, first) : " "
        edits.push({
          start: node.name.end,
          end: node.name.end,
          text: `${sep}${list.join(sep)}`,
        })
      }
    }
  }

  // Imports: what the converted elements use, and what they no longer do.
  const q = quoteOf(code, ast)
  const importEdits = []
  let lastImportEnd = 0
  let dsImport = null
  for (const stmt of ast.program.body)
    if (stmt.type === "ImportDeclaration") {
      lastImportEnd = stmt.end
      if (stmt.source.value === DS_SOURCE) dsImport = stmt
    }

  traverse(ast, {
    ImportDeclaration(p) {
      const stmt = p.node
      const removable = p.get("specifiers").filter((s) => {
        const local = s.node.local.name
        const binding = p.scope.getBinding(local)
        if (!binding) return false
        // takeFontFamily, when every call of it was a DmText style whose
        // typography became Text props
        const isFontHelper =
          s.isImportSpecifier() &&
          s.node.imported.name === "takeFontFamily" &&
          /(^|\/)helpers\/helpers$/.test(stmt.source.value)
        const isPrimitive =
          (s.isImportSpecifier() &&
            ["DmText", "ActionBtn"].includes(s.node.imported.name)) ||
          stmt.source.value === "clsx" ||
          isFontHelper
        if (!isPrimitive) return false
        const live = binding.referencePaths.filter((r) => {
          if (stmt.source.value === "clsx")
            return !removedClsxCalls.has(r.parent)
          if (isFontHelper)
            return !r.findParent(
              (x) => x.isJSXAttribute() && replacedStyles.has(x.node)
            )
          const opening = r.findParent(
            (x) => x.isJSXOpeningElement() || x.isJSXClosingElement()
          )
          if (!opening) return true
          const element = opening.isJSXOpeningElement()
            ? opening.node
            : opening.parentPath.node.openingElement
          return !converted.has(element)
        })
        return live.length === 0 && binding.referencePaths.length > 0
      })
      if (removable.length === 0) return
      const keep = stmt.specifiers.filter(
        (s) => !removable.some((r) => r.node === s)
      )
      if (keep.length === 0) {
        const ls = lineStart(code, stmt.start)
        const le = lineEnd(code, stmt.end)
        importEdits.push({
          start: ls,
          end: Math.min(le + 1, code.length),
          text: "",
        })
        return
      }
      importEdits.push({
        start: stmt.start,
        end: stmt.end,
        text: printImport(stmt, keep, code, q),
      })
    },
  })

  // The printers write px() under that name (dmtext, actionbtn, typetwin):
  // under any other, the calls would reach some other binding, or none.
  if (uses.px && nameFor.px !== "px")
    throw new Error(
      `ds-codemod: ${relFile} has its own \`px\` (or imports the design system's as \`${nameFor.px}\`), and the codemod writes px() calls by that name: rename it first`
    )
  const dsNames = []
  // A name the file imports from the design system already isn't added again.
  const importAs = (exported, local) => {
    if (dsImported.get(exported) === local) return
    dsNames.push(local === exported ? exported : `${exported} as ${local}`)
  }
  if (uses.Text) importAs("Text", nameFor.Text)
  if (uses.Button) importAs("Button", nameFor.Button)
  if (uses.a) importAs("a", nameFor.a)
  if (uses.px) importAs("px", nameFor.px)
  const additions = []
  if (dsNames.length) {
    if (dsImport) {
      const existing = dsImport.specifiers.map((s) =>
        code.slice(s.start, s.end)
      )
      const merged = [...new Set([...existing, ...dsNames])]
      importEdits.push({
        start: dsImport.start,
        end: dsImport.end,
        text: `import { ${merged.join(", ")} } from ${q}${DS_SOURCE}${q}`,
      })
    } else
      additions.push(
        `import { ${dsNames.join(", ")} } from ${q}${DS_SOURCE}${q}`
      )
  }
  if (uses.styles && registry.entries.length && plan.mode !== "merge") {
    if (plan.mode === "create")
      additions.push(`import ${stylesLocal} from ${q}./styles${q}`)
    else {
      const spec =
        stylesLocal === plan.exportName
          ? plan.exportName
          : `${plan.exportName} as ${stylesLocal}`
      additions.push(
        `import { ${spec} } from ${q}./${path.basename(plan.file).replace(/\.[jt]sx?$/, "")}${q}`
      )
    }
  }
  if (uses.StyleSheet && !rnStyleSheet) {
    const spec =
      styleSheetName === "StyleSheet"
        ? "StyleSheet"
        : `StyleSheet as ${styleSheetName}`
    const rnEdit =
      rnImport && importEdits.find((e) => e.start === rnImport.start)
    if (
      rnImport &&
      !rnEdit &&
      rnImport.specifiers.length > 0 &&
      rnImport.specifiers.every((sp) => sp.type === "ImportSpecifier")
    )
      importEdits.push({
        start: rnImport.start,
        end: rnImport.end,
        text: printImport(rnImport, rnImport.specifiers, code, q).replace(
          / \}/,
          `, ${spec} }`
        ),
      })
    else additions.push(`import { ${spec} } from ${q}react-native${q}`)
  }
  const lookLines = looks.map(
    (l) => `const ${l.name} = ${printLook(l.look)} as const`
  )
  if (additions.length || lookLines.length) {
    const block = [
      ...additions,
      ...(lookLines.length ? ["", ...lookLines] : []),
    ].join("\n")
    // The last import may itself be rewritten or removed (an unused clsx):
    // the new lines then go into that edit instead of beside it.
    const host = importEdits.find(
      (e) => e.start < lastImportEnd && e.end >= lastImportEnd
    )
    if (host)
      host.text = host.text === "" ? `${block}\n` : `${host.text}\n${block}`
    else
      importEdits.push({
        start: lastImportEnd,
        end: lastImportEnd,
        text: lastImportEnd ? `\n${block}` : `${block}\n`,
      })
  }

  // A class-string constant every use of which was converted is left in
  // place (no edits beyond the rules), and named so it can be deleted.
  const notes = []
  for (const b of inlinedBindings) {
    const live = b.referencePaths.filter(
      (r) =>
        !r.findParent((x) => x.isJSXAttribute() && removedAttrs.has(x.node))
    )
    if (live.length === 0)
      notes.push({
        file: relFile,
        line: b.path.node.loc.start.line,
        note: `\`${b.identifier.name}\` is now unused: its classes moved into styles`,
      })
  }

  const allEdits = [...edits, ...importEdits]
  const changed = allEdits.length > 0
  const out = changed ? applyEdits(code, allEdits) : code
  if (changed) parseCode(out) // must still parse
  const styles =
    registry.entries.length && uses.styles
      ? {
          file: plan.file,
          code: stylesOutput(plan, registry, q),
          mode: plan.mode,
          created: plan.mode === "create",
        }
      : null
  return { code: out, styles, sites, latent, notes, changed }
}

const lastName = (src) => {
  const m = src.match(/[A-Za-z_$][\w$]*(?=\)*$)/)
  return m ? m[0] : ""
}

// `cond && x` in a style array only type-checks when cond is a boolean (a
// number would put 0 there); anything that doesn't look boolean is printed
// as `cond ? x : undefined`.
const PRINT_OPTS = {
  booleanish: (c) =>
    c.neg ||
    BOOLEAN_NAME.test(lastName(c.src)) ||
    /[=!]==?|[<>]=?|\binstanceof\b/.test(c.src),
}

const printImport = (stmt, specifiers, code, q) => {
  const def = specifiers.find((s) => s.type === "ImportDefaultSpecifier")
  const ns = specifiers.find((s) => s.type === "ImportNamespaceSpecifier")
  const named = specifiers
    .filter((s) => s.type === "ImportSpecifier")
    .map((s) => code.slice(s.start, s.end))
  const parts = []
  if (def) parts.push(def.local.name)
  if (ns) parts.push(`* as ${ns.local.name}`)
  if (named.length) parts.push(`{ ${named.join(", ")} }`)
  const kind = stmt.importKind === "type" ? "type " : ""
  return `import ${kind}${parts.join(", ")} from ${q}${stmt.source.value}${q}`
}

// A disabled look's name: its surface, label and label weight
// (`LegacyMutedRegular`); a label-only look (off primary and yellow) has no
// surface (`Muted`).
const lookName = (look) => {
  const cap = (w) => (w ? `${w[0].toUpperCase()}${w.slice(1)}` : "")
  return `${cap(look.surface)}${cap(look.label)}${cap(look.labelWeight)}`
}

const printLook = (look) =>
  `{ ${Object.entries(look)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ")} }`

module.exports = {
  DEAD_AT_E30B19A,
  convertSource,
  classifyTag,
  applyEdits,
  lookName,
  CLASS_ATTR,
}
