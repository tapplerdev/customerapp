#!/usr/bin/env node
/**
 * yarn ds:ratchet [--strict <glob> ...] [--strict-metrics m,m] [--allow Name,Name ...] [--json]
 * yarn ds:ratchet --update [--accept-rises]
 *
 * Keeps the NativeWind -> StyleSheet migration moving one way. It counts,
 * per file (and adds up per directory), from the AST:
 *
 *   className        JSX attributes named className, className* (the
 *                    classNameTitle-style slot props), *ClassName
 *                    (textClassName) or tw (NativeWind's other class prop,
 *                    which its wrapper strips like className)
 *   px()             calls to px, the off-scale escape of the token layer
 *   legacy           leading="legacy", pass 1's "today's line height", and
 *                    its object forms: Text's unscaled leading={{ fixed:
 *                    px(n) }} and the size-class leading={{ legacy: px(n) }}
 *                    (and Button's labelLeading="legacy" / {{ legacy: px(n) }}),
 *                    also as a *Type's leading (titleType={{ leading: ... }})
 *   family="system"  pass 1's system-font parity for DmText sites with no
 *                    font class, also as a *Type's family
 *   colour literals  "#hex", rgb()/hsl() and named colours in the value of a
 *                    *color/*Color key of an object (style objects,
 *                    StyleSheet.create, inline style={{...}}) or of a
 *                    *color/*Color JSX attribute (`color="#999"`,
 *                    placeholderTextColor, backdropColor): each literal
 *                    anywhere in that value, with no function or statement
 *                    between, so every branch of a ternary or && counts on
 *                    its own (`color: on ? "#fff" : "#000"` is two), and
 *                    `transparent` never (it is no colour anyone would
 *                    tokenise). That is how src comes to 161 (149 in objects,
 *                    12 in attributes, which counted nothing before
 *                    review-ca-w0's T re-check, L5).
 *   DmText/ActionBtn <DmText> and <ActionBtn> elements, with or without a
 *                    className, under any local name the file gives them
 *                    (namesOf, a `const Y = memo(DmText)` and a
 *                    `const { DmText: Y } = NS` included), and
 *                    createElement(DmText, ...) and jsx(DmText, ...) calls
 *   LegacyText       <LegacyText> elements (`bridge`): tappler-shared's
 *                    LegacyText (src/components/LegacyText, a default
 *                    export), the pass-1 stand-in for a DmText ds Text can't
 *                    express yet, under its name or any local name the file
 *                    gives it (namesOf)
 *
 * and, in app code only (not src/testing, whose harnesses build classes and
 * DmTexts on purpose, as controls), what would let a class or a DmText back
 * in without a JSX attribute or element to count (W3 plan §5.1, skeptic S9):
 *
 *   className keys   className-family keys in an object literal
 *                    (`{ className: "mt-[4]" }` handed to createElement, a
 *                    spread or a props object), named like the className
 *                    metric, as a name, a string or a template with nothing
 *                    in it (`[\`className\`]`); not a destructuring pattern;
 *                    and the same key set as a member
 *                    (`extra.className = "mt-[4]"`)
 *   className prop types  className-family property signatures
 *                    (`className?: string` in a Props type or interface):
 *                    each lets a call site hand over a class that draws
 *                    nothing
 *   nativewind/clsx imports  an import, re-export, require() or import() of
 *                    `nativewind` (or a subpath) or `clsx`
 *   DmText/ActionBtn imports  DmText or ActionBtn brought in from
 *                    tappler-shared: by name from a barrel, or its own
 *                    module's default (also re-exported, or required), by
 *                    `@tappler/shared/...` or a relative path into
 *                    ../tappler-shared, with or without an extension; or
 *                    handed on by a file of the app (`export { DmText as
 *                    Txt }`, `export const T = DmText`, `export default
 *                    DmText`), which another file then uses under a name
 *                    nothing here knows; a type-only import is none
 *
 * and compares against scripts/style-ratchet-baseline.json:
 *
 * - className may only fall, file by file.
 * - px(), legacy and family="system" are what pass 1 writes INSTEAD of a
 *   className, or of a bare DmText/ActionBtn (`<DmText>` with no className
 *   becomes `<Text size={14} leading="legacy">`), so each may rise only in a
 *   file whose className count or DmText/ActionBtn count falls.
 * - colour literals may only fall.
 * - DmText/ActionBtn elements may only fall, file by file (so one moved to
 *   another file can't pay for anything there).
 * - LegacyText may rise only in a file whose DmText/ActionBtn count falls by
 *   at least as much (each one replaces a DmText), and nowhere else.
 * - className keys, className prop types, nativewind/clsx imports and
 *   DmText/ActionBtn imports may only fall, file by file. Since W3.4 every
 *   one of them is 0, as are className and DmText/ActionBtn: the "holds for
 *   this tree" test in scripts/__tests__/style-ratchet.test.js checks those
 *   six totals are 0 on every `yarn test`, whatever the baseline says, and so
 *   does `yarn ds:ratchet` on this tree's own baseline, so `--update
 *   --accept-rises` can't bring one back.
 * - --strict <glob> (repeatable): in matching files className, px() and
 *   legacy must be 0, except on the components named by --allow, the legacy
 *   ones a converted screen still has to hand a className (MainModal, DmInput,
 *   ...). An occurrence belongs to a component when it is one of that
 *   element's own attributes, or sits inside one. --strict-metrics names what
 *   must be 0 instead, any of the counts above by its key (className, px,
 *   legacy, familySystem, colorLiteral, primitives, bridge): `--strict-metrics
 *   className` wants no className left, px() and legacy being what pass 1
 *   writes on purpose; `--strict-metrics className,primitives` wants no
 *   <DmText> or <ActionBtn> either, with or without a className, as an area
 *   needs before W3 (a primitive is its own element: --allow DmText exempts
 *   it).
 *
 * The files: every .js/.jsx/.ts/.tsx under --dir (src) but tests, mocks and
 * fixtures (__tests__, __mocks__, __fixtures__, *.test.*, *.spec.*), and
 * any file of the app that an app file imports from one of those or from
 * outside --dir (followed import by import; src/testing's imports are not
 * followed): a class moved into one is still the app's.
 *
 * A file that is new counts from 0, so new code can't add className. When
 * counts have fallen, --update writes them into the baseline to lock the
 * gain in; it refuses while anything rose (a rename, say) unless
 * --accept-rises is given, so a rise is always a decision in the diff.
 *
 * The className pattern is wider than the design-system plan's
 * /^className$|ClassName$/, which misses the prefix slots (classNameTitle,
 * classNameDescr, classNameModal...: 324 attributes in src, 22 of them in
 * My Account).
 *
 * Exit 0: within the ratchet. Exit 1: a rise or a strict violation. Exit 2:
 * no baseline, a file that doesn't parse, or bad usage.
 */
