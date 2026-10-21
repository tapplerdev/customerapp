/**
 * className -> style for an element NativeWind styles itself (a React Native
 * or third-party host it wraps, or DmView, which hands className to a
 * wrapped View): the class string's style for every combination of its
 * conditions, written as atoms and StyleSheet entries in the same order.
 *
 * The output is built from the source's own structure (one style per clsx
 * part, conditions kept where they were) and then checked, for every
 * combination, against what NativeWind composes for the whole string. Where
 * the two differ (transforms in two parts: NativeWind joins them into one
 * list, a style array keeps only the last), it falls back to one style per
 * combination for up to two conditions, and otherwise gives up on the site.
 */
const { NwResolveError, resolve } = require("../nw-resolve")
const { assignments, atomsOf, evaluate } = require("./classexpr")
const {
  deepEqual,
  evalStyle,
  flatten,
  isEmpty,
  omitKeys,
  staticExpr,
} = require("./styles")

class Unconvertible extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = "Unconvertible"
    this.code = code
    this.detail = detail
  }
}

const FONT_CLASS = /^font-custom\d{3}$/

/** resolve(), with NativeWind's refusals turned into a reportable reason. */
const resolveOrLeave = (className, { fontIsDead }) => {
  let r
  try {
    r = resolve(className)
  } catch (error) {
    if (error instanceof NwResolveError)
      throw new Unconvertible(
        "unresolvable-class",
        error.problems.map((p) => `${p.class}: ${p.reason}`).join("; ")
      )
    throw error
  }
  const dropped = [...r.dropped]
  // font-customNNN is read only by DmText and ActionBtn; on anything else
  // NativeWind emits nothing for it and nothing else reads it.
  if (fontIsDead)
    for (const c of r.consumed)
      dropped.push({
        class: c.class,
        reason:
          "font-customNNN works only on DmText and ActionBtn (their takeFontStyles); here NativeWind emits nothing for it",
      })
  return { ...r, dropped }
}

const condWord = (cond, negate) => {
  const words = (cond.src.match(/[A-Za-z_$][\w$]*/g) || []).filter(
    (w) => !["true", "false", "null", "undefined", "typeof"].includes(w)
  )
  let word = words.length ? words[words.length - 1] : "alt"
  word = word.replace(/^(is|has|should|show|can)(?=[A-Z])/, "")
  if (/^[A-Z0-9]+$/.test(word)) word = word[0] + word.slice(1).toLowerCase()
  word = word[0].toUpperCase() + word.slice(1)
  return (cond.neg !== negate ? "Not" : "") + word
}

// Adjacent literal parts of one clsx read as one class string.
const mergeStatic = (parts) => {
  const out = []
  for (const p of parts) {
    const last = out[out.length - 1]
    if (p.t === "str" && last && last.t === "str")
      out[out.length - 1] = { t: "str", v: `${last.v} ${p.v}` }
    else out.push(p)
  }
  return out
}

/**
 * The style expression for a className IR.
 * - `exclude`: keys that go elsewhere (DmText's typography), left out of
 *   the style and of the check.
 * - `fontIsDead`: report font-customNNN as dropped (not DmText/ActionBtn).
 * Returns { expr, dropped, atomIds, combos } or throws Unconvertible.
 */
