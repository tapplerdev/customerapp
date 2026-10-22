#!/usr/bin/env node
/**
 * yarn ds:paths            check tsconfig.json's paths (exit 1 if stale)
 * yarn ds:paths --write    rewrite them
 * (the same as node scripts/shared-tsconfig-paths.js [--write])
 *
 * On a dependency upgrade, also diff `tsc --listFilesOnly` before and after:
 * an exact mapping would quietly keep pointing at the old copy of a package
 * that gains a nested duplicate, which the check here can't see.
 *
 * Why this exists. tappler-shared is a sibling checkout (../tappler-shared)
 * with no node_modules of its own, so when tsc follows customerapp's imports
 * into it, every `import ... from "react-native"` inside shared looked for
 * ../tappler-shared/node_modules, found nothing, and the whole package typed
 * as `any`: a bogus prop on DmView, DmText or ActionBtn compiled clean, and
 * tsc reported 385 errors inside shared (416 in all, 32 with these paths).
 * Metro and jest don't have the problem (metro.config.js nodeModulesPaths,
 * jest.config.js modulePaths); tsc needs `paths`. Copied from proapp, where
 * the same fix took its tsc from 420 to 131.
 *
 * One entry per module specifier shared imports, each pinned to the exact
 * file TypeScript resolves for that specifier from customerapp itself. So
 * shared and the app see the same declaration file for "react-native", and
 * nothing about how the app resolves its own imports changes. (RTK 2.2.1
 * here resolves to its index.d.ts, where proapp's newer RTK has .d.mts.)
 * Two shapes that were tried first, in proapp, and must not come back:
 * - a `"*": ["node_modules/*"]` fallback also applies to imports INSIDE
 *   node_modules declarations, and it re-pointed RTK's types from its nested
 *   reselect 5.1.1 to the top-level 4.1.8 (skipLibCheck hides that);
 * - a directory mapping (`"clsx": ["node_modules/clsx"]`) makes tsc read the
 *   package.json `types` field instead of `exports`, so RTK, clsx, i18next and
 *   others switched from their .d.mts typings to the CJS ones, for proapp's
 *   own imports too.
 *
 * A specifier shared starts importing later has no entry, so tsc reports
 * "Cannot find module" inside shared: loud, not silently `any`. Re-run this
 * with --write. A package upgrade that moves its typings shows up the same way.
 * Specifiers TypeScript can't resolve to a file (Node built-ins, `events`,
 * which comes from @types/node's ambient declaration) are reported and left
 * unmapped; they resolve the same from shared as from the app.
 */
const fs = require("fs")
const path = require("path")
const { builtinModules } = require("module")
const ts = require("typescript")
const parser = require("@babel/parser")

const ROOT = path.resolve(__dirname, "..")
const SHARED = path.resolve(ROOT, "../tappler-shared")
const TSCONFIG = path.join(ROOT, "tsconfig.json")
// Node-only scripts in shared that no app bundles or type-checks.
const SKIP_DIRS = [path.join(SHARED, "src/profanity/scripts")]

function sharedSpecifiers() {
  const specs = new Set()
  const visit = (node) => {
    if (!node || typeof node !== "object") return
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    const add = (s) => {
      if (typeof s === "string" && !s.startsWith(".") && !s.startsWith("/"))
        specs.add(s)
    }
    if (
      (node.type === "ImportDeclaration" ||
        node.type === "ExportNamedDeclaration" ||
        node.type === "ExportAllDeclaration") &&
      node.source
    ) {
      add(node.source.value)
    }
    if (
      node.type === "CallExpression" &&
      (node.callee.name === "require" || node.callee.type === "Import") &&
      node.arguments[0] &&
      node.arguments[0].type === "StringLiteral"
    ) {
      add(node.arguments[0].value)
    }
    if (node.type === "TSImportType" && node.argument) {
      add(
        node.argument.value ||
          (node.argument.literal && node.argument.literal.value)
      )
    }
    if (node.type === "TSExternalModuleReference") add(node.expression.value)
    for (const key of Object.keys(node)) {
      if (key !== "loc" && key !== "start" && key !== "end") visit(node[key])
    }
  }
  const walk = (dir) => {
    if (SKIP_DIRS.includes(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules") walk(full)
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        const code = fs.readFileSync(full, "utf8")
        visit(
          parser.parse(code, {
            sourceType: "module",
            plugins: ["typescript", "jsx"],
          }).program
        )
      }
    }
  }
  walk(path.join(SHARED, "src"))
  return [...specs].sort()
}

function readTsconfig() {
  const text = fs.readFileSync(TSCONFIG, "utf8")
  const { config, error } = ts.parseConfigFileTextToJson(TSCONFIG, text)
  if (error)
    throw new Error(ts.flattenDiagnosticMessageText(error.messageText, "\n"))
  return config
}

function resolverOptions() {
  // the app's effective options (the extended RN preset included), minus our
  // own paths/baseUrl: the question is where a plain app import lands.
  const parsed = ts.parseJsonConfigFileContent(readTsconfig(), ts.sys, ROOT)
  const options = { ...parsed.options }
  delete options.paths
  delete options.baseUrl
  delete options.pathsBasePath
  return options
}

function generate() {
  const options = resolverOptions()
  const from = path.join(ROOT, "src/App.tsx")
  const paths = { "@tappler/shared/*": ["../tappler-shared/*"] }
  const skipped = []
  for (const spec of sharedSpecifiers()) {
    const bare = spec.replace(/^node:/, "")
    if (builtinModules.includes(bare.split("/")[0])) {
      skipped.push(`${spec} (Node built-in)`)
      continue
    }
    const { resolvedModule } = ts.resolveModuleName(spec, from, options, ts.sys)
    if (!resolvedModule) {
      skipped.push(`${spec} (no declaration file; ambient or untyped)`)
      continue
    }
    const rel = path
      .relative(ROOT, resolvedModule.resolvedFileName)
      .split(path.sep)
      .join("/")
    if (!rel.startsWith("node_modules/")) {
      skipped.push(`${spec} (resolves outside node_modules: ${rel})`)
      continue
    }
    paths[spec] = [rel]
  }
  paths["*"] = ["src/*"]
  return { paths, skipped }
}

function render(config) {
  const header = [
    "// compilerOptions.paths is generated: node scripts/shared-tsconfig-paths.js --write",
    "// (that file says why each shared import is pinned to one declaration file).",
  ].join("\n")
  return `${header}\n${JSON.stringify(config, null, 2)}\n`
}

const { paths, skipped } = generate()
const config = readTsconfig()
const current = JSON.stringify((config.compilerOptions || {}).paths || {})
const next = {
  ...config,
  compilerOptions: { ...config.compilerOptions, baseUrl: ".", paths },
}

for (const line of skipped) console.log(`unmapped: ${line}`)
if (process.argv.includes("--write")) {
  fs.writeFileSync(TSCONFIG, render(next))
  console.log(
    `wrote ${Object.keys(paths).length} path entries to tsconfig.json`
  )
} else if (current !== JSON.stringify(paths)) {
  console.log("tsconfig.json paths are stale; run with --write")
  process.exit(1)
} else {
  console.log(
    `tsconfig.json paths are current (${Object.keys(paths).length} entries)`
  )
}