const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")
const DEFAULT_BASELINE = path.join(__dirname, "style-ratchet-baseline.json")
const DEFAULT_DIRS = ["src"]

// className, a className* slot (classNameTitle), a *ClassName slot, or tw.
const CLASSNAME_ATTR = /^className|^tw$|ClassName$/

// src/testing is jest's: its harnesses build classes and DmTexts on purpose
// (the no-NativeWind controls), so the app-only counts leave it out.
const JEST_ONLY = /^src\/testing\//

const METRICS = [
  "className",
  "px",
  "legacy",
  "familySystem",
  "colorLiteral",
  "primitives",
  "bridge",
  "classKey",
  "classProp",
  "classImport",
  "primitiveImport",
]
const LABEL = {
  className: "className",
  px: "px()",
  legacy: 'leading="legacy"',
  familySystem: 'family="system"',
  colorLiteral: "colour literals",
  primitives: "DmText/ActionBtn",
  bridge: "LegacyText",
  classKey: "className keys",
  classProp: "className prop types",
  classImport: "nativewind/clsx imports",
  primitiveImport: "DmText/ActionBtn imports",
}
// Counted in app code only (JEST_ONLY), and may only fall.
const APP_ONLY = ["classKey", "classProp", "classImport", "primitiveImport"]
// The totals that are 0 since W3.4, checked absolutely: by the ratchet's test,
// and by the CLI on this tree's own baseline.
const ZERO_SINCE_W3 = ["className", "primitives", ...APP_ONLY]
// `nativewind` (or a subpath) and `clsx`.
const CLASS_MODULE = /^(?:nativewind|clsx)(?:\/|$)/
// What pass 1 writes in place of a className or a bare DmText/ActionBtn.
const BRIDGES = ["px", "legacy", "familySystem"]
const STRICT_METRICS = ["className", "px", "legacy"]
// The elements whose conversion may bring a bridge with no className.
const PRIMITIVES = new Set(["DmText", "ActionBtn"])
// LegacyText: tappler-shared's own folder, src/components/LegacyText, whose
// default export it is.
const LEGACY_TEXT = "LegacyText"

// The modules that re-export shared's components by name.
const SHARED_BARRELS = new Set([
  "@tappler/shared",
  "@tappler/shared/src",
  "@tappler/shared/src/index",
  "@tappler/shared/src/components",
  "@tappler/shared/src/components/index",
  "@tappler/shared/src/components/UI",
  "@tappler/shared/src/components/UI/index",
])
// A shared component's own module (its folder, the folder's index or its
// file), which exports it as the default.
const ownModule = (component) =>
  new RegExp(
    `^@tappler/shared/src/components/(?:UI/)?${component}(?:/(?:index|${component}))?$`
  )

// tappler-shared, the sibling Metro's watchFolders resolve a relative path
// into.
const SHARED_ROOT = path.join(ROOT, "..", "tappler-shared")

/**
 * An import's source as the barrels and own modules above are spelled: a
 * relative path that lands in ../tappler-shared as `@tappler/shared/...`,
 * and an extension or a trailing `/index` left off (`.../DmText/DmText.tsx`
 * is DmText's own module).
 */
const sharedForm = (source, filename) => {
  let s = source
  if (s.startsWith(".") && filename) {
    const abs = path.resolve(path.dirname(path.resolve(filename)), s)
    const inShared = path.relative(SHARED_ROOT, abs)
    if (!inShared.startsWith("..") && !path.isAbsolute(inShared))
      s = posix(path.join("@tappler/shared", inShared))
  }
  return s.replace(/\.(tsx?|jsx?)$/, "").replace(/\/index$/, "")
}

/**
 * Every name `component` goes by in a file: its own; a named import of it
 * from a shared barrel, renamed or not; its own module's default export
 * (\`import X from\`, \`{ default as X }\`); a namespace import of either
 * (\`<NS.DmText>\`, \`<NS.default>\`); and \`const Y = X\` of any of those.
 * A source is read as sharedForm spells it.
 */
const namesOf = (ast, component, filename) => {
  const names = new Set([component])
  const own = ownModule(component)
  for (const stmt of ast.program.body) {
    if (stmt.type !== "ImportDeclaration" || stmt.importKind === "type") continue
    const source = sharedForm(stmt.source.value, filename)
    const barrel = SHARED_BARRELS.has(source)
    const home = own.test(source)
    if (!barrel && !home) continue
    for (const sp of stmt.specifiers) {
      if (sp.importKind === "type") continue
      if (sp.type === "ImportNamespaceSpecifier") {
        names.add(`${sp.local.name}.${barrel ? component : "default"}`)
        continue
      }
      const imported =
        sp.type === "ImportDefaultSpecifier"
          ? "default"
          : sp.imported.name || sp.imported.value
      if (imported === component || (home && imported === "default"))
        names.add(sp.local.name)
    }
  }
  return names
}

/** Is `source` a shared barrel, or DmText's or ActionBtn's own module? */
const primitiveSource = (raw, filename) => {
  const source = sharedForm(raw, filename)
  if (SHARED_BARRELS.has(source)) return { barrel: true, own: null }
  for (const component of PRIMITIVES)
    if (ownModule(component).test(source))
      return { barrel: false, own: component }
  return null
}

/**
 * How many DmText/ActionBtn bindings an import or re-export brings in from
 * tappler-shared: a barrel's `DmText`/`ActionBtn` by name, or its own
 * module's default (named `default`, or a namespace of it). A type-only one
 * brings in nothing that renders.
 */
