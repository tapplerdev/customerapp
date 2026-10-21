/**
 * Jest only. Every look an ActionBtn can draw in this app, read from the
 * source: each ActionBtn element in src, its attributes evaluated for every
 * combination of the conditions they depend on.
 *
 * The conditions are shared across one element's attributes, which is what
 * keeps a look real: `disable={!isValid}` and `!isValid && "text-grey10"` are
 * one condition, so a grey label is never paired with an enabled button. A
 * condition is any expression the source can't settle (a prop, a state, a
 * comparison, a call) where a boolean is read: a `?:` test, a `!`, the left
 * of `&&` / `||`, a clsx object value, or a boolean attribute (`disable`,
 * `isLoading`, `isIconRight`, `reverseItems`).
 *
 * What it settles itself: strings, numbers, templates, `+`, clsx (the real
 * one), `?:`, `&&`, `||`, `??`, `!`, JSX elements (their own attributes and
 * text), arrow functions. A title is a placeholder (it changes no look), a
 * handler is a marker. A value it can't settle at a site (a component
 * forwarding its own prop, a memo's object) comes from REWRITES with the
 * reason, and an unused or unmatched rewrite stops the harvest, so a stale
 * one can't go unnoticed.
 */
import crypto from "crypto"
import fs from "fs"
import path from "path"
import clsx from "clsx"
import ts from "typescript"

import { REWRITES } from "./rewrites"

export type ElementSpec = {
  $el: string
  props?: Record<string, SpecValue>
  text?: string
}
export type SpecValue = string | number | boolean | { $fn: true } | ElementSpec

/** One concrete ActionBtn prop set; an undefined prop is left out. */
export type Look = Record<string, SpecValue>

export type HarvestedLook = { props: Look; sites: string[] }

export type Harvest = {
  /** ActionBtn elements found (live JSX, not comments). */
  elements: number
  files: number
  looks: Record<string, HarvestedLook>
}

type Kind = "text" | "fn" | "class" | "bool" | "variant" | "node"

/** ActionBtn's props (ActionBtn.tsx), by how a value is read. */
export const ACTIONBTN_PROPS: Record<string, Kind> = {
  title: "text",
  onPress: "fn",
  className: "class",
  disable: "bool",
  isLoading: "bool",
  textClassName: "class",
  variant: "variant",
  descr: "text",
  Icon: "node",
  isIconRight: "bool",
  classNameTextWrapper: "class",
  classNameIcon: "class",
  IconNearTitle: "node",
  titleSecond: "text",
  reverseItems: "bool",
}

/** What a title (or a text child of an element) is replaced with. */
export const PLACEHOLDER: Record<string, string> = {
  title: "Button title",
  titleSecond: "Second title",
  descr: "Description",
}

type Value =
  | string
  | number
  | boolean
  | null
  | undefined
  | { $fn: true }
  | ElementSpec
  | { $object: Record<string, Value> }

const FN = Object.freeze({ $fn: true as const })

const isElementSpec = (value: Value): value is ElementSpec =>
  typeof value === "object" && value !== null && "$el" in value

const truthy = (value: Value) => Boolean(value)

const text = (node: ts.Node) => node.getText().replace(/\s+/g, " ").trim()

const unwrap = (node: ts.Expression): ts.Expression => {
  let n = node
  while (
    ts.isParenthesizedExpression(n) ||
    ts.isAsExpression(n) ||
    ts.isNonNullExpression(n) ||
    ts.isSatisfiesExpression(n)
  ) {
    n = n.expression
  }
  return n
}

const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
])

const isCallTo = (
  node: ts.Expression,
  name: string
): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === name

type Atom =
  | { kind: "bool"; key: string }
  | { kind: "choice"; key: string; options: ts.Expression[] }

/**
 * One element's attributes, evaluated under an assignment of its conditions.
 * Conditions are discovered while evaluating: an unseen one reads `false`
 * (or its first option) and is recorded, and the caller enumerates again
 * until no new one turns up.
 */
class SiteEvaluator {
  readonly atoms = new Map<string, Atom>()

  private readonly where: string

  private readonly overrides: Record<string, ts.Expression>

  readonly usedOverrides = new Set<string>()

  private env = new Map<string, number>()

  constructor(where: string, overrides: Record<string, string>) {
    this.where = where
    this.overrides = Object.fromEntries(
      Object.entries(overrides).map(([key, source]) => [
        key,
        parseExpression(source, `${where} rewrite of ${key}`),
      ])
    )
  }

  setEnv(env: Map<string, number>) {
    this.env = env
  }

