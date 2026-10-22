/**
 * Jest only. Every prop set a component's real call sites can hand it, read
 * from the source: each JSX element of the component under src, its
 * attributes evaluated for every combination of the conditions they depend
 * on. The generic form of buttonLooks/harvest (ActionBtn's, at the archive tag), for any
 * component a wave 2 conversion changes.
 *
 * The conditions are shared across one element's attributes, which is what
 * keeps a prop set real: `disabled={!isValid}` and `!isValid && "text-grey10"`
 * are one condition, so a grey label never comes with an enabled control. A
 * condition is any expression the source can't settle (a prop, a state, a
 * comparison, a call) where a boolean is read: a `?:` test, a `!`, the left
 * of `&&`/`||`, a clsx object value, or a `bool` prop.
 *
 * What it settles itself: strings, numbers, templates, `+`, clsx (the real
 * one), `?:`, `&&`, `||`, `??`, `!`, object and array literals, JSX elements
 * (their attributes and text), arrow functions, named constants given in
 * `constants`. How an unsettled value is read depends on its prop's kind:
 *
 *   text   a placeholder (a title changes no look): `{source text}`
 *   fn     a marker, `{ $fn: true }`
 *   bool   a condition (both values)
 *   class  must settle: a rewrite gives it, or the harvest stops
 *   node   must settle (an element, null, false), or a rewrite
 *   value  must settle (a literal, an enum), or a rewrite
 *   any    a marker naming the source, `{ $opaque: "item.photos" }`, which
 *          the test turns into a value (buildProps' `opaque`)
 *
 * A value a site can't settle comes from REWRITES, by site ("file:line"),
 * each with its reason, written as source (`oneOf("a", "b")` for a choice).
 * An unused or unmatched rewrite stops the harvest, so a stale one can't go
 * unnoticed. A prop the component doesn't take (not in `props`) stops it
 * too: say what each prop is.
 */
import crypto from "crypto"
import fs from "fs"
import path from "path"
import clsx from "clsx"
import ts from "typescript"

export type PropKind =
  | "text"
  | "fn"
  | "class"
  | "bool"
  | "node"
  | "value"
  | "any"

export type ElementSpec = {
  $el: string
  props?: Record<string, SpecValue>
  /** Its children: one text, or a list of texts and elements. */
  children?: SpecValue
}

export type SpecValue =
  | string
  | number
  | boolean
  | null
  | { $fn: true }
  | { $opaque: string }
  | ElementSpec
  | SpecValue[]
  | { [key: string]: SpecValue }

/** One concrete prop set; an undefined prop is left out. */
export type PropSet = Record<string, SpecValue>

export type HarvestedCase = { props: PropSet; sites: string[] }

export type Rewrite = {
  /** Why the site's value can't be read off the source. */
  reason: string
  /** Source text of an expression at the site -> what to read instead (source). */
  values: Record<string, string>
}

export type HarvestOptions = {
  /** Where to look (src). Tests, fixtures and node_modules are skipped. */
  srcRoot: string
  /** The module the component is imported from, as a call site spells it. */
  importFrom: RegExp
  /**
   * The export: "default" (default), a named export (from a barrel), or
   * several, for a component imported both ways.
   */
  exportName?: string | string[]
  /** Every prop the component takes, by how a value is read. */
  props: Record<string, PropKind>
  /** Values for what a site can't settle, by "file:line" (relative to srcRoot). */
  rewrites?: Record<string, Rewrite>
  /**
   * Sites left out, by "file:line", each with its reason (a wrapper that
   * forwards its own callers' props with a spread). A skip that matches no
   * site stops the harvest, like a stale rewrite.
   */
  skip?: Record<string, string>
  /** Named constants a call site uses, by identifier. */
  constants?: Record<string, SpecValue>
  /** A cap on one element's conditions (default 12: 4,096 combinations). */
  maxConditions?: number
}

export type HarvestedSite = {
  site: string
  conditions: string[]
  cases: number
  rewritten: boolean
}

export type Harvest = {
  /** Elements found (live JSX, not comments). */
  elements: number
  files: number
  cases: Record<string, HarvestedCase>
}

/** The evaluator's own wrappers for an object or array literal's members. */
type ObjectValue = { $object: Record<string, Value> }
type ArrayValue = { $array: Value[] }

type Value = SpecValue | undefined | ObjectValue | ArrayValue

const isObjectValue = (value: Value): value is ObjectValue =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "$object" in value

const isArrayValue = (value: Value): value is ArrayValue =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "$array" in value

const FN = Object.freeze({ $fn: true as const })

const isElementSpec = (value: unknown): value is ElementSpec =>
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