const primitiveBindings = (node, filename) => {
  if (!node.source || node.importKind === "type" || node.exportKind === "type")
    return 0
  const from = primitiveSource(node.source.value, filename)
  if (!from) return 0
  if (node.type === "ExportAllDeclaration") return 1
  return (node.specifiers || []).filter((sp) => {
    if (sp.importKind === "type" || sp.exportKind === "type") return false
    if (
      sp.type === "ImportNamespaceSpecifier" ||
      sp.type === "ExportNamespaceSpecifier"
    )
      return !!from.own
    if (sp.type === "ImportDefaultSpecifier") return !!from.own
    // ImportSpecifier's `imported`, ExportSpecifier's `local`
    const named = sp.imported || sp.local
    const name = named && (named.name || named.value)
    return from.barrel
      ? PRIMITIVES.has(name)
      : name === "default" || name === from.own
  }).length
}

/** A key's name: `className`, `"className"`, `["className"]`, `[\`className\`]`; else null. */
const keyName = (node) => {
  const k = node.key
  if (k.type === "StringLiteral") return k.value
  if (k.type === "TemplateLiteral" && k.expressions.length === 0)
    return k.quasis[0].value.cooked
  return !node.computed && k.type === "Identifier" ? k.name : null
}

/** `X` or `NS.X` as namesOf spells a name, or null. */
const nameOf = (n) =>
  n.type === "Identifier"
    ? n.name
    : n.type === "MemberExpression" &&
        !n.computed &&
        n.object.type === "Identifier"
      ? `${n.object.name}.${n.property.name}`
      : null

/**
 * Re-bindings anywhere in the file, as [Y, X]: `const Y = X`; `const Y =
 * memo(X)` or any call that takes X first (a component wrapped, as
 * React.memo(DmText) is); and `const { X: Y } = NS`, which is `NS.X`
 * (review-ca-w0, the T re-check's L5: a destructured namespace and a
 * memo'd DmText counted nothing).
 */
const rebindingsOf = (ast) => {
  const traverse = require("@babel/traverse").default
  const pairs = []
  traverse(ast, {
    VariableDeclarator(p) {
      const { id, init } = p.node
      if (!init) return
      if (id.type === "Identifier") {
        const name =
          nameOf(init) ||
          (init.type === "CallExpression" &&
            init.arguments[0] &&
            nameOf(init.arguments[0]))
        if (name) pairs.push([id.name, name])
        return
      }
      if (id.type !== "ObjectPattern" || init.type !== "Identifier") return
      for (const prop of id.properties) {
        if (prop.type !== "ObjectProperty") continue
        const key = keyName(prop)
        const value =
          prop.value.type === "AssignmentPattern" ? prop.value.left : prop.value
        if (key && value.type === "Identifier")
          pairs.push([value.name, `${init.name}.${key}`])
      }
    },
  })
  return pairs
}

/** `names` grown by the re-bindings of any of them, until nothing is new. */
const withRebindings = (names, pairs) => {
  let grew = true
  while (grew) {
    grew = false
    for (const [alias, of] of pairs)
      if (names.has(of) && !names.has(alias)) {
        names.add(alias)
        grew = true
      }
  }
  return names
}

const NAMED_COLOURS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue " +
    "blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk " +
    "crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki " +
    "darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
    "darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue " +
    "dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite " +
    "gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki " +
    "lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen " +
    "lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen " +
    "magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen " +
    "mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream " +
    "mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid " +
    "palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum " +
    "powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown " +
    "seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen " +
    "steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen"
  ).split(" ")
)
// `transparent` is not a colour choice anyone would tokenise.
// (A template literal with an invalid escape has no cooked value: null.)
const isColourLiteral = (s) =>
  typeof s === "string" &&
  (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s) ||
    /^(rgba?|hsla?)\(/i.test(s.trim()) ||
    NAMED_COLOURS.has(s.toLowerCase()))

// ---------------------------------------------------------------------------
// Counting one file

const elementName = (n) => {
  if (n.type === "JSXIdentifier") return n.name
  if (n.type === "JSXMemberExpression")
    return `${elementName(n.object)}.${n.property.name}`
  if (n.type === "JSXNamespacedName")
    return `${n.namespace.name}:${n.name.name}`
  return "?"
}

const attrString = (attr) => {
  const v = attr.value
  if (!v) return null
  if (v.type === "StringLiteral") return v.value
  if (v.type === "JSXExpressionContainer") {
    const e = v.expression
    if (e.type === "StringLiteral") return e.value
    if (e.type === "TemplateLiteral" && e.expressions.length === 0)
      return e.quasis[0].value.cooked
  }
  return null
}

// leading="legacy", and also leading={isAr ? "legacy" : undefined}: the
// attribute counts once if the word appears anywhere in its value.
const mentions = (attrPath, word) => {
  if (attrString(attrPath.node) === word) return true
  const value = attrPath.get("value")
  if (!value.isJSXExpressionContainer()) return false
  let found = false
  value.traverse({
    StringLiteral(q) {
      if (q.node.value === word) {
        found = true
        q.stop()
      }
    },
    TemplateLiteral(q) {
      if (
        q.node.expressions.length === 0 &&
        q.node.quasis[0].value.cooked === word
      ) {
        found = true
        q.stop()
      }
    },
  })
  return found
}

// labelLeading={{ legacy: px(14) }}, leading={{ fixed: px(20) }}: an object
// in the value keyed `word`.
const hasKey = (attrPath, word) => {
  const value = attrPath.get("value")
  if (!value.isJSXExpressionContainer()) return false
  let found = false
  value.traverse({
    ObjectProperty(q) {
      const k = q.node.key
      if (
        !q.node.computed &&
        ((k.type === "Identifier" && k.name === word) ||
          (k.type === "StringLiteral" && k.value === word))
      ) {
        found = true
        q.stop()
      }
    },
  })
  return found
}

// The element whose attributes an occurrence sits in, if any.
const ownerOf = (p) => {
  const attr = p.findParent((q) => q.isJSXAttribute())
  return attr ? elementName(attr.parent.name) : null
}