  private fail(message: string, node: ts.Node): never {
    throw new Error(`${this.where}: ${message}: ${text(node)}`)
  }

  private atom(key: string): number {
    if (!this.atoms.has(key)) this.atoms.set(key, { kind: "bool", key })
    return this.env.get(key) ?? 0
  }

  private choice(key: string, options: ts.Expression[]): number {
    if (!this.atoms.has(key))
      this.atoms.set(key, { kind: "choice", key, options })
    return this.env.get(key) ?? 0
  }

  /** An expression the source can't settle: a rewrite, a condition, or by kind. */
  private opaque(node: ts.Expression, kind: Kind | "cond"): Value {
    const key = text(node)
    const override = this.overrides[key]
    if (override) {
      this.usedOverrides.add(key)
      return this.value(override, kind, key)
    }
    if (kind === "cond" || kind === "bool") return this.atom(key) === 1
    if (kind === "fn") return FN
    if (kind === "text") return `{${key}}`
    return this.fail(`a ${kind} value it can't settle (add a rewrite)`, node)
  }

  value(raw: ts.Expression, kind: Kind | "cond", choiceKey?: string): Value {
    const node = unwrap(raw)
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return node.text
    }
    if (ts.isNumericLiteral(node)) return Number(node.text)
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false
    if (node.kind === ts.SyntaxKind.NullKeyword) return null
    if (ts.isIdentifier(node) && node.text === "undefined") return undefined
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return FN
    if (ts.isPrefixUnaryExpression(node)) {
      if (node.operator === ts.SyntaxKind.ExclamationToken) {
        return !truthy(this.value(node.operand, "cond"))
      }
      if (node.operator === ts.SyntaxKind.MinusToken) {
        const operand = this.value(node.operand, kind)
        if (typeof operand === "number") return -operand
      }
      return this.opaque(node, kind)
    }
    if (ts.isConditionalExpression(node)) {
      return truthy(this.value(node.condition, "cond"))
        ? this.value(node.whenTrue, kind, choiceKey)
        : this.value(node.whenFalse, kind, choiceKey)
    }
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
        const left = this.value(node.left, "cond")
        return truthy(left) ? this.value(node.right, kind) : left
      }
      if (op === ts.SyntaxKind.BarBarToken) {
        const left = this.value(node.left, kind)
        return truthy(left) ? left : this.value(node.right, kind)
      }
      if (op === ts.SyntaxKind.QuestionQuestionToken) {
        const left = this.value(node.left, kind)
        return left ?? this.value(node.right, kind)
      }
      if (op === ts.SyntaxKind.PlusToken) {
        const left = this.value(node.left, kind)
        const right = this.value(node.right, kind)
        if (typeof left === "string" || typeof right === "string") {
          return `${String(left)}${String(right)}`
        }
        return this.opaque(node, kind)
      }
      if (COMPARISONS.has(op)) return this.opaque(node, "cond")
      return this.opaque(node, kind)
    }
    if (ts.isTemplateExpression(node)) {
      return (
        node.head.text +
        node.templateSpans
          .map(
            (span) =>
              `${String(this.value(span.expression, "class"))}${span.literal.text}`
          )
          .join("")
      )
    }
    if (isCallTo(node, "clsx")) {
      return clsx(
        ...(node.arguments.map((arg) => {
          const value = this.value(arg, "class")
          if (value && typeof value === "object" && "$object" in value) {
            return Object.fromEntries(
              Object.entries(value.$object).map(([k, v]) => [k, truthy(v)])
            )
          }
          return value
        }) as Parameters<typeof clsx>)
      )
    }
    if (isCallTo(node, "oneOf")) {
      if (!choiceKey) return this.fail("oneOf() outside a rewrite", node)
      const index = this.choice(choiceKey, [...node.arguments])
      return this.value(node.arguments[index], kind)
    }
    if (isCallTo(node, "t") && kind === "text") {
      const [first] = node.arguments
      return first && ts.isStringLiteral(first)
        ? `t:${first.text}`
        : `{${text(node)}}`
    }
    if (ts.isObjectLiteralExpression(node)) {
      const out: Record<string, Value> = {}
      node.properties.forEach((property) => {
        if (
          ts.isPropertyAssignment(property) &&
          (ts.isStringLiteral(property.name) || ts.isIdentifier(property.name))
        ) {
          out[property.name.text] = this.value(property.initializer, "cond")
        } else if (ts.isShorthandPropertyAssignment(property)) {
          out[property.name.text] = this.value(property.name, "cond")
        } else {
          this.fail("an object member it can't read", property)
        }
      })
      return { $object: out }
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      return this.element(node)
    }
    return this.opaque(node, kind)
  }

  private element(node: ts.JsxElement | ts.JsxSelfClosingElement): ElementSpec {
    const opening = ts.isJsxElement(node) ? node.openingElement : node
    const spec: ElementSpec = { $el: opening.tagName.getText() }
    const props: Record<string, SpecValue> = {}
    opening.attributes.properties.forEach((attribute) => {
      if (!ts.isJsxAttribute(attribute)) {
        this.fail("a spread on an element", attribute)
      }
      const name = attribute.name.getText()
      const init = attribute.initializer
      let value: Value = true
      if (init && ts.isStringLiteral(init)) value = init.text
      else if (init && ts.isJsxExpression(init) && init.expression) {
        value = this.value(
          init.expression,
          name === "className" ? "class" : "text"
        )
      }
      if (value !== undefined) props[name] = value as SpecValue
    })
    if (Object.keys(props).length) spec.props = props
    if (ts.isJsxElement(node)) {
      const parts = node.children.flatMap((child) => {
        if (ts.isJsxText(child))
          return child.text.trim() ? [child.text.trim()] : []
        if (ts.isJsxExpression(child) && child.expression) {
          return [String(this.value(child.expression, "text"))]
        }
        return this.fail("a child it can't read", child)
      })
      if (parts.length) spec.text = parts.join(" ")
    }
    return spec
  }
}

