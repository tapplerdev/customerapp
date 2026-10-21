/**
 * Style values: React Native's flatten, equality, atoms, and the per-file
 * registry of StyleSheet entries the codemod writes into a co-located
 * styles.ts.
 *
 * A style expression (what a `style={...}` becomes) is data until it is
 * printed:
 *   { k: "atom", name }            a.flex_1
 *   { k: "entry", entry }          styles.row (entry.key is given at print)
 *   { k: "arr", items }            [x, y]
 *   { k: "if", cond, then, else }  cond ? x : y, or cond && x
 *   { k: "raw", src, value }       the element's own style, kept as written
 * so the codemod can evaluate it for every combination of conditions and
 * check it against what NativeWind does, before writing anything.
 */
const { truth } = require("./classexpr")
const { isColourLiteral } = require("../style-ratchet")

const COLOR_KEYS =
  /^(color|backgroundColor|border(Top|Right|Bottom|Left|Start|End)?Color|shadowColor|tintColor|textDecorationColor|textShadowColor|overlayColor)$/

/** React Native's StyleSheet.flatten: arrays in order, falsy skipped, later keys win. */
const flatten = (style) => {
  const out = {}
  const visit = (s) => {
    if (!s) return
    if (Array.isArray(s)) s.forEach(visit)
    else Object.assign(out, s)
  }
  visit(style)
  return out
}

const deepEqual = (x, y) => {
  if (x === y) return true
  if (typeof x !== typeof y || x === null || y === null) return false
  if (typeof x !== "object") return Number.isNaN(x) && Number.isNaN(y)
  if (Array.isArray(x) !== Array.isArray(y)) return false
  const kx = Object.keys(x).filter((k) => x[k] !== undefined)
  const ky = Object.keys(y).filter((k) => y[k] !== undefined)
  if (kx.length !== ky.length) return false
  return kx.every((k) => deepEqual(x[k], y[k]))
}

const isEmpty = (s) => !s || Object.keys(s).length === 0

const omitKeys = (style, keys) => {
  const out = {}
  for (const k of Object.keys(style)) if (!keys.has(k)) out[k] = style[k]
  return out
}

// Atoms with more keys first, so `p-[20]` is a.p_20 rather than four sides.
// React Native's own fill, written `StyleSheet.absoluteFill` (never the
// absoluteFillObject RN 0.85 removed): what `absolute top-0 left-0 right-0
// bottom-0` gives. NativeWind 2 drops `inset-0`, so `absolute inset-0` is
// only `absolute` today and stays that (its inset goes to latent-bugs.md).
const ABSOLUTE_FILL = Object.freeze({
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
})
const RN_FILL = "@absoluteFill"

const atomValue = (a, name) => (name === RN_FILL ? ABSOLUTE_FILL : a[name])

let atomList
const atomsByCover = (a) => {
  if (!atomList)
    atomList = [[RN_FILL, ABSOLUTE_FILL], ...Object.entries(a)]
      .map(([name, value]) => ({ name, value, keys: Object.keys(value) }))
      .sort(
        (x, y) => y.keys.length - x.keys.length || (x.name < y.name ? -1 : 1)
      )
  return atomList
}

/**
 * Splits a resolved style into atoms (each exactly what its class gives,
 * keys disjoint) and what's left. Disjoint keys flatten the same in any
 * order, so the split can't change the result.
 */
const decompose = (style, a) => {
  const taken = new Set()
  const atoms = []
  for (const atom of atomsByCover(a)) {
    if (
      atom.keys.every(
        (k) =>
          !taken.has(k) &&
          Object.prototype.hasOwnProperty.call(style, k) &&
          deepEqual(style[k], atom.value[k])
      )
    ) {
      atoms.push(atom)
      atom.keys.forEach((k) => taken.add(k))
    }
  }
  // Atoms in the order their first key comes in the style (class order).
  const order = Object.keys(style)
  atoms.sort(
    (x, y) =>
      Math.min(...x.keys.map((k) => order.indexOf(k))) -
      Math.min(...y.keys.map((k) => order.indexOf(k)))
  )
  const rest = {}
  for (const k of order) if (!taken.has(k)) rest[k] = style[k]
  return { atoms: atoms.map((x) => x.name), rest }
}

/** The one atom that is exactly `style`, if there is one. */
const exactAtom = (style, a) => {
  const keys = Object.keys(style)
  const hit = atomsByCover(a).find(
    (atom) =>
      atom.keys.length === keys.length &&
      keys.every((k) => deepEqual(style[k], atom.value[k]))
  )
  return hit ? hit.name : null
}

// ---------------------------------------------------------------------------
// The file's StyleSheet entries

const camel = (s) =>
  s
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^[A-Z]/, (c) => c.toLowerCase())