// A colour-literal string counts when it is (inside) the VALUE of a
// *color/*Color object property or JSX attribute (`<ActivityIndicator
// color="#CC0000" />`, which counted nothing: review-ca-w0, the T re-check's
// L5), without a function or statement between.
const colourProperty = (p) => {
  const stop = p.findParent(
    (q) =>
      q.isObjectProperty() ||
      q.isFunction() ||
      q.isStatement() ||
      q.isJSXAttribute()
  )
  if (stop && stop.isJSXAttribute()) {
    const attr = stop.node.name
    return attr.type === "JSXIdentifier" && /color$/i.test(attr.name)
      ? stop
      : null
  }
  if (!stop || !stop.isObjectProperty() || stop.parentPath.isObjectPattern())
    return null
  const { key, computed } = stop.node
  const name = computed
    ? null
    : key.type === "Identifier"
      ? key.name
      : key.type === "StringLiteral"
        ? key.value
        : null
  if (!name || !/color$/i.test(name)) return null
  const value = stop.get("value")
  return p === value || p.isDescendant(value) ? stop : null
}

// What makes an element without JSX: React's createElement, and the JSX
// runtime's functions (react/jsx-runtime, react/jsx-dev-runtime), however
// imported (`_jsx` as compiled).
const ELEMENT_CALLS = /^(createElement|_?jsxs?|_?jsxDEV)$/

const parserPlugins = (filename) =>
  /\.tsx$/.test(filename)
    ? ["jsx", "typescript"]
    : /\.ts$/.test(filename)
      ? ["typescript"]
      : ["jsx"]