const parseExpression = (source: string, where: string): ts.Expression => {
  const file = ts.createSourceFile(
    "rewrite.tsx",
    `const __rewrite = (${source})`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  const statement = file.statements[0]
  if (
    !statement ||
    !ts.isVariableStatement(statement) ||
    !statement.declarationList.declarations[0]?.initializer
  ) {
    throw new Error(`${where}: not an expression: ${source}`)
  }
  return statement.declarationList.declarations[0].initializer
}

const walk = (dir: string, out: string[] = []) => {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!["__tests__", "__fixtures__", "node_modules"].includes(entry.name)) {
        walk(full, out)
      }
    } else if (/\.tsx$/.test(entry.name)) {
      out.push(full)
    }
  })
  return out
}

const IMPORT_FROM =
  /(^|\/)@?tappler\/shared\/src\/components\/UI(\/ActionBtn)?$/

/** The local name ActionBtn goes by in a file, if the file imports it. */
const localName = (source: ts.SourceFile) => {
  let name: string | undefined
  source.statements.forEach((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !IMPORT_FROM.test(statement.moduleSpecifier.text)
    ) {
      return
    }
    const clause = statement.importClause
    if (clause?.name && /ActionBtn$/.test(statement.moduleSpecifier.text)) {
      name = clause.name.text
    }
    const bindings = clause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      bindings.elements.forEach((element) => {
        if ((element.propertyName ?? element.name).text === "ActionBtn") {
          name = element.name.text
        }
      })
    }
  })
  return name
}

const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]])
        )
      : item
  )

const MAX_ATOMS = 16

/** Every assignment of the atoms (choices by option index). */
const assignments = (atoms: Atom[]) => {
  const out: Map<string, number>[] = [new Map()]
  atoms.forEach((atom) => {
    const options = atom.kind === "bool" ? 2 : atom.options.length
    const next: Map<string, number>[] = []
    out.forEach((env) => {
      for (let i = 0; i < options; i += 1) {
        next.push(new Map(env).set(atom.key, i))
      }
    })
    out.splice(0, out.length, ...next)
  })
  return out
}

