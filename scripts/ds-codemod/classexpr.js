/**
 * A className value as data: what string it produces for every combination of
 * the conditions in it.
 *
 * The value is read into a small tree (IR):
 *   { t: "str", v }                     a literal piece of class string
 *   { t: "cat", sep: " ", parts }       clsx(...) or whitespace-separated
 *                                       parts: non-empty parts joined by " "
 *   { t: "cat", sep: "", parts }        a template literal or `+` whose
 *                                       pieces touch: joined exactly
 *   { t: "if", cond, then, else }       `c && x`, `c ? x : y`, `{ x: c }`;
 *                                       `else` null means "nothing"
 *   { t: "falsy" }                      `${c && "x"}` when c is falsy: the
 *                                       template prints "false"
 * A condition is { id, neg, src }: `id` names an atom (one boolean the class
 * string depends on), `neg` is a leading `!`, `src` is the source text as
 * written. `!x` and `x` share an atom, so a ternary on `isValid` and a
 * `disable={!isValid}` are one condition, not two.
 *
 * Anything that isn't a literal, clsx, a template, a ternary, `&&`, `+` or a
 * constant this file (or an imported module) defines is DYNAMIC: its string
 * isn't knowable here, and the site is reported instead of guessed at.
 */
const generate = require("@babel/generator").default

class Dynamic extends Error {
  constructor(reason, node) {
    super(reason)
    this.name = "Dynamic"
    this.node = node
  }
}

const MAX_ATOMS = 6

const IMPURE = new Set([
  "CallExpression",
  "OptionalCallExpression",
  "NewExpression",
  "AssignmentExpression",
  "UpdateExpression",
  "AwaitExpression",
  "YieldExpression",
  "TaggedTemplateExpression",
  "ImportExpression",
])

const isPure = (node) => {
  let pure = true
  const visit = (n) => {
    if (!pure || !n || typeof n.type !== "string") return
    if (IMPURE.has(n.type)) {
      pure = false
      return
    }
    for (const key of Object.keys(n)) {
      if (
        key === "loc" ||
        key === "start" ||
        key === "end" ||
        key === "extra" ||
        key.endsWith("Comments")
      )
        continue
      const v = n[key]
      if (Array.isArray(v)) v.forEach(visit)
      else if (v && typeof v.type === "string") visit(v)
    }
  }
  visit(node)
  return pure
}

const canonical = (node) =>
  generate(node, { compact: true, comments: false }).code

const unparen = (node) => {
  let n = node
  while (n.type === "ParenthesizedExpression") n = n.expression
  return n
}

/**
 * The conditions a className depends on, shared across every attribute of
 * one element (ActionBtn's className and textClassName and its `disable`
 * must agree on what `!isValid` is).
 */
class AtomTable {
  constructor(code) {
    this.code = code
    this.atoms = []
    this.byText = new Map()
  }

  /** { id, neg, src } for a condition expression. */
  cond(node) {
    let n = unparen(node)
    let neg = false
    while (n.type === "UnaryExpression" && n.operator === "!") {
      neg = !neg
      n = unparen(n.argument)
    }
    const text = canonical(n)
    let id = this.byText.get(text)
    if (id === undefined) {
      id = this.atoms.length
      this.atoms.push({
        id,
        text,
        node: n,
        src: this.code.slice(n.start, n.end),
        pure: isPure(n),
        count: 0,
      })
      this.byText.set(text, id)
    }
    this.atoms[id].count++
    const outer = unparen(node)
    return {
      id,
      neg,
      src: this.code.slice(outer.start, outer.end),
      // Printed in front of `&&` or `? :`, these would bind differently.
      wrap:
        LOOSE.has(outer.type) &&
        !(outer.type === "LogicalExpression" && outer.operator === "&&"),
    }
  }

  /** A condition for an assignment of its atom, as source. */
  atomCond(id, value) {
    const atom = this.atoms[id]
    const wrap = LOOSE.has(atom.node.type)
    const src = wrap ? `(${atom.src})` : atom.src
    return {
      id,
      neg: !value,
      src: value ? src : `!${wrap ? src : parenUnary(atom.node, atom.src)}`,
      wrap: false,
    }
  }
}