const countSource = (code, filename = "file.tsx") => {
  const parser = require("@babel/parser")
  const traverse = require("@babel/traverse").default
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: parserPlugins(filename),
  })
  const occurrences = []
  // className?: string in a Props type or interface: reported, not gated.
  const classNameProps = []
  // Every module the file imports, re-exports from or requires (scan follows
  // the app's own into files the walk leaves out).
  const imports = []
  const add = (metric, node, owner) =>
    occurrences.push({
      metric,
      line: node.loc.start.line,
      owner: owner || null,
    })
  const literal = (p, value) => {
    if (isColourLiteral(value) && colourProperty(p))
      add("colorLiteral", p.node, ownerOf(p))
  }
  // Every name DmText, ActionBtn and LegacyText go by here (namesOf), each
  // counted, and owned, as the component it is.
  const pairs = rebindingsOf(ast)
  const primitiveOf = new Map()
  for (const component of PRIMITIVES)
    for (const name of withRebindings(namesOf(ast, component, filename), pairs))
      primitiveOf.set(name, component)
  const legacyText = withRebindings(namesOf(ast, LEGACY_TEXT, filename), pairs)
  // A tag as JSX or createElement names it: `T`, `UI.DmText`.
  const tagName = (n) =>
    n.type === "Identifier"
      ? n.name
      : n.type === "MemberExpression" &&
          !n.computed &&
          n.object.type === "Identifier"
        ? `${n.object.name}.${n.property.name}`
        : null
  traverse(ast, {
    JSXOpeningElement(p) {
      const name = elementName(p.node.name)
      if (primitiveOf.has(name))
        add("primitives", p.node, primitiveOf.get(name))
      if (legacyText.has(name)) add("bridge", p.node, LEGACY_TEXT)
    },
    JSXAttribute(p) {
      if (p.node.name.type !== "JSXIdentifier") return
      const { name } = p.node.name
      const owner = elementName(p.parent.name)
      if (CLASSNAME_ATTR.test(name)) add("className", p.node, owner)
      // Text's leading="legacy", its unscaled { fixed: px(n) } and its
      // size-class { legacy: px(n) }, and Button's labelLeading="legacy" and
      // { legacy: px(n) } (ActionBtn's label quirk); each object holds a
      // px() too
      else if (
        (name === "leading" || name === "labelLeading") &&
        (mentions(p, "legacy") || hasKey(p, "legacy") || hasKey(p, "fixed"))
      )
        add("legacy", p.node, owner)
      else if (name === "family" && mentions(p, "system"))
        add("familySystem", p.node, owner)
      // A *Type's leading counts as the prop's would: titleType={{ size: 15,
      // leading: "legacy" }}, { legacy: px(n) }, { fixed: px(n) }; and its
      // family "system".
      else if (/Type$/.test(name)) {
        const value = p.get("value")
        if (!value.isJSXExpressionContainer()) return
        value.traverse({
          ObjectProperty(q) {
            const k = q.node.key
            const key = q.node.computed
              ? null
              : k.type === "Identifier"
                ? k.name
                : k.type === "StringLiteral"
                  ? k.value
                  : null
            const v = q.get("value")
            const says = (word) =>
              (v.isStringLiteral() && v.node.value === word) ||
              (v.isTemplateLiteral() &&
                v.node.expressions.length === 0 &&
                v.node.quasis[0].value.cooked === word)
            const keyed = (word) =>
              v.isObjectExpression() &&
              v.node.properties.some(
                (x) =>
                  x.type === "ObjectProperty" &&
                  !x.computed &&
                  ((x.key.type === "Identifier" && x.key.name === word) ||
                    (x.key.type === "StringLiteral" && x.key.value === word))
              )
            if (
              key === "leading" &&
              (says("legacy") || keyed("legacy") || keyed("fixed"))
            )
              add("legacy", q.node, owner)
            else if (key === "family" && says("system"))
              add("familySystem", q.node, owner)
          },
        })
      }
    },
    TSPropertySignature(p) {
      const name = keyName(p.node)
      if (name && CLASSNAME_ATTR.test(name)) {
        classNameProps.push({ name, line: p.node.loc.start.line })
        add("classProp", p.node, null)
      }
    },
    // { className: "mt-[4]" }: a class that reaches an element with no
    // attribute to count (createElement, a spread, a props object).
    ObjectProperty(p) {
      if (p.parentPath.isObjectPattern()) return
      const name = keyName(p.node)
      if (name && CLASSNAME_ATTR.test(name)) add("classKey", p.node, ownerOf(p))
    },
    // extra.className = "mt-[4]", extra["textClassName"] = ...: the same key,
    // set as a member
    AssignmentExpression(p) {
      const left = p.node.left
      if (left.type !== "MemberExpression") return
      const prop = left.property
      const name = left.computed
        ? prop.type === "StringLiteral"
          ? prop.value
          : prop.type === "TemplateLiteral" && prop.expressions.length === 0
            ? prop.quasis[0].value.cooked
            : null
        : prop.name
      if (name && CLASSNAME_ATTR.test(name)) add("classKey", p.node, null)
    },
    "ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration"(p) {
      const { node } = p
      if (node.source) imports.push(node.source.value)
      if (!node.source) {
        // `export { DmText as Txt }`, `export const Txt = DmText`: a file of
        // the app handing DmText or ActionBtn on, under a name no other file
        // would know for it, so counted here as bringing it in
        if (
          node.type !== "ExportNamedDeclaration" ||
          node.exportKind === "type"
        )
          return
        for (const sp of node.specifiers || [])
          if (
            sp.type === "ExportSpecifier" &&
            sp.exportKind !== "type" &&
            primitiveOf.has(sp.local.name)
          )
            add("primitiveImport", node, null)
        const decl = node.declaration
        if (decl && decl.type === "VariableDeclaration")
          for (const d of decl.declarations)
            if (d.id.type === "Identifier" && primitiveOf.has(d.id.name))
              add("primitiveImport", node, null)
        return
      }
      if (CLASS_MODULE.test(node.source.value)) add("classImport", node, null)
      for (let i = primitiveBindings(node, filename); i > 0; i--)
        add("primitiveImport", node, null)
    },
    ExportDefaultDeclaration(p) {
      const d = p.node.declaration
      if (d.type === "Identifier" && primitiveOf.has(d.name))
        add("primitiveImport", p.node, null)
    },
    TSImportEqualsDeclaration(p) {
      const ref = p.node.moduleReference
      if (
        ref.type === "TSExternalModuleReference" &&
        CLASS_MODULE.test(ref.expression.value)
      )
        add("classImport", p.node, null)
    },
    CallExpression(p) {
      const c = p.node.callee
      if (
        (c.type === "Identifier" && c.name === "px") ||
        (c.type === "MemberExpression" &&
          !c.computed &&
          c.property.name === "px")
      )
        add("px", p.node, ownerOf(p))
      // React.createElement(DmText, ...), and react/jsx-runtime's jsx(DmText,
      // ...) (jsxs, jsxDEV): a DmText with no JSX to count
      const created =
        (c.type === "Identifier" && ELEMENT_CALLS.test(c.name)) ||
        (c.type === "MemberExpression" &&
          !c.computed &&
          ELEMENT_CALLS.test(c.property.name))
      if (created && p.node.arguments[0]) {
        const tag = tagName(p.node.arguments[0])
        if (tag && primitiveOf.has(tag))
          add("primitives", p.node, primitiveOf.get(tag))
        if (tag && legacyText.has(tag)) add("bridge", p.node, LEGACY_TEXT)
      }
      // require("clsx"), import("nativewind"), require() of DmText's or
      // ActionBtn's own module, and `{ DmText } = require(<barrel>)`
      const arg = p.node.arguments[0]
      if (
        !(
          (c.type === "Identifier" && c.name === "require") ||
          c.type === "Import"
        ) ||
        !arg ||
        arg.type !== "StringLiteral"
      )
        return
      imports.push(arg.value)
      if (CLASS_MODULE.test(arg.value)) add("classImport", p.node, null)
      const from = primitiveSource(arg.value, filename)
      if (!from) return
      if (from.own) {
        add("primitiveImport", p.node, null)
        return
      }
      const parent = p.parentPath
      if (
        parent.isMemberExpression({ object: p.node }) &&
        PRIMITIVES.has(parent.node.property.name || parent.node.property.value)
      )
        add("primitiveImport", p.node, null)
      if (
        parent.isVariableDeclarator({ init: p.node }) &&
        parent.node.id.type === "ObjectPattern"
      )
        for (const prop of parent.node.id.properties)
          if (prop.type === "ObjectProperty" && PRIMITIVES.has(keyName(prop)))
            add("primitiveImport", p.node, null)
    },
    StringLiteral(p) {
      literal(p, p.node.value)
    },
    TemplateLiteral(p) {
      if (p.node.expressions.length === 0)
        literal(p, p.node.quasis[0].value.cooked)
    },
  })
  const counts = Object.fromEntries(METRICS.map((m) => [m, 0]))
  for (const o of occurrences) counts[o.metric]++
  return { counts, occurrences, classNameProps, imports }
}

/**
 * The className-family props app code declares (property signatures named
 * like the className metric, outside src/testing), by file: the
 * `classProp` metric's occurrences by name, for the --json report (0 in
 * proapp since its W3.3 strip).
 */
const classNamePropTypes = (result) => {
  const byFile = {}
  for (const [file, r] of Object.entries(result.files)) {
    if (JEST_ONLY.test(file) || !(r.classNameProps || []).length) continue
    byFile[file] = r.classNameProps.map((p) => `${p.name}:${p.line}`)
  }
  const props = Object.values(byFile).reduce((n, list) => n + list.length, 0)
  return { props, files: Object.keys(byFile).length, byFile }
}

// ---------------------------------------------------------------------------
// Scanning, baselines, comparing

const SKIP_DIRS = new Set([
  "node_modules",
  "__tests__",
  "__mocks__",
  "__fixtures__",
])
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : walk(full)
    return /\.[jt]sx?$/.test(e.name) &&
      !/\.d\.ts$|\.(test|spec)\.[jt]sx?$/.test(e.name)
      ? [full]
      : []
  })

const posix = (p) => p.split(path.sep).join("/")

// A file's counts with the app-only metrics left out where jest's code is.
const appOnly = (rel, counted) => {
  if (!JEST_ONLY.test(rel)) return counted
  const counts = { ...counted.counts }
  for (const m of APP_ONLY) counts[m] = 0
  return {
    ...counted,
    counts,
    occurrences: counted.occurrences.filter(
      (o) => !APP_ONLY.includes(o.metric)
    ),
  }
}

