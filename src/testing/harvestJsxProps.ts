/**
 * Jest only. The props a component is given at its real call sites, read
 * from the source with TypeScript's parser, and expanded into the concrete
 * prop sets those sites can produce at run time.
 *
 * A defaults test renders those sets before and after a change to the
 * component. A value the source spells out is used as written: a string, a
 * number, a named constant, every branch of a `?:` or `&&`, every outcome of
 * a `clsx(...)` call, a JSX element (with its own class names expanded the
 * same way). A value only known at run time gets a stand-in by the prop's
 * kind: a text prop a placeholder (and `undefined` when it is optionally
 * chained), a boolean both values, a handler a marker. A class name or an
 * element it can't evaluate stops the harvest, so nothing is guessed.
 */
import crypto from "crypto"
import fs from "fs"
import path from "path"
import ts from "typescript"
import clsx from "clsx"

export type PropKind = "class" | "text" | "bool" | "node" | "fn"

export type ElementSpec = {
  $el: string
  props?: Record<string, SpecValue>
  text?: string
}
export type SpecValue =
  | string
  | number
  | boolean
  | { $fn: true }
  | { $child: true }
  | ElementSpec

/** One concrete prop set; a prop that is undefined is left out. */
export type PropSet = Record<string, SpecValue>

export type JsxSite = {
  file: string
  line: number
  node: ts.JsxOpeningElement | ts.JsxSelfClosingElement
  hasChildren: boolean
}

export type ExpandOptions = {
  kinds: Record<string, PropKind>
  /** Identifiers that are string constants, by name. */
  constants?: Record<string, string>
  placeholder: (prop: string) => string
}

const walk = (dir: string, out: string[]) => {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__" && entry.name !== "node_modules") {
        walk(full, out)
      }
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full)
    }
  })
  return out
}

/**
 * Every JSX element of the component, in every file under `srcRoot` that
 * imports it by default from a module matching `importFrom` (tests skipped).
 */
export const findJsxSites = (srcRoot: string, importFrom: RegExp) => {
  const importers: string[] = []
  const sites: JsxSite[] = []
  walk(srcRoot, []).forEach((file) => {
    const text = fs.readFileSync(file, "utf8")
    const source = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )
    let local: string | undefined
    source.statements.forEach((statement) => {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        importFrom.test(statement.moduleSpecifier.text) &&
        statement.importClause?.name
      ) {
        local = statement.importClause.name.text
      }
    })
    if (!local) return
    importers.push(path.relative(srcRoot, file))
    const visit = (node: ts.Node) => {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        node.tagName.getText() === local
      ) {
        const hasChildren =
          ts.isJsxOpeningElement(node) &&
          ts.isJsxElement(node.parent) &&
          node.parent.children.some(
            (child) => !(ts.isJsxText(child) && !child.text.trim())
          )
        sites.push({
          file: path.relative(srcRoot, file),
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          node,
          hasChildren,
        })
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  })
  return { importers, sites }
}

const cartesian = <T>(lists: T[][]): T[][] =>
  lists.reduce<T[][]>(
    (acc, list) =>
      acc.flatMap((prefix) => list.map((item) => [...prefix, item])),
    [[]]
  )

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