/** A plain value out of the evaluator's internal markers. */
const finish = (value: Value): SpecValue | undefined => {
  if (value === undefined) return undefined
  if (isObjectValue(value)) {
    const out: Record<string, SpecValue> = {}
    Object.entries(value.$object).forEach(([key, item]) => {
      const done = finish(item)
      if (done !== undefined) out[key] = done
    })
    return out
  }
  if (isArrayValue(value)) {
    return value.$array
      .map(finish)
      .filter((item): item is SpecValue => item !== undefined)
  }
  return value as SpecValue
}

/**
 * One element's attributes, evaluated under an assignment of its conditions.
 * Conditions are discovered while evaluating: an unseen one reads `false`
 * (or its first option) and is recorded, and the caller enumerates again
 * until no new one turns up.
 */
class SiteEvaluator {
  readonly atoms = new Map<string, Atom>()

  readonly usedOverrides = new Set<string>()

  private readonly where: string

  private readonly overrides: Record<string, ts.Expression>

  private readonly constants: Record<string, SpecValue>

  private env = new Map<string, number>()

  constructor(
    where: string,
    overrides: Record<string, string>,
    constants: Record<string, SpecValue>
  ) {
    this.where = where
    this.constants = constants
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

  fail(message: string, node: ts.Node): never {
    throw new Error(`${this.where}: ${message}: ${text(node)}`)
  }

  private atom(key: string): number {
    if (!this.atoms.has(key)) this.atoms.set(key, { kind: "bool", key })
    return this.env.get(key) ?? 0
  }

  private choice(key: string, options: ts.Expression[]): number {
    if (!this.atoms.has(key)) {
      this.atoms.set(key, { kind: "choice", key, options })
    }
    return this.env.get(key) ?? 0
  }

  /** The constant an identifier or a member chain names, if any. */
  private constantAt(node: ts.Expression): SpecValue | undefined {
    if (ts.isIdentifier(node)) return this.constants[node.text]
    if (ts.isPropertyAccessExpression(node)) {
      const base = this.constantAt(node.expression)
      if (base && typeof base === "object" && !Array.isArray(base)) {
        return (base as Record<string, SpecValue>)[node.name.text]
      }
    }
    return undefined
  }

  /** An expression the source can't settle: a rewrite, a condition, or by kind. */
  private opaque(node: ts.Expression, kind: PropKind | "cond"): Value {
    const key = text(node)
    const override = this.overrides[key]
    if (override) {
      this.usedOverrides.add(key)
      return this.value(override, kind, key)
    }
    if (kind === "cond" || kind === "bool") return this.atom(key) === 1
    if (kind === "fn") return FN
    if (kind === "text") return `{${key}}`
    if (kind === "any") return { $opaque: key }
    return this.fail(`a ${kind} value it can't settle (add a rewrite)`, node)
  }

  value(
    raw: ts.Expression,
    kind: PropKind | "cond",
    choiceKey?: string
  ): Value {
    const node = unwrap(raw)
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return node.text
    }
    if (ts.isNumericLiteral(node)) return Number(node.text)
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false
    if (node.kind === ts.SyntaxKind.NullKeyword) return null
    if (ts.isIdentifier(node) && node.text === "undefined") return undefined
    if (ts.isIdentifier(node) && node.text in this.constants) {
      return this.constants[node.text]
    }
    // A member of a constant object (`SETTINGS.header`, `colors.red`).
    if (ts.isPropertyAccessExpression(node)) {
      const base = this.constantAt(node.expression)
      if (
        base &&
        typeof base === "object" &&
        !Array.isArray(base) &&
        node.name.text in base
      ) {
        return (base as Record<string, SpecValue>)[node.name.text]
      }
    }
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
        return truthy(left) ? this.value(node.right, kind) : (left as Value)
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
        if (typeof left === "number" && typeof right === "number") {
          return left + right
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
              `${String(this.value(span.expression, kind === "class" ? "class" : "text"))}${span.literal.text}`
          )
          .join("")
      )
    }
    if (isCallTo(node, "clsx")) {
      const args = node.arguments.map((arg) => {
        const value = this.value(arg, "class")
        if (isObjectValue(value)) {
          return Object.fromEntries(
            Object.entries(value.$object).map(([k, v]) => [k, truthy(v)])
          )
        }
        return value
      })
      return clsx(...(args as unknown as Parameters<typeof clsx>))
    }
    if (isCallTo(node, "oneOf")) {
      if (!choiceKey) return this.fail("oneOf() outside a rewrite", node)
      const index = this.choice(choiceKey, [...node.arguments])
      return this.value(node.arguments[index], kind)
    }
    if (isCallTo(node, "t")) {
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
          out[property.name.text] = this.value(
            property.initializer,
            kind === "class" ? "cond" : kind
          )
        } else if (ts.isShorthandPropertyAssignment(property)) {
          out[property.name.text] = this.value(
            property.name,
            kind === "class" ? "cond" : kind
          )
        } else {
          this.fail("an object member it can't read", property)
        }
      })
      return { $object: out }
    }
    if (ts.isArrayLiteralExpression(node)) {
      return {
        $array: node.elements.map((element) =>
          ts.isSpreadElement(element)
            ? this.fail("a spread in an array", element)
            : this.value(element, kind)
        ),
      }
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      return this.element(node)
    }
    if (ts.isJsxFragment(node)) {
      return this.fail("a fragment (give it a rewrite)", node)
    }
    return this.opaque(node, kind)
  }

  /** A JSX element inside a prop or the children (an icon, a label): its tag, attributes and children. */
  element(node: ts.JsxElement | ts.JsxSelfClosingElement): ElementSpec {
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
        // A nested element's props aren't declared: a class reads as one,
        // a handler (onPress...) as a marker, anything else as `any`.
        value = this.value(
          init.expression,
          isClassProp(name) ? "class" : /^on[A-Z]/.test(name) ? "fn" : "any"
        )
      }
      const done = finish(value)
      if (done !== undefined) props[name] = done
    })
    if (Object.keys(props).length) spec.props = props
    if (ts.isJsxElement(node)) {
      const content = this.children(node.children)
      if (content !== undefined) spec.children = content
    }
    return spec
  }

  /**
   * An element's children: one text (literal text, t() keys, placeholders)
   * when that is all there is, else the list of texts and elements.
   */
  children(children: ts.NodeArray<ts.JsxChild>): SpecValue | undefined {
    const parts: (string | ElementSpec)[] = []
    const add = (value: Value) => {
      const done = finish(value)
      if (
        done === undefined ||
        done === null ||
        done === false ||
        done === true
      )
        return
      if (Array.isArray(done)) done.forEach((item) => add(item))
      else if (isElementSpec(done)) parts.push(done)
      else parts.push(String(done))
    }
    children.forEach((child) => {
      if (ts.isJsxText(child)) {
        if (child.text.trim())
          parts.push(child.text.replace(/\s+/g, " ").trim())
      } else if (ts.isJsxExpression(child)) {
        if (child.expression) add(this.value(child.expression, "text"))
      } else if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
        parts.push(this.element(child))
      } else {
        this.fail("a child it can't read", child)
      }
    })
    if (parts.length === 0) return undefined
    return parts.every((part) => typeof part === "string")
      ? parts.join(" ")
      : parts
  }
}

