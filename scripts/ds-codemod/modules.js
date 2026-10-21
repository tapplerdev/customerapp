/**
 * Finding the file a JSX tag comes from, the way the app's Babel config
 * resolves imports (module-resolver: root ./src, `@tappler/shared` ->
 * ../tappler-shared), and following barrels (`import X from "./X"; export
 * { X }`, `export { default as X } from`, `export *`) to the declaration.
 */
const fs = require("fs")
const path = require("path")
const parser = require("@babel/parser")

const { paths } = require("../nw-resolve")

const ROOT = paths.ROOT
const SRC = path.join(ROOT, "src")
const SHARED = path.join(ROOT, "..", "tappler-shared")

const EXTENSIONS = [".tsx", ".ts", ".js", ".jsx", ".ios.js", ".android.js"]

const PARSER_PLUGINS = ["jsx", "typescript"]

const parseCode = (code) =>
  parser.parse(code, {
    sourceType: "module",
    plugins: PARSER_PLUGINS,
    errorRecovery: false,
  })

const fileCache = new Map()

/** { code, ast } for a file, parsed once. */
const parseFile = (file) => {
  if (!/\.(tsx?|jsx?|mjs|cjs)$/.test(file))
    throw new Error(
      `ds-codemod: internal: asked to parse ${file}, which isn't code`
    )
  let hit = fileCache.get(file)
  if (!hit) {
    const code = fs.readFileSync(file, "utf8")
    hit = { code, ast: parseCode(code) }
    fileCache.set(file, hit)
  }
  return hit
}

const forget = (file) => fileCache.delete(file)

const tryFile = (base) => {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base
  for (const ext of EXTENSIONS)
    if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile())
      return base + ext
  if (fs.existsSync(base) && fs.statSync(base).isDirectory())
    for (const ext of EXTENSIONS) {
      const index = path.join(base, `index${ext}`)
      if (fs.existsSync(index)) return index
    }
  return null
}

const isPackage = (source) =>
  !source.startsWith(".") &&
  !source.startsWith("/") &&
  !source.startsWith("@tappler/shared")

/**
 * Where an import goes: { kind: "file", file } for our code, or
 * { kind: "package", name } for node_modules.
 */
const resolveSource = (fromFile, source) => {
  if (source.startsWith(".") || source.startsWith("/")) {
    const file = tryFile(path.resolve(path.dirname(fromFile), source))
    return file ? { kind: "file", file } : { kind: "missing", source }
  }
  if (source === "@tappler/shared" || source.startsWith("@tappler/shared/")) {
    const file = tryFile(
      path.join(SHARED, source.slice("@tappler/shared".length))
    )
    return file ? { kind: "file", file } : { kind: "missing", source }
  }
  const rooted = tryFile(path.join(SRC, source))
  if (rooted) return { kind: "file", file: rooted }
  return { kind: "package", name: source }
}

/** The top-level declaration a name refers to inside `ast`. */
const topLevel = (ast, name) => {
  for (const stmt of ast.program.body) {
    const decl =
      stmt.type === "ExportNamedDeclaration" && stmt.declaration
        ? stmt.declaration
        : stmt
    if (decl.type === "ImportDeclaration") {
      for (const s of decl.specifiers)
        if (s.local.name === name)
          return {
            kind: "import",
            source: decl.source.value,
            imported:
              s.type === "ImportDefaultSpecifier"
                ? "default"
                : s.type === "ImportNamespaceSpecifier"
                  ? "*"
                  : s.imported.name || s.imported.value,
          }
    }
    if (decl.type === "VariableDeclaration")
      for (const d of decl.declarations)
        if (d.id.type === "Identifier" && d.id.name === name)
          return { kind: "decl", node: d }
    if (
      (decl.type === "FunctionDeclaration" ||
        decl.type === "ClassDeclaration") &&
      decl.id &&
      decl.id.name === name
    )
      return { kind: "decl", node: decl }
    if (
      (decl.type === "TSInterfaceDeclaration" ||
        decl.type === "TSTypeAliasDeclaration") &&
      decl.id.name === name
    )
      return { kind: "decl", node: decl }
  }
  return null
}

/**
 * The declaration exported as `exportName` from `file`:
 * { file, node, name } or null. Follows imports and re-exports.
 */
const findExport = (file, exportName, depth = 0) => {
  if (depth > 12) return null
  const { ast } = parseFile(file)
  const follow = (local) => {
    const found = topLevel(ast, local)
    if (!found) return null
    if (found.kind === "decl") return { file, node: found.node, name: local }
    const target = resolveSource(file, found.source)
    if (target.kind !== "file")
      return { file, package: target.name, imported: found.imported }
    return findExport(target.file, found.imported, depth + 1)
  }
  for (const stmt of ast.program.body) {
    if (stmt.type === "ExportDefaultDeclaration" && exportName === "default") {
      const d = stmt.declaration
      if (d.type === "Identifier") return follow(d.name)
      return { file, node: d, name: d.id ? d.id.name : "default" }
    }
    if (stmt.type === "ExportNamedDeclaration") {
      if (stmt.declaration) {
        const d = stmt.declaration
        const names =
          d.type === "VariableDeclaration"
            ? d.declarations.map((x) => x.id.name)
            : d.id
              ? [d.id.name]
              : []
        if (names.includes(exportName)) {
          const node =
            d.type === "VariableDeclaration"
              ? d.declarations.find((x) => x.id.name === exportName)
              : d
          return { file, node, name: exportName }
        }
      }
      for (const s of stmt.specifiers || []) {
        const exported = s.exported.name || s.exported.value
        if (exported !== exportName) continue
        const local = s.local ? s.local.name : "default"
        if (stmt.source) {
          const target = resolveSource(file, stmt.source.value)
          if (target.kind !== "file")
            return { file, package: target.name, imported: local }
          return findExport(target.file, local, depth + 1)
        }
        return follow(local)
      }
    }
  }
  for (const stmt of ast.program.body) {
    if (stmt.type === "ExportAllDeclaration") {
      const target = resolveSource(file, stmt.source.value)
      if (target.kind === "file") {
        const hit = findExport(target.file, exportName, depth + 1)
        if (hit) return hit
      }
    }
  }
  return null
}

const rel = (file) => path.relative(ROOT, file)

module.exports = {
  EXTENSIONS,
  PARSER_PLUGINS,
  ROOT,
  SHARED,
  SRC,
  findExport,
  forget,
  isPackage,
  parseCode,
  parseFile,
  rel,
  resolveSource,
  topLevel,
  tryFile,
}