// Operators that bind looser than `&&` / `?:`, or can't sit beside them.
const LOOSE = new Set([
  "LogicalExpression",
  "ConditionalExpression",
  "AssignmentExpression",
  "SequenceExpression",
  "ArrowFunctionExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "YieldExpression",
])

// `!` binds tighter than a binary operator: `!a === b` is not `!(a === b)`.
const parenUnary = (node, src) =>
  node.type === "BinaryExpression" || node.type === "LogicalExpression"
    ? `(${src})`
    : src

/** Every true/false assignment of `ids` (bit i of the index is ids[i]). */
const assignments = (ids) => {
  if (ids.length > MAX_ATOMS)
    throw new Dynamic(
      `${ids.length} conditions (more than ${MAX_ATOMS} to check by enumeration)`
    )
  const out = []
  for (let mask = 0; mask < 1 << ids.length; mask++) {
    const env = new Map()
    ids.forEach((id, i) => env.set(id, Boolean(mask & (1 << i))))
    out.push(env)
  }
  return out
}

const truth = (cond, env) => {
  const v = env.get(cond.id)
  if (v === undefined)
    throw new Error(`ds-codemod: internal: condition ${cond.id} unassigned`)
  return cond.neg ? !v : v
}

/** The runtime string for one assignment. */
const evaluate = (ir, env) => {
  switch (ir.t) {
    case "str":
      return ir.v
    case "falsy":
      return "false"
    case "if": {
      const branch = truth(ir.cond, env) ? ir.then : ir.else
      return branch ? evaluate(branch, env) : ""
    }
    case "cat": {
      const parts = ir.parts.map((p) => evaluate(p, env))
      return ir.sep === " "
        ? parts.filter((p) => p !== "").join(" ")
        : parts.join("")
    }
    default:
      throw new Error(`ds-codemod: internal: IR ${ir.t}`)
  }
}

const atomsOf = (ir, set = new Set()) => {
  if (ir.t === "if") {
    set.add(ir.cond.id)
    if (ir.then) atomsOf(ir.then, set)
    if (ir.else) atomsOf(ir.else, set)
  } else if (ir.t === "cat") ir.parts.forEach((p) => atomsOf(p, set))
  return set
}

const hasWhitespaceEdge = (s, atStart) =>
  s === "" ? null : atStart ? /^\s/.test(s) : /\s$/.test(s)

/**
 * Turns a template's pieces into clsx-like parts when every expression is
 * set off by whitespace (or the string's ends): then the pieces never glue
 * into one class, and each can be styled on its own. Returns null when two
 * pieces touch (`mt-${x}`).
 */
const separatedParts = (pieces) => {
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]
    if (p.t === "str") continue
    const before = i > 0 ? pieces[i - 1] : null
    const after = i < pieces.length - 1 ? pieces[i + 1] : null
    if (
      before &&
      (before.t !== "str" || hasWhitespaceEdge(before.v, false) === false)
    )
      return null
    if (
      after &&
      (after.t !== "str" || hasWhitespaceEdge(after.v, true) === false)
    )
      return null
  }
  return pieces.filter((p) => !(p.t === "str" && p.v.trim() === ""))
}

/**
 * Reads a className expression into IR. `resolveIdentifier(path)` is asked
 * for an identifier's IR (a constant's value) and returns null when it
 * can't say. `path` is a Babel NodePath of the expression.
 */