const walk = (dir: string, out: string[] = []) => {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (
        ![
          "__tests__",
          "__fixtures__",
          "__mocks__",
          "__parity__",
          "node_modules",
        ].includes(entry.name)
      ) {
        walk(full, out)
      }
    } else if (/\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name)) {
      out.push(full)
    }
  })
  return out
}

/**
 * Every local name the component goes by in a file (none when the file
 * doesn't import it). One file can import it more than once, under names of
 * its own: FilterScreen draws FilterItem as FilterItem and as FilterModalItem.
 */
const localNames = (
  source: ts.SourceFile,
  importFrom: RegExp,
  exportNames: string[]
) => {
  const names = new Set<string>()
  source.statements.forEach((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !importFrom.test(statement.moduleSpecifier.text)
    ) {
      return
    }
    const clause = statement.importClause
    if (clause?.isTypeOnly) return
    if (exportNames.includes("default") && clause?.name) {
      names.add(clause.name.text)
    }
    const bindings = clause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      bindings.elements.forEach((element) => {
        if (exportNames.includes((element.propertyName ?? element.name).text)) {
          names.add(element.name.text)
        }
      })
    }
  })
  return names
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

/** Every assignment of the atoms (choices by option index). */
const assignments = (atoms: Atom[]) => {
  let out: Map<string, number>[] = [new Map()]
  atoms.forEach((atom) => {
    const options = atom.kind === "bool" ? 2 : atom.options.length
    out = out.flatMap((env) =>
      Array.from({ length: options }, (_, i) => new Map(env).set(atom.key, i))
    )
  })
  return out
}