const styleFromIR = (ir, options) => {
  const {
    table,
    registry,
    hint,
    exclude = new Set(),
    fontIsDead = true,
    expectedFor,
  } = options
  const atomIds = [...atomsOf(ir)]
  let envs
  try {
    envs = assignments(atomIds)
  } catch (error) {
    throw new Unconvertible("too-many-conditions", error.message)
  }
  const dropped = new Map()
  const combos = envs.map((env) => {
    const str = evaluate(ir, env)
    const r = resolveOrLeave(str, { fontIsDead })
    for (const d of r.dropped) dropped.set(d.class, d)
    const expected = expectedFor
      ? expectedFor(str, r, env)
      : omitKeys(r.style, exclude)
    return { env, str, r, expected }
  })

  const emit = (node, top, branchHint) => {
    switch (node.t) {
      case "str": {
        if (node.v.trim() === "") return null
        const r = resolveOrLeave(node.v, { fontIsDead })
        const style = omitKeys(r.style, exclude)
        return staticExpr(style, {
          registry,
          hint: branchHint,
          provenance: r.provenance,
          split: top,
        })
      }
      case "falsy":
        return null
      case "if": {
        const then = node.then
          ? emit(node.then, false, `${branchHint}${condWord(node.cond, false)}`)
          : null
        const otherwise = node.else
          ? emit(node.else, false, `${branchHint}${condWord(node.cond, true)}`)
          : null
        if (!then && !otherwise) return null
        if (!then)
          return {
            k: "if",
            cond: negated(node.cond),
            then: otherwise,
            else: null,
          }
        return { k: "if", cond: node.cond, then, else: otherwise }
      }
      case "cat": {
        if (node.sep !== " ") throw new Glued()
        const items = mergeStatic(node.parts)
          .map((p) => emit(p, top, branchHint))
          .filter(Boolean)
          .flatMap((x) => (top && x.k === "arr" ? x.items : [x]))
        if (items.length === 0) return null
        return items.length === 1 ? items[0] : { k: "arr", items }
      }
      default:
        throw new Error(`ds-codemod: internal: IR ${node.t}`)
    }
  }

  const matches = (expr) =>
    combos.every((c) =>
      deepEqual(flatten(evalStyle(expr, c.env, registry.a)), c.expected)
    )

  let expr = null
  let structural = true
  const cp = registry.checkpoint()
  try {
    expr = emit(ir, true, hint)
  } catch (error) {
    if (!(error instanceof Glued)) throw error
    structural = false
  }
  if (!structural || !matches(expr)) {
    registry.rollback(cp)
    if (atomIds.length > 2)
      throw new Unconvertible(
        "not-expressible",
        structural
          ? "per-part styles don't flatten to NativeWind's result (transforms in more than one part?) and there are more than 2 conditions"
          : "classes glued across a template expression, with more than 2 conditions"
      )
    expr = perCombination(combos, atomIds, table, registry, hint)
    if (!matches(expr))
      throw new Error("ds-codemod: internal: per-combination style mismatch")
  }
  return {
    expr,
    dropped: [...dropped.values()],
    atomIds,
    combos,
  }
}

class Glued extends Error {}

const negated = (cond) => ({
  ...cond,
  neg: !cond.neg,
  src: cond.wrap ? `!(${cond.src})` : `!${cond.src}`,
  wrap: false,
})

/** One style per combination: `a ? (b ? s11 : s10) : (b ? s01 : s00)`. */
const perCombination = (combos, atomIds, table, registry, hint) => {
  const leaf = (env) => {
    const c = combos.find((x) =>
      atomIds.every((id) => x.env.get(id) === env.get(id))
    )
    return isEmpty(c.expected)
      ? null
      : staticExpr(c.expected, {
          registry,
          hint,
          provenance: c.r.provenance,
          split: false,
        })
  }
  const build = (i, env) => {
    if (i === atomIds.length) return leaf(env)
    const id = atomIds[i]
    const t = build(i + 1, new Map([...env, [id, true]]))
    const f = build(i + 1, new Map([...env, [id, false]]))
    if (!t && !f) return null
    if (sameExpr(t, f)) return t
    return { k: "if", cond: table.atomCond(id, true), then: t, else: f }
  }
  return build(0, new Map())
}

const sameExpr = (x, y) => JSON.stringify(strip(x)) === JSON.stringify(strip(y))
const strip = (x) =>
  !x
    ? null
    : x.k === "entry"
      ? { k: "entry", key: x.entry.key }
      : x.k === "arr"
        ? { k: "arr", items: x.items.map(strip) }
        : x.k === "if"
          ? {
              k: "if",
              c: [x.cond.id, x.cond.neg],
              t: strip(x.then),
              e: strip(x.else),
            }
          : x

module.exports = {
  FONT_CLASS,
  Unconvertible,
  condWord,
  resolveOrLeave,
  styleFromIR,
}
