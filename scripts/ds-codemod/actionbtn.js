/**
 * Rule 2: <ActionBtn ...> -> the design system's <Button ...>, by the rules
 * of src/testing/buttonLooks/__fixtures__/translate.ts, which turns one
 * ActionBtn look into Button props (proapp's, with customerapp's faces and
 * rules of its own: a class NativeWind drops takes no prop; CA-W0-B's
 * bg-grey19 while disabled (subtle), a caller's red under the spinner
 * (brand) and opacity-50 (dim); any other caller's background over a state
 * fill has no spelling). The codemod runs that translator itself rather
 * than a copy of its rules.
 *
 * A site is every look its conditions can make: each combination of the
 * class strings' conditions, the variant's, and disable, isLoading,
 * isIconRight and reverseItems, built the way the look harvest builds it.
 * The site converts only if every one of those looks is one a parity drew
 * in customerapp's config, listed in
 * src/testing/buttonLooks/__tests__/__parity__/Button.looks.cases.json
 * (where the looks proof lands, skeptic H4): nothing the proof hasn't seen
 * is written. Until that file exists no look is proven, so every ActionBtn
 * is left with its reason; proapp's proven looks were drawn in Poppins and
 * prove nothing here. Each
 * prop is then one expression over the site's conditions, a state's props
 * taken only from the combinations where they draw (the label not while
 * loading, the disabled look only when dimmed or loading, the loading fill
 * only while loading). The layout classes become the style, through atoms
 * and entries like any other.
 */
const fs = require("fs")
const path = require("path")

const { NwResolveError, paths } = require("../nw-resolve")
const {
  assignments,
  atomsOf,
  evaluate,
  truth,
  unparen,
  canonical,
} = require("./classexpr")
const { synthesize } = require("./dmtext")
const { load, loadDs } = require("./dsload")
const { Unconvertible, resolveOrLeave, styleFromIR } = require("./plain")
const { deepEqual, evalStyle, flatten } = require("./styles")

const ROOT = paths.ROOT
const TRANSLATOR = path.join(
  ROOT,
  "src",
  "testing",
  "buttonLooks",
  "__fixtures__",
  "translate.ts"
)
// The looks a parity drew in customerapp's config: { looks: { id: { props
// } } }, harvested sites and hand looks alike. A hand look
// (__fixtures__/handLooks.ts) counts only once it is listed here: proapp's
// driver drew them in proapp's config, nothing has here.
const PROVEN = path.join(
  ROOT,
  "src",
  "testing",
  "buttonLooks",
  "__tests__",
  "__parity__",
  "Button.looks.cases.json"
)

// Button's label presets (Button.tsx LABEL_SIZE).
const LABEL_SIZE = { sm: 13, md: 15, lg: 16 }

// ActionBtn's props (src/testing/buttonLooks/harvest.ts ACTIONBTN_PROPS),
// and what a call site may also pass.
const KEPT = new Set(["title", "onPress", "isLoading", "key", "testID"])
const CLASSES = ["className", "textClassName", "classNameTextWrapper"]
const FLAGS = ["disable", "isLoading", "isIconRight", "reverseItems"]
const NODES = { Icon: "icon", IconNearTitle: "titleIcon" }
const TEXTS = { titleSecond: "secondTitle", descr: "description" }
const RENAMED = {
  ...NODES,
  ...TEXTS,
  disable: "disabled",
  reverseItems: "reverse",
}
const MAPPED = new Set([
  ...CLASSES,
  ...FLAGS,
  ...Object.keys(NODES),
  ...Object.keys(TEXTS),
  "variant",
])
const PLACEHOLDER = { title: "Button title", titleSecond: "Second title" }

// Button.tsx: what each prop draws in a state. Label props draw nothing
// while the spinner shows; the disabled look draws when dimmed or loading
// (its surface is the loading fill too); the loading fill only loading;
// looksDisabled only when not disabled.
const LABEL_PROPS = new Set([
  "label",
  "labelWeight",
  "labelLeading",
  "labelFamily",
  "labelColor",
  "labelTracking",
  "labelCase",
  "labelOffset",
  "labelInset",
  "iconAt",
])
const draws = (key, c) => {
  if (LABEL_PROPS.has(key)) return !c.L
  if (key === "disabledLook") return c.L || c.D || !!c.props.looksDisabled
  if (key === "loadingSurface") return c.L
  if (key === "looksDisabled") return !c.D
  return true
}
// Written by the codemod itself, not from the translator's values.
const PASSED = new Set([
  "title",
  "onPress",
  "disabled",
  "isLoading",
  "icon",
  "titleIcon",
  "secondTitle",
  "description",
  "reverse",
  "style",
])
const DEFAULT = {
  variant: "primary",
  disabledLook: "legacy",
  looksDisabled: false,
}

