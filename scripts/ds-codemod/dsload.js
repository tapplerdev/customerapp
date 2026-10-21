/**
 * Loads tappler-shared's design-system modules (typography, colours, atoms,
 * controls, radius, Button's static styles) into this Node process, so the
 * codemod checks its output against the real token tables instead of a copy
 * of them. Each .ts file is compiled with Babel (TypeScript and CommonJS
 * only) and run in this realm; react-native is a stub, which is all these
 * files touch (helpers.ts reads Dimensions at import time).
 *
 * The Latin faces are registered from index.js's setLatinFontWeights call,
 * the way proapp registers them before it renders anything. proapp's own
 * colours (src/styles/dsColors.ts, yarn ds:colors) are loaded beside
 * shared's palette.
 */
const fs = require("fs")
const path = require("path")

const { readLatinRegistry, paths } = require("../nw-resolve")

const SHARED_SRC = path.join(paths.ROOT, "..", "tappler-shared", "src")
const DS_DIR = path.join(SHARED_SRC, "ds")
const APP_PALETTE = path.join(paths.ROOT, "src", "styles", "dsColors.ts")

const REACT_NATIVE_STUB = {
  Dimensions: {
    get: () => ({ width: 402, height: 874, scale: 3, fontScale: 1 }),
  },
  Platform: { OS: "ios", select: (o) => ("ios" in o ? o.ios : o.default) },
  StyleSheet: {
    create: (o) => o,
    flatten: (s) => s,
    hairlineWidth: 1 / 3,
    absoluteFill: Object.freeze({
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    }),
  },
  I18nManager: { isRTL: false },
}

const quietly = (fn) => {
  const { warn } = console
  console.warn = (...args) => {
    if (!String(args[0]).startsWith("[baseline-browser-mapping]")) warn(...args)
  }
  try {
    return fn()
  } finally {
    console.warn = warn
  }
}

const cache = new Map()

// Modules a loaded file imports that can't run here (a jest-only helper),
// by resolved path, with what they stand for.
const STUBS = new Map()
const stub = (file, exports) => STUBS.set(file, exports)

const SCRIPTS = path.join(paths.ROOT, "scripts") + path.sep

const resolveFile = (request, fromDir) => {
  const base = path.resolve(fromDir, request)
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      return candidate
  }
  throw new Error(`ds-codemod: can't find ${request} from ${fromDir}`)
}

// An import as the app's babel resolves it: relative, @tappler/shared/..., or
// rooted in src (module-resolver), else a package.
const resolveImport = (request, fromFile) => {
  if (request.startsWith("."))
    return resolveFile(request, path.dirname(fromFile))
  // eslint-disable-next-line global-require
  const { resolveSource } = require("./modules")
  const target = resolveSource(fromFile, request)
  return target.kind === "file" ? target.file : null
}

const load = (file) => {
  if (cache.has(file)) return cache.get(file).exports
  const babel = require("@babel/core")
  const { code } = quietly(() =>
    babel.transformSync(fs.readFileSync(file, "utf8"), {
      filename: file,
      babelrc: false,
      configFile: false,
      sourceType: "module",
      plugins: [
        [
          require.resolve("@babel/plugin-transform-typescript"),
          { isTSX: /\.[jt]sx$/.test(file) },
        ],
        // A .tsx module (Text, re-exported by the ds index a styles file
        // imports) only defines things at load; it renders nothing here.
        ...(/\.[jt]sx$/.test(file)
          ? [
              [
                require.resolve("@babel/plugin-transform-react-jsx"),
                { runtime: "automatic" },
              ],
            ]
          : []),
        require.resolve("@babel/plugin-transform-modules-commonjs"),
      ],
    })
  )
  const mod = { exports: {} }
  cache.set(file, mod)
  const localRequire = (name) => {
    if (name === "react-native") return REACT_NATIVE_STUB
    if (/\.svg$/.test(name)) return { __esModule: true, default: () => null }
    const target = resolveImport(name, file)
    if (target && STUBS.has(target)) return STUBS.get(target)
    // The scripts' own modules (nw-resolve): the instance this process uses.
    // eslint-disable-next-line import/no-dynamic-require
    if (target && target.startsWith(SCRIPTS)) return require(target)
    if (target) return load(target)
    // eslint-disable-next-line import/no-dynamic-require
    return require(require.resolve(name, { paths: [paths.ROOT] }))
  }
  // eslint-disable-next-line no-new-func
  new Function("exports", "require", "module", "__filename", "__dirname", code)(
    mod.exports,
    localRequire,
    mod,
    file,
    path.dirname(file)
  )
  return mod.exports
}

let ds
/** The token modules, loaded once. */
const loadDs = () => {
  if (ds) return ds
  const helpers = load(path.join(SHARED_SRC, "helpers", "helpers.ts"))
  const registry = readLatinRegistry()
  if (registry.weights) helpers.setLatinFontWeights(registry.weights)
  const typography = load(path.join(DS_DIR, "typography.ts"))
  const colors = load(path.join(DS_DIR, "colors.ts"))
  const atoms = load(path.join(DS_DIR, "atoms.ts"))
  const controls = load(path.join(DS_DIR, "controls.ts"))
  const radius = load(path.join(DS_DIR, "radius.ts"))
  const buttonStyles = load(path.join(DS_DIR, "buttonStyles.ts"))
  const palette = load(path.join(SHARED_SRC, "styles", "colors.ts")).default
  // proapp's own colours (yarn ds:colors), when the app has them.
  const appPalette = fs.existsSync(APP_PALETTE) ? load(APP_PALETTE).default : {}
  ds = {
    helpers,
    textStyle: typography.textStyle,
    TEXT_SIZES: typography.TEXT_SIZES,
    LEADING: typography.LEADING,
    LEGACY_LEADING: typography.LEGACY_LEADING,
    color: colors.color,
    a: atoms.a,
    controls: controls.controls,
    radius: radius.radius,
    buttonStyles,
    palette,
    appPalette,
    latinRegistry: registry.source,
  }
  return ds
}

module.exports = { loadDs, load, stub, SHARED_SRC, DS_DIR }
