/**
 * A DmText's own `style` when it carries typography (fontSize, lineHeight,
 * fontFamily, fontWeight), read statically so the typography can become
 * Text props the way class typography does.
 *
 * DmText draws the style after the classes and before its font layer, so
 * what the text gets is classes, then style, then font. The design system's
 * Text takes no typography in its style (a type error) and draws the style
 * last. So the style's typography keys come out, the props give the result,
 * and the rest of the style stays the text's style. convertDmText checks
 * the whole result per class combination and language before anything is
 * written.
 *
 * Read:
 * - an object literal: its typography values must be constants (a literal,
 *   or a const bound to one); any other value stays exactly as written;
 * - a const object or a StyleSheet entry, in this file or an imported
 *   styles module: every value must be a constant, since what isn't
 *   typography is written again (as atoms or a StyleSheet entry);
 * - takeFontFamily("<classes>", "en" | "ar" | i18n.language) from
 *   tappler-shared's helpers, evaluated with the real helper per language.
 * Anything else (an array, a condition, a prop, a spread) stays as it is.
 */
const { lookup, propertyOf, unwrap } = require("./stylecheck")

const TYPO = ["fontSize", "lineHeight", "fontFamily", "fontWeight"]

const fail = (code, detail) => ({ ok: false, code, detail })

/** `{ value }` for a constant: a literal, or a const name bound to one. */
const constantOf = (node, ctx, depth = 0) => {
  const n = unwrap(node)
  if (!n || depth > 10) return null
  switch (n.type) {
    case "NumericLiteral":
    case "StringLiteral":
    case "BooleanLiteral":
      return { value: n.value }
    case "TemplateLiteral":
      return n.expressions.length === 0
        ? { value: n.quasis[0].value.cooked }
        : null
    case "UnaryExpression": {
      if (n.operator !== "-") return null
      const v = constantOf(n.argument, ctx, depth + 1)
      return v && typeof v.value === "number" ? { value: -v.value } : null
    }
    case "Identifier": {
      const target = lookup(n.name, ctx)
      return target && !target.sheet
        ? constantOf(target.node, target.ctx, depth + 1)
        : null
    }
    default:
      return null
  }
}

const keyOf = (p) =>
  p.key.type === "Identifier"
    ? p.key.name
    : p.key.type === "StringLiteral"
      ? p.key.value
      : null

/**
 * A style object's properties in order: `{ key, value }` for a constant,
 * `{ key, written }` for anything else, which only an inline object may have
 * (and never for a typography key).
 */
const readObject = (obj, ctx, { inline, code }) => {
  const props = []
  for (const p of obj.properties) {
    const key = p.type === "ObjectProperty" && !p.computed ? keyOf(p) : null
    if (key === null)
      return fail(
        "typography-in-style",
        "a spread, computed key or method in a style object with typography"
      )
    const c = constantOf(p.value, ctx)
    if (c) props.push({ key, value: c.value, node: p })
    else if (TYPO.includes(key))
      return fail(
        "dynamic-typography-in-style",
        `\`${key}\` in the element's style isn't a constant`
      )
    else if (!inline)
      return fail(
        "style-unresolvable",
        `\`${key}\` in the style the element names isn't a constant`
      )
    else
      props.push({
        key,
        written: code.slice(p.value.start, p.value.end),
        node: p,
      })
  }
  return { ok: true, props }
}

/** The object a name or `sheet.entry` stands for, with where to read its values. */
const objectAt = (n, ctx) => {
  if (n.type === "Identifier") {
    const t = lookup(n.name, ctx)
    const o = t && !t.sheet ? unwrap(t.node) : null
    return o && o.type === "ObjectExpression" ? { obj: o, ctx: t.ctx } : null
  }
  if (
    n.type === "MemberExpression" &&
    !n.computed &&
    n.object.type === "Identifier" &&
    n.property.type === "Identifier"
  ) {
    const t = lookup(n.object.name, ctx)
    const holder = t && (t.sheet || unwrap(t.node))
    if (!holder || holder.type !== "ObjectExpression") return null
    const prop = propertyOf(holder, n.property.name)
    const o = prop ? unwrap(prop.value) : null
    return o && o.type === "ObjectExpression" ? { obj: o, ctx: t.ctx } : null
  }
  return null
}

const HELPERS = /(^|\/)helpers\/helpers$/