const LAYOUT_KEYS = new Set([
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "width",
  "minWidth",
  "maxWidth",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
])
// styleFromIR's exclude: everything but the layout keys (the rest is props).
const NOT_LAYOUT = { has: (key) => !LAYOUT_KEYS.has(key) }

let translator
const translatorFn = () => {
  if (!translator) {
    // The translator reads the Latin faces from tappler-shared's helpers,
    // the instance loadDs() registered (or left at Montserrat, as here).
    loadDs()
    translator = load(TRANSLATOR).translate
  }
  return translator
}

const squash = (s) => s.replace(/\s+/g, " ").trim()

/** One look as the parity knows it: what changes what a button draws. */
const lookKey = (look) => {
  const out = {}
  for (const key of Object.keys(look).sort()) {
    const v = look[key]
    if (key === "title") continue
    if (CLASSES.includes(key) || key === "classNameIcon") {
      if (typeof v === "string" && squash(v)) out[key] = squash(v)
    } else if (key in NODES || key in TEXTS || key === "onPress")
      out[key] = true
    // A flag set to false draws what an absent one draws.
    else if (FLAGS.includes(key)) {
      if (v) out[key] = true
    } else out[key] = v
  }
  return JSON.stringify(out)
}

let proven
const provenLooks = () => {
  if (!proven) {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const { looks = {} } = fs.existsSync(PROVEN) ? require(PROVEN) : {}
    proven = new Set(Object.values(looks).map((l) => lookKey(l.props)))
  }
  return proven
}

/**
 * Button's labelLeading over a label whose size depends on a condition: a
 * step one of its sizes lacks is written as its value instead (px(n) draws
 * the same, x 1.32 in Arabic like the step). Rewrites the combinations'
 * props; true when it did.
 */
const sharedStepsOnly = (ds, labelled) => {
  const labelSize = (p) => {
    const l = p.label === undefined ? "lg" : p.label
    return typeof l === "string" ? LABEL_SIZE[l] : l
  }
  const sizes = [...new Set(labelled.map((c) => labelSize(c.props)))]
  if (sizes.length < 2) return false
  let changed = false
  for (const c of labelled) {
    const l = c.props.labelLeading
    if (
      typeof l === "string" &&
      l !== "legacy" &&
      !sizes.every((sz) => ds.TEXT_SIZES.includes(sz) && l in ds.LEADING[sz])
    ) {
      c.props = { ...c.props, labelLeading: ds.LEADING[labelSize(c.props)][l] }
      changed = true
    }
  }
  return changed
}

const resolveStrict = (fn) => {
  try {
    return fn()
  } catch (error) {
    if (error instanceof NwResolveError)
      throw new Unconvertible(
        "unresolvable-class",
        error.problems.map((p) => `${p.class}: ${p.reason}`).join("; ")
      )
    throw error
  }
}

const printLeading = (v) =>
  typeof v === "object" && v !== null && "legacy" in v
    ? `{ legacy: px(${v.legacy}) }`
    : null

/**
 * Button props for an ActionBtn element, or Unconvertible.
 * `attrs`: { name -> attribute path }. `irOf(name)`: the IR of a class
 * attribute (null when absent). `lookConst(look)`: the name of a module
 * constant holding a disabled look object.
 */
