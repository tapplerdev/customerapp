/**
 * Can a DmText's own `style` move onto the design system's Text unchanged?
 * Only if it carries no typography: DmText puts its className font (and
 * Arabic line height) AFTER the caller's style, Text puts the caller's style
 * last, and Text's style type bans fontSize/lineHeight/fontFamily/fontWeight.
 *
 * Statically: object literals, arrays, conditionals, constants in this file,
 * and StyleSheet entries in this file or an imported styles module are read;
 * anything else (a prop, a call such as takeFontFamily) can't be proved free
 * of typography, so the site stays as it is.
 */
const { findExport, parseFile, resolveSource } = require("./modules")

const TYPO = new Set(["fontSize", "lineHeight", "fontFamily", "fontWeight"])

const fail = (code, detail) => ({ ok: false, code, detail })
const OK = { ok: true }

const unwrap = (node) => {
  let n = node
  while (
    n &&
    (n.type === "TSAsExpression" ||
      n.type === "TSNonNullExpression" ||
      n.type === "TSSatisfiesExpression" ||
      n.type === "ParenthesizedExpression")
  )
    n = n.expression
  return n
}

// StyleSheet.create({ ... }) -> the object literal.
const sheetObject = (node) => {
  const n = unwrap(node)
  if (
    n &&
    n.type === "CallExpression" &&
    n.callee.type === "MemberExpression" &&
    n.callee.object.type === "Identifier" &&
    n.callee.object.name === "StyleSheet" &&
    n.callee.property.name === "create" &&
    n.arguments[0] &&
    n.arguments[0].type === "ObjectExpression"
  )
    return n.arguments[0]
  return null
}

const propertyOf = (objectNode, key) =>
  objectNode.properties.find(
    (p) =>
      p.type === "ObjectProperty" &&
      !p.computed &&
      ((p.key.type === "Identifier" && p.key.name === key) ||
        (p.key.type === "StringLiteral" && p.key.value === key))
  )

/**
 * Checks a style value. `scope` is a Babel scope at the element (for this
 * file's bindings); `file` is the file being converted. Values in other
 * files are walked as plain AST (no scope), through their top level.
 */
const checkStyleNode = (node, ctx, depth = 0) => {
  if (depth > 10) return fail("style-unresolvable", "too deep")
  const n = unwrap(node)
  if (!n) return OK
  switch (n.type) {
    case "NullLiteral":
    case "BooleanLiteral":
      return OK
    case "Identifier":
      if (n.name === "undefined") return OK
      return checkIdentifier(n.name, ctx, depth)
    case "ObjectExpression": {
      for (const p of n.properties) {
        if (p.type === "SpreadElement") {
          const r = checkStyleNode(p.argument, ctx, depth + 1)
          if (!r.ok) return r
          continue
        }
        if (p.type !== "ObjectProperty" || p.computed)
          return fail(
            "style-unresolvable",
            "a computed key or method in a style object"
          )
        const key = p.key.type === "Identifier" ? p.key.name : p.key.value
        if (TYPO.has(key))
          return fail(
            "typography-in-style",
            `\`${key}\` in the element's style`
          )
      }
      return OK
    }
    case "ArrayExpression":
      for (const el of n.elements) {
        if (!el) continue
        const r = checkStyleNode(
          el.type === "SpreadElement" ? el.argument : el,
          ctx,
          depth + 1
        )
        if (!r.ok) return r
      }
      return OK
    case "ConditionalExpression": {
      const a = checkStyleNode(n.consequent, ctx, depth + 1)
      return a.ok ? checkStyleNode(n.alternate, ctx, depth + 1) : a
    }
    case "LogicalExpression": {
      const right = checkStyleNode(n.right, ctx, depth + 1)
      if (!right.ok || n.operator === "&&") return right
      return checkStyleNode(n.left, ctx, depth + 1)
    }
    case "MemberExpression": {
      if (n.computed || n.object.type !== "Identifier")
        return fail("style-unresolvable", "a computed style lookup")
      return checkMember(n.object.name, n.property.name, ctx, depth)
    }
    case "CallExpression": {
      const callee =
        n.callee.type === "Identifier"
          ? n.callee.name
          : n.callee.type === "MemberExpression"
            ? n.callee.property.name
            : "a function"
      return fail(
        callee === "takeFontFamily" || callee === "takeFontStyles"
          ? "typography-in-style"
          : "style-unresolvable",
        `\`${callee}(...)\` in the element's style`
      )
    }
    default:
      return fail("style-unresolvable", `a ${n.type} in the element's style`)
  }
}