const casesOf = (
  where: string,
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  options: HarvestOptions,
  overrides: Record<string, string>
) => {
  const evaluator = new SiteEvaluator(where, overrides, options.constants ?? {})
  const attributes = node.attributes.properties.map((attribute) => {
    if (!ts.isJsxAttribute(attribute)) {
      return evaluator.fail(
        "a spread (give the component's props by hand)",
        attribute
      )
    }
    const name = attribute.name.getText()
    const kind = options.props[name]
    if (!kind) {
      return evaluator.fail(
        `a prop the harvest doesn't know ("${name}")`,
        attribute
      )
    }
    return { name, kind, init: attribute.initializer }
  })
  const content =
    ts.isJsxOpeningElement(node) && ts.isJsxElement(node.parent)
      ? node.parent.children
      : undefined
  const hasChildren = !!content?.some(
    (child) => !(ts.isJsxText(child) && !child.text.trim())
  )
  const evaluate = () => {
    const set: PropSet = {}
    attributes.forEach(({ name, kind, init }) => {
      let value: Value = true
      if (init && ts.isStringLiteral(init)) value = init.text
      else if (init && ts.isJsxExpression(init) && init.expression) {
        value = evaluator.value(init.expression, kind)
      }
      const done = finish(value)
      if (done !== undefined && done !== null) set[name] = done
    })
    if (hasChildren && content) {
      const children = evaluator.children(content)
      if (children !== undefined) set.children = children
    }
    return set
  }
  // Discover the conditions: enumerate until no new one turns up.
  const max = options.maxConditions ?? 12
  let known = -1
  let envs: Map<string, number>[] = [new Map()]
  while (known !== evaluator.atoms.size) {
    known = evaluator.atoms.size
    envs.forEach((env) => {
      evaluator.setEnv(env)
      evaluate()
    })
    if (evaluator.atoms.size > max) {
      throw new Error(
        `${where}: ${evaluator.atoms.size} conditions, more than ${max} (give a rewrite, or raise maxConditions)`
      )
    }
    envs = assignments([...evaluator.atoms.values()])
  }
  const sets = new Map<string, PropSet>()
  envs.forEach((env) => {
    evaluator.setEnv(env)
    const set = evaluate()
    sets.set(canonical(set), set)
  })
  const unused = Object.keys(overrides).filter(
    (key) => !evaluator.usedOverrides.has(key)
  )
  if (unused.length) {
    throw new Error(
      `${where}: rewrites that match nothing (stale?): ${unused.join(", ")}`
    )
  }
  return { sets: [...sets.values()], conditions: [...evaluator.atoms.keys()] }
}

/**
 * Every element of the component under `options.srcRoot`, and the distinct
 * prop sets they hand it, each with the sites that hand it, keyed by a short
 * stable id (the set's hash).
 */
export const harvestCallSites = (options: HarvestOptions) => {
  const exportNames = [options.exportName ?? "default"].flat()
  const rewrites = options.rewrites ?? {}
  const byKey = new Map<string, HarvestedCase>()
  const sites: HarvestedSite[] = []
  const files = new Set<string>()
  const usedRewrites = new Set<string>()
  const usedSkips = new Set<string>()
  walk(options.srcRoot).forEach((file) => {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )
    const names = localNames(source, options.importFrom, exportNames)
    if (names.size === 0) return
    const relative = path.relative(options.srcRoot, file)
    const visit = (node: ts.Node) => {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        names.has(node.tagName.getText())
      ) {
        const line =
          source.getLineAndCharacterOfPosition(node.getStart()).line + 1
        const where = `${relative}:${line}`
        if (options.skip && where in options.skip) {
          usedSkips.add(where)
          ts.forEachChild(node, visit)
          return
        }
        const rewrite = rewrites[where]
        if (rewrite) usedRewrites.add(where)
        const { sets, conditions } = casesOf(
          where,
          node,
          options,
          rewrite?.values ?? {}
        )
        files.add(relative)
        sites.push({
          site: where,
          conditions,
          cases: sets.length,
          rewritten: !!rewrite,
        })
        sets.forEach((props) => {
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
  const stale = [
    ...Object.keys(rewrites).filter((where) => !usedRewrites.has(where)),
    ...Object.keys(options.skip ?? {}).filter((where) => !usedSkips.has(where)),
  ]
  if (stale.length) {
    throw new Error(
      `rewrites or skips for sites that aren't there (moved?): ${stale.join(", ")}`
    )
  }
  const cases: Record<string, HarvestedCase> = {}
  ;[...byKey.keys()].sort().forEach((key) => {
    const hash = crypto.createHash("sha1").update(key).digest("hex")
    cases[hash.slice(0, 10)] = byKey.get(key)!
  })
  return {
    harvest: { elements: sites.length, files: files.size, cases } as Harvest,
    sites,
  }
}

/** A prop that carries class names (className, classNameTitle, textClassName). */
export const isClassProp = (name: string) => /^className|ClassName$/.test(name)

/** Every class string the cases hand the component or an element inside it. */
export const classStringsOf = (cases: Record<string, HarvestedCase>) => {
  const out = new Set<string>()
  const visit = (value: SpecValue, key: string) => {
    if (typeof value === "string" && isClassProp(key)) {
      if (value.trim()) out.add(value)
    } else if (isElementSpec(value)) {
      Object.entries(value.props ?? {}).forEach(([k, v]) => visit(v, k))
    } else if (Array.isArray(value)) {
      value.forEach((item) => visit(item, key))
    }
  }
  Object.values(cases).forEach(({ props }) => {
    Object.entries(props).forEach(([key, value]) => visit(value, key))
  })
  return [...out].sort()
}