/**
 * What breaks the W3.4 zeros, file by file: each of ZERO_SINCE_W3's counts
 * above 0, as a violation of its own (from 0).
 */
const absoluteViolations = (files) =>
  Object.entries(files).flatMap(([file, { counts }]) =>
    ZERO_SINCE_W3.filter((m) => counts[m] > 0).map((m) => ({
      file,
      metric: m,
      from: 0,
      to: counts[m],
      rule: `${LABEL[m]} must be 0 since W3.4, whatever the baseline says`,
    }))
  )

const CODE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"]

/**
 * A module an app file imports, as the app's babel resolves it (a relative
 * path, or module-resolver's root `src`): the file, when it is code of this
 * app (under the root, not node_modules, not tappler-shared); else null.
 */
const appModule = (root, fromFile, source) => {
  if (/^@tappler\/shared(\/|$)/.test(source)) return null
  const base = source.startsWith(".")
    ? path.resolve(path.dirname(fromFile), source)
    : path.join(root, "src", source)
  const candidates = [
    base,
    ...CODE_EXTENSIONS.map((e) => base + e),
    ...CODE_EXTENSIONS.map((e) => path.join(base, `index${e}`)),
  ]
  const file = candidates.find(
    (f) =>
      /\.[jt]sx?$/.test(f) &&
      !/\.d\.ts$/.test(f) &&
      fs.existsSync(f) &&
      fs.statSync(f).isFile()
  )
  if (!file) return null
  const rel = path.relative(root, file)
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null
  return rel.split(path.sep).includes("node_modules") ? null : file
}

// { files: { "src/a.tsx": { counts, occurrences } }, errors: [...] }
// The walk leaves out __tests__, __mocks__ and __fixtures__ directories and
// *.test / *.spec files, and sees only `dirs`; a file of those that an app
// file imports is the app's all the same, so it is followed and counted
// (review-ca-w0: a className or a DmText moved into one went uncounted).
const scan = ({ root = ROOT, dirs = DEFAULT_DIRS } = {}) => {
  const files = {}
  const errors = []
  const queue = []
  const count = (file) => {
    const rel = posix(path.relative(root, file))
    if (files[rel]) return
    try {
      const { imports, ...counted } = countSource(
        fs.readFileSync(file, "utf8"),
        file
      )
      files[rel] = appOnly(rel, counted)
      if (!JEST_ONLY.test(rel))
        for (const source of imports) {
          const target = appModule(root, file, source)
          if (target) queue.push(target)
        }
    } catch (error) {
      errors.push({ file: rel, error: error.message.split("\n")[0] })
    }
  }
  for (const dir of dirs) {
    const abs = path.resolve(root, dir)
    if (!fs.existsSync(abs)) {
      errors.push({ file: dir, error: "no such directory" })
      continue
    }
    for (const file of walk(abs).sort()) count(file)
  }
  while (queue.length) count(queue.shift())
  return { files: sorted(files), errors }
}

const nonZero = (counts) =>
  Object.fromEntries(
    METRICS.filter((m) => counts[m]).map((m) => [m, counts[m]])
  )
const zero = () => Object.fromEntries(METRICS.map((m) => [m, 0]))
const full = (counts = {}) => ({ ...zero(), ...counts })

const directoryTotals = (fileCounts) => {
  const dirs = {}
  for (const [file, counts] of Object.entries(fileCounts)) {
    const parts = file.split("/").slice(0, -1)
    for (let i = 1; i <= parts.length; i++) {
      const dir = parts.slice(0, i).join("/")
      dirs[dir] = dirs[dir] || zero()
      for (const m of METRICS) dirs[dir][m] += counts[m] || 0
    }
  }
  return dirs
}

const sorted = (obj) =>
  Object.fromEntries(
    Object.keys(obj)
      .sort()
      .map((k) => [k, obj[k]])
  )

const toBaseline = (result, dirs) => {
  const files = {}
  for (const [file, { counts }] of Object.entries(result.files))
    if (Object.keys(nonZero(counts)).length) files[file] = nonZero(counts)
  const totals = zero()
  for (const counts of Object.values(files))
    for (const m of METRICS) totals[m] += counts[m] || 0
  const directories = {}
  for (const [dir, counts] of Object.entries(directoryTotals(files)))
    if (Object.keys(nonZero(counts)).length) directories[dir] = nonZero(counts)
  return {
    version: 1,
    note: "Written by `yarn ds:ratchet --update`. Counts per file; directories are their sums.",
    scanned: dirs,
    metrics: METRICS,
    totals,
    directories: sorted(directories),
    files: sorted(files),
  }
}

// A scanned directory as the baseline names it: relative to the root, so
// `--dir /abs/app/src`, `--dir ./src` and `--dir src` are all "src".
const relativeDir = (root, dir) =>
  posix(path.relative(root, path.resolve(root, dir))) || "."