const unique = <T>(values: T[]): T[] => {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = canonical(value === undefined ? "$undefined" : value)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

type Value = SpecValue | undefined | false

const isCall = (node: ts.Expression, name: string): node is ts.CallExpression =>
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === name

class Expander {
  private readonly options: ExpandOptions

  private readonly where: string

  constructor(options: ExpandOptions, where: string) {
    this.options = options
    this.where = where
  }

  private fail(message: string, node: ts.Node): never {
    throw new Error(
      `${this.where}: ${message}: ${node.getText().replace(/\s+/g, " ")}`
    )
  }

  private clsxArg(arg: ts.Expression): unknown[] {
    if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
      return [arg.text]
    }
    if (ts.isIdentifier(arg) && this.options.constants?.[arg.text]) {
      return [this.options.constants[arg.text]]
    }
    if (ts.isObjectLiteralExpression(arg)) {
      const keys = arg.properties.map((property) => {
        if (
          ts.isPropertyAssignment(property) &&
          (ts.isStringLiteral(property.name) || ts.isIdentifier(property.name))
        ) {
          return property.name.text
        }
        return this.fail("a clsx object key it can't read", property)
      })
      return cartesian(keys.map((key) => [key, null])).map((picked) =>
        Object.fromEntries(
          keys.map((key, index) => [key, picked[index] !== null])
        )
      )
    }
    if (
      ts.isBinaryExpression(arg) &&
      arg.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      return [false, ...this.clsxArg(arg.right)]
    }
    if (
      ts.isBinaryExpression(arg) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ].includes(arg.operatorToken.kind)
    ) {
      // A comparison is a boolean, which clsx drops.
      return [false]
    }
    return this.fail("a clsx argument it can't evaluate", arg)
  }

  private clsxValues(call: ts.CallExpression): string[] {
    return unique(
      cartesian(call.arguments.map((arg) => this.clsxArg(arg))).map((args) =>
        clsx(...(args as Parameters<typeof clsx>))
      )
    )
  }

  private element(
    node: ts.JsxElement | ts.JsxSelfClosingElement
  ): ElementSpec[] {
    const opening = ts.isJsxElement(node) ? node.openingElement : node
    const name = opening.tagName.getText()
    const attributes = opening.attributes.properties.map((attribute) => {
      if (!ts.isJsxAttribute(attribute)) {
        return this.fail("a spread on a nested element", attribute)
      }
      const prop = attribute.name.getText()
      const init = attribute.initializer
      if (!init) return { prop, values: [true] as Value[] }
      const expression = ts.isStringLiteral(init)
        ? init
        : ts.isJsxExpression(init) && init.expression
          ? init.expression
          : this.fail("an empty attribute", attribute)
      return {
        prop,
        values: this.values(
          expression,
          prop === "className" ? "class" : "literal"
        ),
      }
    })
    let text: string | undefined
    if (ts.isJsxElement(node)) {
      const parts = node.children.flatMap((child) => {
        if (ts.isJsxText(child)) {
          return child.text.trim() ? [child.text.trim()] : []
        }
        if (
          ts.isJsxExpression(child) &&
          child.expression &&
          isCall(child.expression, "t") &&
          ts.isStringLiteral(child.expression.arguments[0])
        ) {
          return [`t:${child.expression.arguments[0].text}`]
        }
        return this.fail("a child it can't evaluate", child)
      })
      text = parts.length ? parts.join(" ") : undefined
    }
    return cartesian(attributes.map((attribute) => attribute.values)).map(
      (picked) => {
        const props: Record<string, SpecValue> = {}
        attributes.forEach(({ prop }, index) => {
          const value = picked[index]
          if (value !== undefined) props[prop] = value as SpecValue
        })
        const spec: ElementSpec = { $el: name }
        if (Object.keys(props).length) spec.props = props
        if (text !== undefined) spec.text = text
        return spec
      }
    )
  }

  values(node: ts.Expression, kind: PropKind | "literal", prop = ""): Value[] {
    if (ts.isParenthesizedExpression(node)) {
      return this.values(node.expression, kind, prop)
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      return [node.text]
    }
    if (ts.isNumericLiteral(node)) return [Number(node.text)]
    if (node.kind === ts.SyntaxKind.TrueKeyword) return [true]
    if (node.kind === ts.SyntaxKind.FalseKeyword) return [false]
    if (ts.isIdentifier(node) && node.text === "undefined") return [undefined]
    if (ts.isIdentifier(node) && this.options.constants?.[node.text]) {
      return [this.options.constants[node.text]]
    }
    if (ts.isConditionalExpression(node) && kind !== "bool") {
      return unique([
        ...this.values(node.whenTrue, kind, prop),
        ...this.values(node.whenFalse, kind, prop),
      ])
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      kind !== "bool"
    ) {
      return unique([false, ...this.values(node.right, kind, prop)])
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      return this.element(node)
    }
    if (isCall(node, "clsx")) return this.clsxValues(node)
    if (isCall(node, "t") && kind === "text") {
      return [this.options.placeholder(prop)]
    }
    switch (kind) {
      case "bool":
        return [true, false]
      case "fn":
        return [{ $fn: true }]
      case "text":
        return node.getText().includes("?.")
          ? [this.options.placeholder(prop), undefined]
          : [this.options.placeholder(prop)]
      default:
        return this.fail(`a ${kind} value it can't evaluate`, node)
    }
  }

  site(site: JsxSite): PropSet[] {
    const attributes = site.node.attributes.properties.map((attribute) => {
      if (!ts.isJsxAttribute(attribute)) {
        return this.fail("a spread", attribute)
      }
      const prop = attribute.name.getText()
      const kind = this.options.kinds[prop]
      if (!kind) return this.fail(`an unknown prop "${prop}"`, attribute)
      const init = attribute.initializer
      if (!init) return { prop, values: [true] as Value[] }
      if (ts.isStringLiteral(init)) {
        return { prop, values: [init.text] as Value[] }
      }
      if (ts.isJsxExpression(init) && init.expression) {
        return { prop, values: this.values(init.expression, kind, prop) }
      }
      return this.fail("an attribute it can't read", attribute)
    })
    if (site.hasChildren) {
      attributes.push({ prop: "children", values: [{ $child: true }] })
    }
    return cartesian(attributes.map((attribute) => attribute.values)).map(
      (picked) => {
        const set: PropSet = {}
        attributes.forEach(({ prop }, index) => {
          const value = picked[index]
          if (value !== undefined) set[prop] = value as SpecValue
        })
        return set
      }
    )
  }
}

export type HarvestedCase = { props: PropSet; sites: string[] }

/**
 * The distinct prop sets over every site, each with the sites that can
 * produce it, keyed by a short stable id.
 */
export const harvestCases = (sites: JsxSite[], options: ExpandOptions) => {
  const byKey = new Map<string, HarvestedCase>()
  sites.forEach((site) => {
    const where = `${site.file}:${site.line}`
    new Expander(options, where).site(site).forEach((props) => {
      const key = canonical(props)
      const entry = byKey.get(key) ?? { props, sites: [] }
      if (!entry.sites.includes(where)) entry.sites.push(where)
      byKey.set(key, entry)
    })
  })
  const cases: Record<string, HarvestedCase> = {}
  // Default sort: code-unit order, the same on every machine.
  ;[...byKey.keys()].sort().forEach((key) => {
    const hash = crypto.createHash("sha1").update(key).digest("hex")
    cases[hash.slice(0, 10)] = byKey.get(key)!
  })
  return cases
}