const buildIR = (rootPath, table, options = {}) => {
  const { resolveIdentifier = () => null, clsxNames = new Set() } = options

  const read = (path, ctx) => {
    const node = path.node
    switch (node.type) {
      case "StringLiteral":
        return { t: "str", v: node.value }
      case "NumericLiteral":
        return { t: "str", v: String(node.value) }
      case "ParenthesizedExpression":
        return read(path.get("expression"), ctx)
      case "TSAsExpression":
      case "TSNonNullExpression":
      case "TSSatisfiesExpression":
        return read(path.get("expression"), ctx)
      case "NullLiteral":
        if (ctx === "template") return { t: "str", v: "null" }
        return null
      case "Identifier": {
        if (node.name === "undefined")
          return ctx === "template" ? { t: "str", v: "undefined" } : null
        const ir = resolveIdentifier(path)
        if (ir) return ir
        throw new Dynamic(
          `\`${node.name}\` isn't a constant this file can read`,
          node
        )
      }
      case "BooleanLiteral":
        if (ctx === "template") return { t: "str", v: String(node.value) }
        if (node.value === false) return null
        throw new Dynamic("`true` where a class string is expected", node)
      case "TemplateLiteral": {
        const pieces = []
        node.quasis.forEach((q, i) => {
          if (q.value.cooked) pieces.push({ t: "str", v: q.value.cooked })
          if (i < node.expressions.length) {
            const exprPath = path.get(`expressions.${i}`)
            pieces.push(read(exprPath, "template"))
          }
        })
        const parts = separatedParts(pieces)
        if (parts) return { t: "cat", sep: " ", parts }
        return { t: "cat", sep: "", parts: pieces }
      }
      case "BinaryExpression": {
        if (node.operator !== "+")
          throw new Dynamic(`\`${node.operator}\` expression`, node)
        const pieces = [
          read(path.get("left"), "template"),
          read(path.get("right"), "template"),
        ]
        const parts = separatedParts(pieces)
        if (parts) return { t: "cat", sep: " ", parts }
        return { t: "cat", sep: "", parts: pieces }
      }
      case "ConditionalExpression": {
        const cond = table.cond(node.test)
        const then = read(path.get("consequent"), ctx)
        const otherwise = read(path.get("alternate"), ctx)
        return { t: "if", cond, then: then || null, else: otherwise || null }
      }
      case "LogicalExpression": {
        if (node.operator !== "&&")
          throw new Dynamic(
            `\`${node.operator}\`: its value is the left side when that is truthy, which isn't a class string here`,
            node
          )
        const cond = table.cond(node.left)
        const then = read(path.get("right"), ctx)
        // In a template the falsy side is printed ("false"); anywhere else
        // (clsx, or the whole className) it is no class at all.
        return {
          t: "if",
          cond,
          then: then || null,
          else: ctx === "template" ? { t: "falsy" } : null,
        }
      }
      case "CallExpression": {
        const callee = node.callee
        if (callee.type === "Identifier" && clsxNames.has(callee.name))
          return readClsxArgs(path.get("arguments"))
        throw new Dynamic(
          `a call to ${callee.type === "Identifier" ? `\`${callee.name}\`` : "a function"}`,
          node
        )
      }
      case "ArrayExpression":
        if (ctx === "clsx") return readClsxArgs(path.get("elements"))
        throw new Dynamic("an array where a class string is expected", node)
      case "ObjectExpression":
        if (ctx !== "clsx")
          throw new Dynamic("an object where a class string is expected", node)
        return {
          t: "cat",
          sep: " ",
          parts: path.get("properties").map((propPath) => {
            const prop = propPath.node
            if (prop.type !== "ObjectProperty" || prop.computed)
              throw new Dynamic("a computed or spread clsx object key", prop)
            const key =
              prop.key.type === "StringLiteral"
                ? prop.key.value
                : prop.key.type === "Identifier"
                  ? prop.key.name
                  : null
            if (key === null) throw new Dynamic("a clsx object key", prop)
            return {
              t: "if",
              cond: table.cond(prop.value),
              then: { t: "str", v: key },
              else: null,
            }
          }),
        }
      default:
        throw new Dynamic(`a ${node.type}`, node)
    }
  }

  const readClsxArgs = (argPaths) => ({
    t: "cat",
    sep: " ",
    parts: argPaths
      .map((p) => {
        if (p.node && p.node.type === "SpreadElement")
          throw new Dynamic("a spread argument to clsx", p.node)
        return p.node ? read(p, "clsx") : null
      })
      .filter(Boolean),
  })

  const ir = read(rootPath, "attr")
  return ir
}

/** Flattens nested clsx-like parts into one list (the order NativeWind sees). */
const flattenParts = (ir) => {
  if (ir.t === "cat" && ir.sep === " ")
    return ir.parts.flatMap((p) => flattenParts(p))
  if (ir.t === "str" && ir.v.trim() === "") return []
  return [ir]
}

module.exports = {
  AtomTable,
  Dynamic,
  unparen,
  MAX_ATOMS,
  assignments,
  atomsOf,
  buildIR,
  evaluate,
  flattenParts,
  truth,
  canonical,
  isPure,
}