const convertActionBtn = ({
  ds,
  attrs,
  irOf,
  table,
  registry,
  hint,
  hasChildren,
  lookConst,
  // the proven looks, for a test; else Button.looks.cases.json's
  proven: provenOverride = null,
}) => {
  if (hasChildren)
    throw new Unconvertible(
      "actionbtn-unsupported-prop",
      "children (ActionBtn draws none)"
    )
  for (const name of Object.keys(attrs))
    if (!KEPT.has(name) && !MAPPED.has(name))
      throw new Unconvertible(
        "actionbtn-unsupported-prop",
        `\`${name}\` has no Button equivalent`
      )

  // A boolean as a function of the site's conditions: `!canSave ||
  // isLoading` is two of them, shared with every attribute that reads one,
  // the way the look harvest reads them (so no look is one that can't be).
  const boolOf = (node) => {
    const n = unparen(node)
    if (n.type === "BooleanLiteral") return { atoms: [], at: () => n.value }
    // ...unless a class attribute already reads the whole of it as one
    // condition (`(!isValid || !match) && "text-grey10"`): then it is that one
    let bare = n
    while (bare.type === "UnaryExpression" && bare.operator === "!")
      bare = unparen(bare.argument)
    if (bare !== n || bare.type !== "Identifier")
      if (table.byText.has(canonical(bare))) {
        const c = table.cond(n)
        return { atoms: [c.id], at: (env) => truth(c, env) }
      }
    if (n.type === "UnaryExpression" && n.operator === "!") {
      const x = boolOf(n.argument)
      return { atoms: x.atoms, at: (env) => !x.at(env) }
    }
    if (
      n.type === "LogicalExpression" &&
      (n.operator === "||" || n.operator === "&&")
    ) {
      const l = boolOf(n.left)
      const r = boolOf(n.right)
      return {
        atoms: [...l.atoms, ...r.atoms],
        at: (env) =>
          n.operator === "||" ? l.at(env) || r.at(env) : l.at(env) && r.at(env),
      }
    }
    if (n.type === "ConditionalExpression") {
      const t = boolOf(n.test)
      const y = boolOf(n.consequent)
      const z = boolOf(n.alternate)
      return {
        atoms: [...t.atoms, ...y.atoms, ...z.atoms],
        at: (env) => (t.at(env) ? y.at(env) : z.at(env)),
      }
    }
    const c = table.cond(n)
    return { atoms: [c.id], at: (env) => truth(c, env) }
  }
  // A boolean attribute: true when bare, else its expression.
  const flag = (name) => {
    const attr = attrs[name]
    if (!attr) return null
    const v = attr.node.value
    if (!v) return { atoms: [], at: () => true }
    if (v.type !== "JSXExpressionContainer")
      throw new Unconvertible(
        "actionbtn-unsupported-prop",
        `\`${name}\` isn't an expression`
      )
    return boolOf(v.expression)
  }
  // An icon or a text: there or not, and what it is stays as written.
  for (const name of [...Object.keys(NODES), ...Object.keys(TEXTS)]) {
    const attr = attrs[name]
    const e = attr && attr.node.value && attr.node.value.expression
    if (
      e &&
      (e.type === "ConditionalExpression" || e.type === "LogicalExpression")
    )
      throw new Unconvertible(
        "actionbtn-unsupported-prop",
        `\`${name}\` is there in some states only`
      )
  }
  // the class strings first, so a flag can share a condition they read whole
  const irs = Object.fromEntries(
    [...CLASSES, "variant"].map((n) => [n, attrs[n] ? irOf(n) : null])
  )
  const flags = Object.fromEntries(FLAGS.map((n) => [n, flag(n)]))
  const ids = new Set()
  for (const ir of Object.values(irs))
    if (ir) for (const id of atomsOf(ir)) ids.add(id)
  for (const f of Object.values(flags))
    if (f) for (const id of f.atoms) ids.add(id)
  const atomIds = [...ids]
  let envs
  try {
    envs = assignments(atomIds)
  } catch (error) {
    throw new Unconvertible("too-many-conditions", error.message)
  }
  const value = (f, env) => (!f ? undefined : f.at(env))

  const translate = translatorFn()
  const known = provenOverride
    ? new Set([...provenOverride].map(lookKey))
    : provenLooks()
  const combos = envs.map((env) => {
    const look = { title: PLACEHOLDER.title }
    if (attrs.onPress) look.onPress = { $fn: true }
    for (const name of FLAGS) {
      const v = value(flags[name], env)
      if (v !== undefined) look[name] = v
    }
    for (const name of [...CLASSES, "variant"])
      if (irs[name]) {
        const s = evaluate(irs[name], env)
        if (s) look[name] = s
      }
    for (const name of Object.keys(NODES))
      if (attrs[name]) look[name] = { $el: "node" }
    if (attrs.titleSecond) look.titleSecond = PLACEHOLDER.titleSecond
    if (attrs.descr) look.descr = "Description"
    let props
    try {
      props = resolveStrict(
        () => translate(look, () => ({ $node: true })).props
      )
    } catch (error) {
      if (error instanceof Unconvertible) throw error
      throw new Unconvertible("actionbtn-look", error.message.split("\n")[0])
    }
    return {
      env,
      look,
      props,
      D: !!look.disable,
      L: !!look.isLoading,
    }
  })
  // Every look translated first, so a site Button can't draw says so even
  // while nothing is proven; then each must be one a parity drew.
  for (const c of combos)
    if (!known.has(lookKey(c.look)))
      throw new Unconvertible(
        "unproven-look",
        `a look no Button parity has drawn in customerapp's config (${lookKey(c.look)}): prove it first (Button.looks.cases.json)`
      )

  // The layout classes, as their own style.
  const layout = irs.className
    ? styleFromIR(irs.className, {
        table,
        registry,
        hint,
        exclude: NOT_LAYOUT,
        fontIsDead: true,
      })
    : { expr: null, dropped: [] }
  for (const c of combos) {
    const got = flatten(evalStyle(layout.expr, c.env, registry.a))
    const want = c.props.style || {}
    if (!deepEqual(got, want))
      throw new Unconvertible(
        "actionbtn-look",
        `the layout style would be ${JSON.stringify(got)} where the translator says ${JSON.stringify(want)}`
      )
  }

  // What NativeWind drops from the label's classes and the label box's, in
  // any combination: the translator reads their styles, where a dropped
  // class is simply nothing, so it is listed (rule 6) beside the layout's,
  // under the attribute it is written in. A font class is the label's own
  // (ActionBtn's label reads it); on the label box it draws nothing.
  const droppedBy = { className: layout.dropped }
  for (const [name, fontIsDead] of [
    ["textClassName", false],
    ["classNameTextWrapper", true],
  ]) {
    if (!irs[name]) continue
    const found = new Map()
    for (const c of combos) {
      const str = evaluate(irs[name], c.env)
      if (str && str.trim())
        for (const d of resolveOrLeave(str, { fontIsDead }).dropped)
          found.set(d.class, d)
    }
    droppedBy[name] = [...found.values()]
  }

  // Each prop as one expression over the conditions, from the combinations
  // where it draws; the others take a neighbour's value (they can't tell).
  const keys = new Set()
  for (const c of combos)
    for (const k of Object.keys(c.props)) if (!PASSED.has(k)) keys.add(k)
  const uses = { px: false }
  const refs = []
  const attrsOut = []
  const pxKeys = new Set()
  for (const c of combos) {
    const { written } = translate(c.look, () => ({ $node: true }))
    for (const m of written.matchAll(/(\w+)=\{px\(/g)) pxKeys.add(m[1])
  }
  // A label size that depends on a condition takes only the leading steps
  // all its sizes have (as Text's does, dmtext.js).
  if (
    ds &&
    sharedStepsOnly(
      ds,
      combos.filter((c) => !c.L)
    )
  )
    pxKeys.add("labelLeading")
  const print = (key) => (v) => {
    if (v === undefined) return "undefined"
    if (key === "disabledLook" && typeof v === "object") return lookConst(v)
    if (key === "labelLeading" && printLeading(v)) {
      uses.px = true
      return printLeading(v)
    }
    if (typeof v === "number" && pxKeys.has(key)) {
      uses.px = true
      return `px(${v})`
    }
    return JSON.stringify(v)
  }
  // in the translator's order: container, variant, state, label, content
  for (const key of keys) {
    const drawn = combos.filter((c) => draws(key, c))
    if (drawn.length === 0) continue
    const values = combos.map((c) => {
      if (draws(key, c)) return { env: c.env, value: c.props[key] }
      // the drawn combination that differs least
      const near = drawn
        .map((d) => ({
          d,
          n: atomIds.filter((id) => d.env.get(id) !== c.env.get(id)).length,
        }))
        .sort((a, b) => a.n - b.n)[0].d
      return { env: c.env, value: near.props[key] }
    })
    const s = synthesize(values, atomIds, table, print(key), refs)
    if ("constant" in s) {
      const v = s.constant
      if (v === undefined || deepEqual(v, DEFAULT[key])) continue
      if (v === true) attrsOut.push(key)
      else {
        const printed = print(key)(v)
        attrsOut.push(
          /^"/.test(printed) ? `${key}=${printed}` : `${key}={${printed}}`
        )
      }
    } else attrsOut.push(`${key}={${s.expr}}`)
  }

  return {
    attrs: attrsOut,
    styleExpr: layout.expr,
    // Renamed as they are: the expressions run as often as before.
    renames: Object.entries(RENAMED)
      .filter(([from]) => attrs[from])
      .map(([from, to]) => ({ attr: attrs[from], to })),
    // Gone into props: ActionBtn's variant (Button's is worked out with the
    // classes), the label box's classes, the icon's side.
    removed: ["variant", "classNameTextWrapper", "isIconRight"].filter(
      (n) => attrs[n]
    ),
    // the conditions the props now read, and the attributes that keep theirs
    refs: [
      ...refs,
      ...["disable", "isLoading", "reverseItems"].flatMap((n) =>
        flags[n] ? flags[n].atoms : []
      ),
    ],
    uses,
    // every class it drops, and by the attribute it is written in
    dropped: Object.values(droppedBy).flat(),
    droppedBy,
    combos: combos.length,
  }
}

module.exports = {
  LAYOUT_KEYS,
  PROVEN,
  TRANSLATOR,
  convertActionBtn,
  lookKey,
  sharedStepsOnly,
}