const sortedJson = (v) => {
  if (Array.isArray(v)) return `[${v.map(sortedJson).join(",")}]`
  if (v && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${sortedJson(v[k])}`)
      .join(",")}}`
  return JSON.stringify(v)
}

class StyleRegistry {
  /**
   * `taken`: keys already in the styles object the entries go into.
   * `palette`: tappler-shared's colours (`colors.*`); `appPalette`: the
   * app's own (`dsColors.*`, src/styles/dsColors.ts). An entry never holds a
   * colour neither names.
   */
  constructor({ taken = [], palette = {}, appPalette = {}, a = {} } = {}) {
    this.taken = new Set(taken)
    this.entries = []
    this.byValue = new Map()
    this.palette = palette
    this.appPalette = appPalette
    this.a = a
    this.usesPalette = false
    this.usesAppPalette = false
  }

  /** An entry for `style`, reusing an equal one already registered. */
  entry(style, hint, provenance = {}) {
    for (const [key, value] of Object.entries(style))
      if (
        COLOR_KEYS.test(key) &&
        isColourLiteral(value) &&
        !this.colourName(key, value, provenance)
      ) {
        // eslint-disable-next-line global-require
        const { Unconvertible } = require("./plain")
        throw new Unconvertible(
          "colour-not-a-token",
          `${key} ${value}${provenance[key] ? ` (${provenance[key]})` : ""} is in neither tappler-shared's palette nor src/styles/dsColors.ts: name it there (yarn ds:colors), then run again`
        )
      }
    // Equal styles share an entry, unless a colour in them would be named
    // differently (bg-grey26 and bg-homeCardSuspended draw the same grey).
    const names = Object.keys(style)
      .filter((k) => COLOR_KEYS.test(k))
      .map((k) => {
        const n = this.colourName(k, style[k], provenance)
        return n ? `${k}=${n.source}.${n.name}` : ""
      })
    const id = `${sortedJson(style)}|${names.join(",")}`
    const found = this.byValue.get(id)
    if (found) return found
    const base = camel(hint || "style") || "style"
    let key = base
    for (let n = 2; this.taken.has(key); n++) key = `${base}${n}`
    this.taken.add(key)
    const entry = { key, style, provenance }
    this.entries.push(entry)
    this.byValue.set(id, entry)
    return entry
  }

  /** A point to roll back to when a conversion is abandoned. */
  checkpoint() {
    return {
      n: this.entries.length,
      usesPalette: this.usesPalette,
      usesAppPalette: this.usesAppPalette,
    }
  }

  /** Forgets every entry registered since `cp` (an attempt that failed). */
  rollback(cp) {
    for (const e of this.entries.splice(cp.n)) {
      this.taken.delete(e.key)
      for (const [id, x] of this.byValue) if (x === e) this.byValue.delete(id)
    }
    this.usesPalette = cp.usesPalette
    this.usesAppPalette = cp.usesAppPalette
  }

  /**
   * `{ source: "shared" | "app", name }` naming a colour value: the class's
   * own name first (bg-homeCardSuspended is dsColors.homeCardSuspended, not
   * shared's grey26 of the same value), then shared's palette, then the
   * app's. Null when nothing names it.
   */
  colourName(key, value, provenance) {
    if (!COLOR_KEYS.test(key) || typeof value !== "string") return null
    const named = (palette) =>
      Object.keys(palette).filter((n) => same(palette[n], value))
    const shared = named(this.palette)
    const app = named(this.appPalette)
    const label = provenance && provenance[key]
    const own = (names) => label && names.find((n) => label.endsWith(`-${n}`))
    if (own(shared)) return { source: "shared", name: own(shared) }
    if (own(app)) return { source: "app", name: own(app) }
    if (shared.length) return { source: "shared", name: shared[0] }
    if (app.length) return { source: "app", name: app[0] }
    return null
  }
}

const same = (a, b) =>
  typeof b === "string" && a.toLowerCase() === b.toLowerCase()

// ---------------------------------------------------------------------------
// Style expressions

const styleAtom = (name) => ({ k: "atom", name })
const styleEntry = (entry) => ({ k: "entry", entry })

/** A resolved style as a style expression: atoms plus one entry, or null. */
const staticExpr = (style, { registry, hint, provenance, split = true }) => {
  if (isEmpty(style)) return null
  const a = registry.a
  if (!split) {
    const atom = exactAtom(style, a)
    return atom
      ? styleAtom(atom)
      : styleEntry(registry.entry(style, hint, provenance))
  }
  const { atoms, rest } = decompose(style, a)
  // In class order: each item where its first key comes in the style.
  const order = Object.keys(style)
  const first = (keys) => Math.min(...keys.map((k) => order.indexOf(k)))
  const items = atoms.map((name) => ({
    at: first(Object.keys(atomValue(a, name))),
    x: styleAtom(name),
  }))
  if (!isEmpty(rest))
    items.push({
      at: first(Object.keys(rest)),
      x: styleEntry(registry.entry(rest, hint, provenance)),
    })
  items.sort((p, q) => p.at - q.at)
  const out = items.map((i) => i.x)
  return out.length === 1 ? out[0] : { k: "arr", items: out }
}

/** The style objects an expression gives for one assignment, in order. */
const evalStyle = (expr, env, a) => {
  if (!expr) return []
  switch (expr.k) {
    case "atom":
      return [atomValue(a, expr.name)]
    case "entry":
      return [expr.entry.style]
    case "arr":
      return expr.items.flatMap((x) => evalStyle(x, env, a))
    case "if":
      return evalStyle(truth(expr.cond, env) ? expr.then : expr.else, env, a)
    case "raw":
      return [expr.value]
    default:
      throw new Error(`ds-codemod: internal: style expr ${expr.k}`)
  }
}

const refsOf = (expr, out = { atoms: false, entries: false }) => {
  if (!expr) return out
  if (expr.k === "atom") {
    if (expr.name === RN_FILL) out.rnFill = true
    else out.atoms = true
  }
  if (expr.k === "entry") out.entries = true
  if (expr.k === "arr") expr.items.forEach((x) => refsOf(x, out))
  if (expr.k === "if") {
    refsOf(expr.then, out)
    refsOf(expr.else, out)
  }
  return out
}

/**
 * Prints a style expression. `names` = { atoms: "a", styles: "styles" }.
 * `booleanish(cond)` says whether `cond && x` type-checks as a style (a
 * number condition would put 0 in the array).
 */
const printStyle = (expr, names, { booleanish = () => true } = {}) => {
  const p = (x, nested) => {
    if (!x) return "undefined"
    switch (x.k) {
      case "atom":
        return x.name === RN_FILL
          ? `${names.styleSheet || "StyleSheet"}.absoluteFill`
          : `${names.atoms}.${x.name}`
      case "entry":
        return `${names.styles}.${x.entry.key}`
      case "raw":
        return x.src
      case "arr":
        return `[${x.items.map((i) => p(i, false)).join(", ")}]`
      case "if": {
        const cond = x.cond
        const wrap = (s) => (nested ? `(${s})` : s)
        if (!x.else && booleanish(x.cond))
          return wrap(`${parenCond(cond)} && ${p(x.then, true)}`)
        return wrap(
          `${parenCond(cond)} ? ${p(x.then, true)} : ${p(x.else, true)}`
        )
      }
      default:
        throw new Error(`ds-codemod: internal: style expr ${x.k}`)
    }
  }
  return p(expr, false)
}

// A condition printed in front of `&&` or `?` keeps its own meaning only if
// it binds tighter (classexpr marks the ones that don't).
const parenCond = (cond) => (cond.wrap ? `(${cond.src})` : cond.src)

/** One literal of a style value for a styles.ts entry. */
const printValue = (registry, key, value, provenance) => {
  const named = registry.colourName(key, value, provenance)
  if (named) {
    const object = named.source === "app" ? "dsColors" : "colors"
    if (named.source === "app") registry.usesAppPalette = true
    else registry.usesPalette = true
    return /^[A-Za-z_$][\w$]*$/.test(named.name)
      ? `${object}.${named.name}`
      : `${object}[${JSON.stringify(named.name)}]`
  }
  return printLiteral(value)
}

const printLiteral = (value) => {
  if (Array.isArray(value)) return `[${value.map(printLiteral).join(", ")}]`
  if (value && typeof value === "object")
    return `{ ${Object.entries(value)
      .map(([k, v]) => `${printKey(k)}: ${printLiteral(v)}`)
      .join(", ")} }`
  return JSON.stringify(value)
}

const printKey = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k))

/** `key: { ... },` for each new entry. */
const printEntries = (registry, indent = "  ") =>
  registry.entries.map(
    (e) =>
      `${indent}${printKey(e.key)}: {\n${Object.entries(e.style)
        .map(
          ([k, v]) =>
            `${indent}  ${printKey(k)}: ${printValue(registry, k, v, e.provenance)},`
        )
        .join("\n")}\n${indent}},`
  )

module.exports = {
  ABSOLUTE_FILL,
  RN_FILL,
  COLOR_KEYS,
  StyleRegistry,
  camel,
  decompose,
  deepEqual,
  evalStyle,
  exactAtom,
  flatten,
  isEmpty,
  omitKeys,
  parenCond,
  printEntries,
  printLiteral,
  printStyle,
  refsOf,
  staticExpr,
  styleAtom,
  styleEntry,
}