/**
 * takeFontFamily(classes, lang) from tappler-shared's helpers, as a function
 * of the language the text renders in; null for any other call.
 */
const fontCall = (n, scope, ds) => {
  if (n.callee.type !== "Identifier" || n.arguments.length !== 2) return null
  const binding = scope.getBinding(n.callee.name)
  if (
    !binding ||
    !binding.path.isImportSpecifier() ||
    (binding.path.node.imported.name || binding.path.node.imported.value) !==
      "takeFontFamily" ||
    !HELPERS.test(binding.path.parent.source.value)
  )
    return null
  const [classes, lang] = n.arguments
  if (classes.type !== "StringLiteral") return null
  if (lang.type === "StringLiteral")
    return () => ds.helpers.takeFontFamily(classes.value, lang.value) || {}
  // i18n.language, `i18n` from useTranslation(): the language DmText reads
  if (
    lang.type === "MemberExpression" &&
    !lang.computed &&
    lang.object.type === "Identifier" &&
    lang.property.name === "language"
  ) {
    const b = scope.getBinding(lang.object.name)
    const init = b && b.path.isVariableDeclarator() && b.path.node.init
    if (
      init &&
      init.type === "CallExpression" &&
      init.callee.type === "Identifier" &&
      init.callee.name === "useTranslation"
    )
      return (current) =>
        ds.helpers.takeFontFamily(classes.value, current) || {}
  }
  return null
}

const asStyle = (props) =>
  Object.fromEntries(
    props.map((p) => [p.key, "written" in p ? { written: p.written } : p.value])
  )

/**
 * For a DmText's `style` attribute with typography in it:
 *   { ok: true, en, ar, rest }
 * `en`/`ar`: the style DmText puts between the classes and its font layer, a
 * value written in the source standing as { written: "<source>" };
 * `rest`: what Text's style gets instead, one of
 *   { kind: "none" }                      nothing (the attribute goes)
 *   { kind: "raw", src, value }           the object minus its typography,
 *                                         each value as written
 *   { kind: "static", value }             a named style's non-typography keys,
 *                                         to write again
 * Or { ok: false, code, detail } when it can't be read.
 */
const readTextStyle = (attrPath, { file, code, ds }) => {
  const value = attrPath.node.value
  if (!value || value.type !== "JSXExpressionContainer")
    return fail(
      "style-unresolvable",
      "a style attribute that isn't an expression"
    )
  const n = unwrap(value.expression)
  const ctx = { file, scope: attrPath.scope }
  if (n.type === "ObjectExpression") {
    const r = readObject(n, ctx, { inline: true, code })
    if (!r.ok) return r
    const kept = r.props.filter((p) => !TYPO.includes(p.key))
    const style = asStyle(r.props)
    return {
      ok: true,
      en: style,
      ar: style,
      rest: kept.length
        ? {
            kind: "raw",
            src: `{ ${kept.map((p) => code.slice(p.node.start, p.node.end)).join(", ")} }`,
            value: asStyle(kept),
          }
        : { kind: "none" },
    }
  }
  if (n.type === "Identifier" || n.type === "MemberExpression") {
    const at = objectAt(n, ctx)
    if (!at)
      return fail(
        "typography-in-style",
        `\`${code.slice(n.start, n.end)}\` isn't an object or StyleSheet entry the codemod can read`
      )
    const r = readObject(at.obj, at.ctx, { inline: false, code })
    if (!r.ok) return r
    const kept = r.props.filter((p) => !TYPO.includes(p.key))
    const style = asStyle(r.props)
    return {
      ok: true,
      en: style,
      ar: style,
      rest: kept.length
        ? { kind: "static", value: asStyle(kept) }
        : { kind: "none" },
    }
  }
  if (n.type === "CallExpression") {
    const font = fontCall(n, attrPath.scope, ds)
    if (!font)
      return fail(
        "typography-in-style",
        `\`${code.slice(n.callee.start, n.callee.end)}(...)\` in the element's style`
      )
    return { ok: true, en: font("en"), ar: font("ar"), rest: { kind: "none" } }
  }
  const shape =
    n.type === "ArrayExpression"
      ? "an array"
      : n.type === "ConditionalExpression" || n.type === "LogicalExpression"
        ? "a condition"
        : `a ${n.type}`
  return fail("typography-in-style", `${shape} as a style with typography`)
}

module.exports = { readTextStyle, TYPO }
