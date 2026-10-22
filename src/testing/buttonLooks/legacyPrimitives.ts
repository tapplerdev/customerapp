/**
 * Jest only. Whether a file of the app still reaches for tappler-shared's
 * ActionBtn or DmText, in any spelling a reader of the source can see.
 *
 * It reads the AST, not text, so a comment that says "DmText" is nothing.
 * What counts, anywhere in the file:
 *
 * - the name: an identifier called ActionBtn or DmText, which covers a JSX
 *   tag, an import or export specifier (both sides of `X as Y`), `UI.ActionBtn`,
 *   `const { ActionBtn: Y } = UI`, `createElement(DmText, ...)`,
 *   `export const T = DmText`, `typeof ActionBtn`;
 * - the name as a string: "ActionBtn" or "DmText" as a string, however it is
 *   joined (`UI["Dm" + "Text"]`), a template with nothing in it included;
 * - the module: a string naming a path that has an ActionBtn or DmText
 *   segment (`.../UI/ActionBtn`, `.../UI/DmText/DmText`), which brings it in
 *   under any local name (`import Btn from ...`, `export { default as X }
 *   from ...`, a require() or import() of it);
 * - a barrel taken whole, which can hand either out under a name nothing here
 *   reads: `import * as UI` or a default import of one, `export * from` one,
 *   a require() or import() of one used as a value (a destructuring of
 *   named members, or one `.member`, is read by its names).
 *
 * A barrel is tappler-shared's package root, its src, its components and its
 * components/UI, by `@tappler/shared/...` or a relative path into
 * ../tappler-shared.
 *
 * The files are the ratchet's "app code" (scripts/style-ratchet.js): every
 * .js/.jsx/.ts/.tsx under src but src/testing, tests, mocks and fixtures
 * (__tests__, __mocks__, __fixtures__, *.test.*, *.spec.*), and the app's
 * entry files at the root.
 */
import fs from "fs"
import path from "path"
import ts from "typescript"

export const LEGACY_NAMES = ["ActionBtn", "DmText"]
const NAMES = new Set(LEGACY_NAMES)
const SEGMENT = /(^|\/)(ActionBtn|DmText)(\/|$)/
const BARREL =
  /^(.*\/)?(@tappler\/shared|tappler-shared)(\/src)?(\/components(\/UI)?)?(\/index)?$/

const SKIP_DIRS = new Set([
  "node_modules",
  "__tests__",
  "__mocks__",
  "__fixtures__",
])
const SOURCE = /\.(jsx?|tsx?)$/
const TEST_FILE = /\.(test|spec)\.[jt]sx?$/

/** The app's own source files, as paths relative to `appRoot`, sorted. */
export const appFiles = (appRoot: string): string[] => {
  const out: string[] = []
  const walk = (dir: string) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) return
        if (path.relative(appRoot, full) === path.join("src", "testing")) return
        walk(full)
      } else if (SOURCE.test(entry.name) && !TEST_FILE.test(entry.name)) {
        out.push(path.relative(appRoot, full))
      }
    })
  }
  walk(path.join(appRoot, "src"))
  fs.readdirSync(appRoot, { withFileTypes: true }).forEach((entry) => {
    if (entry.isFile() && /^(index|App)\.[jt]sx?$/.test(entry.name))
      out.push(entry.name)
  })
  return out.sort()
}

const kindOf = (file: string) =>
  file.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : file.endsWith(".ts")
    ? ts.ScriptKind.TS
    : file.endsWith(".jsx")
    ? ts.ScriptKind.JSX
    : ts.ScriptKind.JS

/** A string made of string literals joined with `+`, or undefined. */
const folded = (node: ts.Node): string | undefined => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text
  if (ts.isParenthesizedExpression(node)) return folded(node.expression)
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = folded(node.left)
    const right = folded(node.right)
    if (left !== undefined && right !== undefined) return left + right
  }
  return undefined
}

/** One line per way `source` brings in or draws ActionBtn or DmText. */
export const findLegacyPrimitives = (source: string, file = "x.tsx") => {
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    kindOf(file)
  )
  const hits: string[] = []
  const hit = (node: ts.Node, why: string) =>
    hits.push(
      `${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1} ${why}`
    )

  const barrelStringOf = (node: ts.Node | undefined) =>
    node &&
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      ? node.text
      : undefined

  const visit = (node: ts.Node) => {
    if (ts.isIdentifier(node) && NAMES.has(node.text)) {
      hit(node, `the name ${node.text}`)
    }

    // a string, or strings joined with +: checked once, at the outermost join
    const text = folded(node)
    const parentIsJoin =
      node.parent &&
      (ts.isBinaryExpression(node.parent) ||
        ts.isParenthesizedExpression(node.parent)) &&
      folded(node.parent) !== undefined
    if (text !== undefined && !parentIsJoin) {
      if (NAMES.has(text)) hit(node, `the string "${text}"`)
      else if (text.includes("/") && SEGMENT.test(text))
        hit(node, `the module "${text}"`)
    }

    if (ts.isImportDeclaration(node)) {
      const from = barrelStringOf(node.moduleSpecifier)
      const clause = node.importClause
      if (from !== undefined && BARREL.test(from) && clause) {
        if (clause.name) hit(node, `a default import of the barrel "${from}"`)
        if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))
          hit(node, `a namespace import of the barrel "${from}"`)
      }
    }
    if (ts.isExportDeclaration(node)) {
      const from = barrelStringOf(node.moduleSpecifier)
      if (
        from !== undefined &&
        BARREL.test(from) &&
        (!node.exportClause || ts.isNamespaceExport(node.exportClause))
      )
        hit(node, `an export * of the barrel "${from}"`)
    }
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const from = barrelStringOf(node.moduleReference.expression)
      if (from !== undefined && BARREL.test(from))
        hit(node, `an import = require of the barrel "${from}"`)
    }
    if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      const from = barrelStringOf(node.arguments[0])
      if (from !== undefined && BARREL.test(from)) {
        const parent = node.parent
        const named =
          node.expression.kind !== ts.SyntaxKind.ImportKeyword &&
          ((ts.isPropertyAccessExpression(parent) &&
            parent.expression === node) ||
            (ts.isVariableDeclaration(parent) &&
              parent.initializer === node &&
              ts.isObjectBindingPattern(parent.name) &&
              !parent.name.elements.some((el) => el.dotDotDotToken)))
        if (!named) hit(node, `the barrel "${from}" taken whole`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return hits
}

/** Every file of the app that has one, as `file:line why`. */
export const legacyPrimitivesIn = (appRoot: string) => {
  const out: string[] = []
  appFiles(appRoot).forEach((file) => {
    findLegacyPrimitives(
      fs.readFileSync(path.join(appRoot, file), "utf8"),
      file
    ).forEach((line) => out.push(`${file}:${line}`))
  })
  return out
}
