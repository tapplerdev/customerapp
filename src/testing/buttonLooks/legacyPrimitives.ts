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
 * - a way round the scan: an import, re-export, require() or import() of a
 *   path that lands in src/testing or in a __fixtures__, __tests__ or
 *   __mocks__ folder. The scan leaves those folders out (their controls build
 *   both primitives on purpose), so app code that reaches into one could hand
 *   a DmText back under a name nothing here reads. The path is resolved as
 *   babel's module-resolver does: relative to the file, or from src.
 *
 * A barrel is tappler-shared's package root, its src, its components and its
 * components/UI, by `@tappler/shared/...` or a relative path into
 * ../tappler-shared, however it is spelled: with a trailing slash, with
 * `/index` and an extension (`/index.ts`), with doubled slashes or `./`
 * segments. A destructure of a require() or import() counts as naming
 * members only when every key is a plain name: a computed key
 * (`const { [k]: X } = require(barrel)`) or a rest takes the barrel whole.
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
  /^(.*\/)?(@tappler\/shared|tappler-shared)(\/src)?(\/components(\/UI)?)?(\/index(\.[jt]sx?)?)?\/?$/
// folders the scan leaves out (src/testing is checked on the resolved path)
const OUT_OF_SCAN_SEGMENT = /(^|\/)(__fixtures__|__tests__|__mocks__)(\/|$)/

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

/** A module specifier with `//` and `./` segments collapsed, as the resolver reads it. */
const cleaned = (spec: string) => path.posix.normalize(spec)

/**
 * Whether `spec`, imported from `file` (relative to the app root), lands in
 * src/testing or in a folder the scan leaves out.
 */
const reachesOutOfScan = (spec: string, file: string) => {
  const clean = cleaned(spec)
  const fromRoot = spec.startsWith(".")
    ? path.posix.normalize(path.posix.join(path.posix.dirname(file), spec))
    : // not relative: module-resolver's root is ./src (and `src/...` spelled out)
      path.posix.join("src", clean.replace(/^src\//, ""))
  return (
    OUT_OF_SCAN_SEGMENT.test(clean) ||
    OUT_OF_SCAN_SEGMENT.test(fromRoot) ||
    /^src\/testing(\/|$)/.test(fromRoot)
  )
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
  const isBarrel = (from: string) => BARREL.test(cleaned(from))
  const outOfScan = (node: ts.Node, from: string | undefined) => {
    if (from !== undefined && reachesOutOfScan(from, file))
      hit(node, `the out-of-scan module "${from}"`)
  }

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
      outOfScan(node, from)
      if (from !== undefined && isBarrel(from) && clause) {
        if (clause.name) hit(node, `a default import of the barrel "${from}"`)
        if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))
          hit(node, `a namespace import of the barrel "${from}"`)
      }
    }
    if (ts.isExportDeclaration(node)) {
      const from = barrelStringOf(node.moduleSpecifier)
      outOfScan(node, from)
      if (
        from !== undefined &&
        isBarrel(from) &&
        (!node.exportClause || ts.isNamespaceExport(node.exportClause))
      )
        hit(node, `an export * of the barrel "${from}"`)
    }
    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const from = barrelStringOf(node.moduleReference.expression)
      outOfScan(node, from)
      if (from !== undefined && isBarrel(from))
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
      outOfScan(node, from)
      if (from !== undefined && isBarrel(from)) {
        const parent = node.parent
        const named =
          node.expression.kind !== ts.SyntaxKind.ImportKeyword &&
          ((ts.isPropertyAccessExpression(parent) &&
            parent.expression === node) ||
            (ts.isVariableDeclaration(parent) &&
              parent.initializer === node &&
              ts.isObjectBindingPattern(parent.name) &&
              // a rest or a computed key can name any member
              !parent.name.elements.some(
                (el) =>
                  el.dotDotDotToken ||
                  (el.propertyName && ts.isComputedPropertyName(el.propertyName))
              )))
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