// `dirs`: what was scanned. Baseline files outside it are left out rather
// than read as deleted, so `--dir src/screens` checks just that subtree.
const compare = (
  baseline,
  result,
  {
    strict = [],
    strictMetrics = STRICT_METRICS,
    allow = [],
    dirs,
    root = ROOT,
  } = {}
) => {
  const micromatch = require("micromatch")
  const violations = []
  const improved = []
  const scope = dirs && dirs.map((d) => relativeDir(root, d))
  const baseFiles = Object.fromEntries(
    Object.entries(baseline.files).filter(
      ([f]) =>
        !scope ||
        scope.some((d) => d === "." || f === d || f.startsWith(`${d}/`))
    )
  )
  const current = Object.fromEntries(
    Object.entries(result.files).map(([f, r]) => [f, full(r.counts)])
  )
  const allFiles = new Set([...Object.keys(baseFiles), ...Object.keys(current)])
  for (const file of [...allFiles].sort()) {
    const from = full(baseFiles[file])
    const to = current[file] || zero()
    const classNameFell = to.className < from.className
    const primitivesFell = to.primitives < from.primitives
    for (const m of METRICS) {
      if (to[m] <= from[m]) continue
      if (m === "primitives")
        // file by file, so a DmText moved elsewhere pays for no LegacyText
        violations.push({
          file,
          metric: m,
          from: from[m],
          to: to[m],
          rule: "DmText/ActionBtn may only fall",
        })
      else if (m === "bridge") {
        // each LegacyText stands for a DmText that went
        if (to.bridge - from.bridge > from.primitives - to.primitives)
          violations.push({
            file,
            metric: m,
            from: from[m],
            to: to[m],
            rule: `LegacyText may rise only in a file whose DmText/ActionBtn count falls by at least as much (LegacyText ${from.bridge} -> ${to.bridge}, DmText/ActionBtn ${from.primitives} -> ${to.primitives})`,
          })
      } else if (m === "className")
        violations.push({
          file,
          metric: m,
          from: from[m],
          to: to[m],
          rule: "className may only fall",
        })
      else if (APP_ONLY.includes(m))
        violations.push({
          file,
          metric: m,
          from: from[m],
          to: to[m],
          rule: `${LABEL[m]} may only fall`,
        })
      else if (m === "colorLiteral")
        violations.push({
          file,
          metric: m,
          from: from[m],
          to: to[m],
          rule: "colour literals may only fall; use a theme colour",
        })
      else if (!classNameFell && !primitivesFell)
        violations.push({
          file,
          metric: m,
          from: from[m],
          to: to[m],
          rule: `${LABEL[m]} may rise only in a file whose className or DmText/ActionBtn count falls (className ${from.className} -> ${to.className}, DmText/ActionBtn ${from.primitives} -> ${to.primitives})`,
        })
    }
    if (METRICS.some((m) => to[m] < from[m])) improved.push(file)
  }
  const strictViolations = []
  // Files each glob matched: a glob that matches nothing (a directory
  // without /**, a typo) would otherwise pass as "clean".
  const strictMatched = {}
  for (const glob of strict) {
    const pattern = glob.replace(/^\.\//, "")
    strictMatched[glob] = 0
    for (const [file, r] of Object.entries(result.files)) {
      if (!micromatch.isMatch(file, pattern)) continue
      strictMatched[glob]++
      for (const o of r.occurrences)
        if (
          strictMetrics.includes(o.metric) &&
          !(o.owner && allow.includes(o.owner))
        )
          strictViolations.push({ glob, file, ...o })
    }
  }
  const totals = { from: zero(), to: zero() }
  for (const counts of Object.values(baseFiles))
    for (const m of METRICS) totals.from[m] += counts[m] || 0
  for (const counts of Object.values(current))
    for (const m of METRICS) totals.to[m] += counts[m]
  const fromDirs = directoryTotals(baseFiles)
  const toDirs = directoryTotals(current)
  const dirsChanged = [
    ...new Set([...Object.keys(fromDirs), ...Object.keys(toDirs)]),
  ]
    .sort()
    .map((dir) => ({
      dir,
      from: fromDirs[dir] || zero(),
      to: toDirs[dir] || zero(),
    }))
    .filter((d) => METRICS.some((m) => d.from[m] !== d.to[m]))
  return {
    violations,
    strictViolations,
    strictMatched,
    improved,
    totals,
    dirsChanged,
    classNameProps: classNamePropTypes(result),
  }
}

// ---------------------------------------------------------------------------
// Report and CLI

const delta = (from, to) =>
  to === from
    ? `${to}`
    : `${from} -> ${to} (${to > from ? "+" : ""}${to - from})`
const line = (from, to) =>
  METRICS.filter((m) => from[m] || to[m])
    .map((m) => `${LABEL[m]} ${delta(from[m], to[m])}`)
    .join(", ") || "nothing counted"

const formatReport = (
  cmp,
  { strict = [], strictMetrics = STRICT_METRICS, allow = [] } = {}
) => {
  const out = []
  const problems = cmp.violations.length + cmp.strictViolations.length
  out.push(
    problems
      ? `style-ratchet: FAIL (${problems} problem${problems === 1 ? "" : "s"})`
      : "style-ratchet: OK"
  )
  const byFile = new Map()
  for (const v of cmp.violations)
    byFile.set(v.file, [...(byFile.get(v.file) || []), v])
  for (const [file, vs] of byFile) {
    out.push("", `  ${file}`)
    for (const v of vs)
      out.push(`    ${LABEL[v.metric]} ${delta(v.from, v.to)}: ${v.rule}`)
  }
  for (const glob of strict) {
    const vs = cmp.strictViolations.filter((v) => v.glob === glob)
    const n = (cmp.strictMatched || {})[glob]
    const what =
      strictMetrics.join() === STRICT_METRICS.join()
        ? ""
        : ` [${strictMetrics.map((m) => LABEL[m]).join(", ")}]`
    out.push(
      "",
      `  strict ${glob}${what}` +
        (n === undefined ? "" : ` (${n} file${n === 1 ? "" : "s"})`) +
        `: ${vs.length ? `${vs.length} left` : "clean"}` +
        (allow.length ? ` (allowed on ${allow.join(", ")})` : "")
    )
    for (const v of vs)
      out.push(
        `    ${v.file}:${v.line}  ${LABEL[v.metric]}${v.owner ? ` on <${v.owner}>` : ""}`
      )
  }
  if (!problems && cmp.improved.length)
    out.push(
      "",
      `  ${cmp.improved.length} file${cmp.improved.length === 1 ? "" : "s"} improved; run \`yarn ds:ratchet --update\` to lock it in`
    )
  out.push("", `  totals: ${line(cmp.totals.from, cmp.totals.to)}`)
  if (cmp.dirsChanged.length) {
    out.push("  changed directories:")
    for (const d of cmp.dirsChanged.slice(0, 25))
      out.push(`    ${d.dir}  ${line(d.from, d.to)}`)
    if (cmp.dirsChanged.length > 25)
      out.push(`    ... ${cmp.dirsChanged.length - 25} more`)
  }
  return out.join("\n")
}

const USAGE = `usage: yarn ds:ratchet [--strict <glob> ...] [--strict-metrics m,m] [--allow Name,Name ...] [--json]
       yarn ds:ratchet --update [--accept-rises]

  --strict GLOB   className, px() and leading="legacy" must be 0 in matching files
  --strict-metrics M,M
                  what --strict wants at 0 instead (${METRICS.join(", ")});
                  className alone is pass 1's gate, className,primitives
                  also wants no <DmText>/<ActionBtn> left (before W3)
  --allow NAMES   ...except on these components (comma-separated, repeatable)
  --update        write the current counts into the baseline
  --accept-rises  let --update write counts that rose
  --baseline F    baseline file (default scripts/style-ratchet-baseline.json)
  --root DIR      what baseline paths are relative to (default the app root)
  --dir DIR       directory to scan, relative to --root (repeatable; default: the baseline's)`

const main = (argv) => {
  const opts = {
    strict: [],
    strictMetrics: STRICT_METRICS,
    allow: [],
    update: false,
    acceptRises: false,
    json: false,
    baseline: DEFAULT_BASELINE,
    root: ROOT,
    dirs: [],
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const value = () => {
      const v = argv[++i]
      if (v === undefined || v.startsWith("--"))
        throw new Error(`${a} needs a value`)
      return v
    }
    try {
      if (a === "--strict") opts.strict.push(value())
      else if (a === "--strict-metrics") {
        opts.strictMetrics = value()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        const unknown = opts.strictMetrics.filter((m) => !METRICS.includes(m))
        if (unknown.length || !opts.strictMetrics.length)
          throw new Error(
            `--strict-metrics takes ${METRICS.join(", ")}; got ${unknown.join(", ") || "nothing"}`
          )
      } else if (a === "--allow")
        opts.allow.push(
          ...value()
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        )
      else if (a === "--update") opts.update = true
      else if (a === "--accept-rises") opts.acceptRises = true
      else if (a === "--json") opts.json = true
      else if (a === "--baseline") opts.baseline = path.resolve(value())
      else if (a === "--root") opts.root = path.resolve(value())
      else if (a === "--dir") opts.dirs.push(value())
      else if (a === "--help" || a === "-h") {
        console.log(USAGE)
        return 0
      } else throw new Error(`unknown argument ${a}`)
    } catch (error) {
      console.error(`style-ratchet: ${error.message}\n${USAGE}`)
      return 2
    }
  }

  const existing = fs.existsSync(opts.baseline)
    ? JSON.parse(fs.readFileSync(opts.baseline, "utf8"))
    : null
  if (!existing && !opts.update) {
    console.error(
      `style-ratchet: no baseline at ${opts.baseline}; run with --update to write one`
    )
    return 2
  }
  const dirs = (
    opts.dirs.length
      ? opts.dirs
      : (existing && existing.scanned) || DEFAULT_DIRS
  ).map((d) => relativeDir(opts.root, d))
  // --update rewrites the whole file: from a subtree it would drop every
  // other file's counts, and their className would later read as new.
  if (
    opts.update &&
    existing &&
    opts.dirs.length &&
    JSON.stringify(dirs) !== JSON.stringify(existing.scanned)
  ) {
    console.error(
      `style-ratchet: --update rewrites the whole baseline, which scans ${JSON.stringify(
        existing.scanned
      )}; drop --dir`
    )
    return 2
  }
  const result = scan({ root: opts.root, dirs })
  if (result.errors.length) {
    for (const e of result.errors)
      console.error(`style-ratchet: ${e.file}: ${e.error}`)
    return 2
  }
  const baseline = existing || { files: {} }
  const cmp = compare(baseline, result, {
    strict: opts.strict,
    strictMetrics: opts.strictMetrics,
    allow: opts.allow,
    dirs,
    root: opts.root,
  })
  // Since W3.4 the six totals are 0 in this tree, whatever its baseline says
  // (one taken with --update --accept-rises included): on the tree's own
  // baseline the CLI fails on each file that holds one.
  const absolute =
    opts.root === ROOT && opts.baseline === DEFAULT_BASELINE
      ? absoluteViolations(result.files)
      : []
  // (a file whose count also rose against the baseline is reported once)
  cmp.violations.push(
    ...absolute.filter(
      (a) =>
        !cmp.violations.some((v) => v.file === a.file && v.metric === a.metric)
    )
  )
  const unmatched = opts.strict.filter((g) => cmp.strictMatched[g] === 0)
  if (unmatched.length) {
    for (const g of unmatched)
      console.error(
        `style-ratchet: --strict ${g} matches no file under ${dirs.join(
          ", "
        )} (for a directory, end the glob with /**)`
      )
    return 2
  }

  if (opts.update) {
    // The first baseline is today's state, not a rise from nothing.
    if (absolute.length) {
      console.error(
        `${formatReport({ ...cmp, strictViolations: [] })}\n\n` +
          "style-ratchet: not updating: className and DmText/ActionBtn are 0 in this tree since W3.4, and so are the className keys, prop types and nativewind/clsx and DmText/ActionBtn imports; --accept-rises doesn't take them"
      )
      return 1
    }
    if (existing && cmp.violations.length && !opts.acceptRises) {
      console.error(
        `${formatReport({ ...cmp, strictViolations: [] })}\n\n` +
          "style-ratchet: not updating while counts rose; fix them, or pass --accept-rises to record the rise (it shows in the baseline diff)"
      )
      return 1
    }
    const next = toBaseline(result, dirs)
    fs.writeFileSync(opts.baseline, `${JSON.stringify(next, null, 2)}\n`)
    console.log(
      `style-ratchet: wrote ${path.relative(process.cwd(), opts.baseline) || opts.baseline}\n` +
        `  totals: ${line(full(cmp.totals.from), next.totals)}`
    )
    return 0
  }

  if (opts.json) console.log(JSON.stringify(cmp, null, 2))
  else console.log(formatReport(cmp, opts))
  return cmp.violations.length || cmp.strictViolations.length ? 1 : 0
}

module.exports = {
  countSource,
  classNamePropTypes,
  scan,
  compare,
  toBaseline,
  formatReport,
  isColourLiteral,
  CLASSNAME_ATTR,
  METRICS,
  APP_ONLY,
  ZERO_SINCE_W3,
  absoluteViolations,
  DEFAULT_BASELINE,
  main,
}

if (require.main === module) process.exitCode = main(process.argv.slice(2))