// A name: a binding in this file (const) or a top-level one elsewhere.
const checkIdentifier = (name, ctx, depth) => {
  const target = lookup(name, ctx)
  if (!target)
    return fail("style-unresolvable", `\`${name}\` isn't readable here`)
  if (target.sheet)
    return fail("style-unresolvable", `\`${name}\` is a whole StyleSheet`)
  return checkStyleNode(target.node, target.ctx, depth + 1)
}

const checkMember = (objectName, key, ctx, depth) => {
  const target = lookup(objectName, ctx)
  if (!target)
    return fail(
      "style-unresolvable",
      `\`${objectName}.${key}\` isn't readable here`
    )
  const obj = target.sheet || unwrap(target.node)
  if (!obj || obj.type !== "ObjectExpression")
    return fail(
      "style-unresolvable",
      `\`${objectName}\` isn't a StyleSheet or object literal`
    )
  const prop = propertyOf(obj, key)
  if (!prop)
    return fail("style-unresolvable", `\`${objectName}.${key}\` not found`)
  return checkStyleNode(prop.value, target.ctx, depth + 1)
}

/**
 * { node, sheet, ctx } for a name: its constant initialiser (or the object
 * inside StyleSheet.create), in this file or followed through an import.
 */
const lookup = (name, ctx) => {
  if (ctx.scope) {
    const binding = ctx.scope.getBinding(name)
    if (!binding) return null
    const p = binding.path
    if (p.isVariableDeclarator()) {
      if (!binding.constant || !p.node.init) return null
      const sheet = sheetObject(p.node.init)
      return { node: p.node.init, sheet, ctx }
    }
    if (p.isImportDefaultSpecifier() || p.isImportSpecifier()) {
      const source = p.parent.source.value
      const imported = p.isImportDefaultSpecifier()
        ? "default"
        : p.node.imported.name || p.node.imported.value
      return lookupImport(ctx.file, source, imported)
    }
    return null
  }
  // Another file: top level only.
  const { ast } = parseFile(ctx.file)
  for (const stmt of ast.program.body) {
    const decl =
      stmt.type === "ExportNamedDeclaration" && stmt.declaration
        ? stmt.declaration
        : stmt
    if (decl.type === "VariableDeclaration" && decl.kind === "const")
      for (const d of decl.declarations)
        if (d.id.type === "Identifier" && d.id.name === name && d.init)
          return { node: d.init, sheet: sheetObject(d.init), ctx }
    if (decl.type === "ImportDeclaration")
      for (const s of decl.specifiers)
        if (s.local.name === name)
          return lookupImport(
            ctx.file,
            decl.source.value,
            s.type === "ImportDefaultSpecifier" ? "default" : s.imported.name
          )
  }
  return null
}

const lookupImport = (fromFile, source, imported) => {
  const target = resolveSource(fromFile, source)
  if (target.kind !== "file") return null
  const found = findExport(target.file, imported)
  if (!found || !found.node) return null
  const node =
    found.node.type === "VariableDeclarator" ? found.node.init : found.node
  if (!node) return null
  return {
    node,
    sheet: sheetObject(node),
    ctx: { file: found.file, scope: null },
  }
}

/** For a `style` attribute (or none). */
const checkStyleAttr = (attrPath, file) => {
  if (!attrPath) return OK
  const value = attrPath.node.value
  if (!value || value.type !== "JSXExpressionContainer")
    return fail(
      "style-unresolvable",
      "a style attribute that isn't an expression"
    )
  return checkStyleNode(value.expression, {
    file,
    scope: attrPath.scope,
  })
}

module.exports = {
  checkStyleAttr,
  checkStyleNode,
  lookup,
  sheetObject,
  propertyOf,
  unwrap,
}