const looksOf = (
  where: string,
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  overrides: Record<string, string>
) => {
  const evaluator = new SiteEvaluator(where, overrides)
  const attributes = node.attributes.properties.map((attribute) => {
    if (!ts.isJsxAttribute(attribute)) {
      throw new Error(`${where}: a spread on ActionBtn: ${text(attribute)}`)
    }
    const name = attribute.name.getText()
    const kind = ACTIONBTN_PROPS[name]
    if (!kind)
      throw new Error(`${where}: a prop ActionBtn doesn't take: ${name}`)
    return { name, kind, init: attribute.initializer }
  })
  const evaluate = () => {
    const look: Look = {}
    attributes.forEach(({ name, kind, init }) => {
      let value: Value = true
      if (kind === "text") {
        value =
          init && ts.isStringLiteral(init)
            ? init.text
            : init &&
                ts.isJsxExpression(init) &&
                init.expression &&
                (ts.isStringLiteral(unwrap(init.expression)) ||
                  ts.isNoSubstitutionTemplateLiteral(unwrap(init.expression)))
              ? (unwrap(init.expression) as ts.StringLiteral).text
              : PLACEHOLDER[name]
      } else if (init && ts.isStringLiteral(init)) {
        value = init.text
      } else if (init && ts.isJsxExpression(init) && init.expression) {
        value = evaluator.value(init.expression, kind)
      }
      if (value && typeof value === "object" && "$object" in value) {
        throw new Error(`${where}: an object for ${name}`)
      }
      if (value !== undefined && value !== null) look[name] = value as SpecValue
    })
    return look
  }
  // Discover the conditions: enumerate until no new one turns up.
  let known = -1
  let envs: Map<string, number>[] = [new Map()]
  while (known !== evaluator.atoms.size) {
    known = evaluator.atoms.size
    envs.forEach((env) => {
      evaluator.setEnv(env)
      evaluate()
    })
    if (evaluator.atoms.size > MAX_ATOMS) {
      throw new Error(
        `${where}: ${evaluator.atoms.size} conditions, more than ${MAX_ATOMS}`
      )
    }
    envs = assignments([...evaluator.atoms.values()])
  }
  const looks = new Map<string, Look>()
  envs.forEach((env) => {
    evaluator.setEnv(env)
    const look = evaluate()
    looks.set(canonical(look), look)
  })
  const unused = Object.keys(overrides).filter(
    (key) => !evaluator.usedOverrides.has(key)
  )
  if (unused.length) {
    throw new Error(
      `${where}: rewrites that match nothing (stale?): ${unused.join(", ")}`
    )
  }
  return { looks: [...looks.values()], conditions: [...evaluator.atoms.keys()] }
}

export type HarvestedSite = {
  site: string
  conditions: string[]
  looks: number
  rewritten: boolean
}

/** Every ActionBtn element under `srcRoot`, and the distinct looks they draw. */
export const harvestActionBtnLooks = (srcRoot: string) => {
  const byKey = new Map<string, HarvestedLook>()
  const sites: HarvestedSite[] = []
  const files = new Set<string>()
  const usedRewrites = new Set<string>()
  walk(srcRoot).forEach((file) => {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )
    const name = localName(source)
    if (!name) return
    const relative = path.relative(srcRoot, file)
    const visit = (node: ts.Node) => {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        node.tagName.getText() === name
      ) {
        if (ts.isJsxOpeningElement(node)) {
          const parent = node.parent as ts.JsxElement
          if (
            parent.children.some(
              (child) => !(ts.isJsxText(child) && !child.text.trim())
            )
          ) {
            throw new Error(
              `${relative}: an ActionBtn with children (it draws none)`
            )
          }
        }
        const line =
          source.getLineAndCharacterOfPosition(node.getStart()).line + 1
        const where = `${relative}:${line}`
        const rewrite = REWRITES[where]
        if (rewrite) usedRewrites.add(where)
        const { looks, conditions } = looksOf(
          where,
          node,
          rewrite?.values ?? {}
        )
        files.add(relative)
        sites.push({
          site: where,
          conditions,
          looks: looks.length,
          rewritten: !!rewrite,
        })
        looks.forEach((props) => {
          const key = canonical(props)
          const entry = byKey.get(key) ?? { props, sites: [] }
          if (!entry.sites.includes(where)) entry.sites.push(where)
          byKey.set(key, entry)
        })
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  })
  const stale = Object.keys(REWRITES).filter(
    (where) => !usedRewrites.has(where)
  )
  if (stale.length) {
    throw new Error(
      `rewrites for sites that aren't there (moved?): ${stale.join(", ")}`
    )
  }
  const looks: Record<string, HarvestedLook> = {}
  ;[...byKey.keys()].sort().forEach((key) => {
    const hash = crypto.createHash("sha1").update(key).digest("hex")
    looks[hash.slice(0, 10)] = byKey.get(key)!
  })
  return {
    harvest: { elements: sites.length, files: files.size, looks } as Harvest,
    sites,
  }
}

/** Every class string a look hands ActionBtn or an element inside it. */
export const classStringsOf = (looks: Record<string, HarvestedLook>) => {
  const out = new Set<string>()
  const visit = (value: SpecValue, key: string) => {
    if (
      typeof value === "string" &&
      /className$|ClassName|^className/i.test(key)
    ) {
      if (value.trim()) out.add(value)
    } else if (isElementSpec(value as Value)) {
      Object.entries((value as ElementSpec).props ?? {}).forEach(([k, v]) =>
        visit(v, k)
      )
    }
  }
  Object.values(looks).forEach(({ props }) => {
    Object.entries(props).forEach(([key, value]) => visit(value, key))
  })
  return [...out].sort()
}
