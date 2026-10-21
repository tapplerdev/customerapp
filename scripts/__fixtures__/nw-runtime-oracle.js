#!/usr/bin/env node
/**
 * Test support for nw-resolve: what NativeWind 2.0.11 itself makes of class
 * strings, end to end, with none of nw-resolve's code involved.
 *
 *   node scripts/__fixtures__/nw-runtime-oracle.js <classNames.json>
 *
 * Writes a .tsx file with one `<View className={...} />` per string, compiles
 * it with the real `nativewind/babel` plugin (pointed at a config that is
 * proapp's tailwind.config.js with `content` aimed at that file), runs the
 * compiled module so its `NativeWindStyleSheet.create(...)` registers the
 * styles with the real StyleSheetRuntime, then asks the runtime for each
 * string the way useTailwind does (`prepare`, then the snapshot) and prints
 * the flattened result as JSON. react-native is replaced by a small mock
 * (iOS, LTR, light, a 402x874 window), which is all the runtime touches.
 *
 * The same harness as the design-system verify pass (verify.md W3), kept
 * here so the resolver test can compare against it. It runs in its own
 * process because it swaps `require` for react-native globally.
 */
const fs = require("fs")
const os = require("os")
const path = require("path")
const Module = require("module")

const ROOT = path.resolve(__dirname, "..", "..")
const classNames = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))

// Written as raw JSX attribute strings, whitespace and all, the way a
// multi-line className sits in app source. Tailwind finds classes by scanning
// the source TEXT, so a JSON-escaped "a\tb" would hide `b` behind a literal
// "\t" and the runtime would never get its style.
const attribute = (c) =>
  c.includes('"') || c.includes("&") ? `{${JSON.stringify(c)}}` : `"${c}"`
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nw-oracle-"))
const file = path.join(dir, "Cases.tsx")
fs.writeFileSync(
  file,
  `import { View } from "react-native"\nexport const els = [\n${classNames
    .map((c) => `  <View className=${attribute(c)} />,`)
    .join("\n")}\n]\n`
)
const configFile = path.join(dir, "tailwind.config.js")
fs.writeFileSync(
  configFile,
  `const base = require(${JSON.stringify(path.join(ROOT, "tailwind.config.js"))})\n` +
    `module.exports = { ...base, content: [${JSON.stringify(file)}] }\n`
)

const flatten = (s) =>
  Array.isArray(s)
    ? s.reduce((acc, x) => Object.assign(acc, flatten(x)), {})
    : s || {}
const RN = {
  Platform: {
    OS: "ios",
    select: (o) => ("ios" in o ? o.ios : "native" in o ? o.native : o.default),
  },
  Dimensions: {
    get: () => ({ width: 402, height: 874, scale: 3, fontScale: 1 }),
    addEventListener: () => ({ remove() {} }),
  },
  Appearance: {
    getColorScheme: () => "light",
    addChangeListener: () => ({ remove() {} }),
  },
  PixelRatio: {
    get: () => 3,
    getFontScale: () => 1,
    getPixelSizeForLayoutSize: (x) => x * 3,
  },
  StyleSheet: { create: (x) => x, flatten, hairlineWidth: 1 / 3 },
  I18nManager: { isRTL: false },
  PlatformColor: (c) => ({ semantic: c }),
  View: "View",
}

const originalLoad = Module._load
let nativewind
Module._load = function load(request, ...rest) {
  if (request === "react-native") return RN
  if (request === "nativewind") return nativewind
  if (request === "react/jsx-runtime")
    return {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    }
  return originalLoad.call(this, request, ...rest)
}

const { StyleSheetRuntime } = require("nativewind/dist/style-sheet/runtime")
const runtime = new StyleSheetRuntime()
nativewind = {
  StyledComponent: "StyledComponent",
  NativeWindStyleSheet: {
    create: runtime.create.bind(runtime),
    hairlineWidth: runtime.hairlineWidth.bind(runtime),
    platformSelect: runtime.platformSelect.bind(runtime),
    pixelRatio: runtime.pixelRatio.bind(runtime),
    fontScale: runtime.fontScale.bind(runtime),
    platformColor: runtime.platformColor.bind(runtime),
    getPixelSizeForLayoutSize: runtime.getPixelSizeForLayoutSize,
    roundToNearestPixel: runtime.roundToNearestPixel,
  },
}

const babel = require("@babel/core")
const { code } = babel.transformSync(fs.readFileSync(file, "utf8"), {
  filename: file,
  cwd: dir,
  babelrc: false,
  configFile: false,
  plugins: [
    [require.resolve("nativewind/babel"), { tailwindConfig: configFile }],
    [require.resolve("@babel/plugin-transform-typescript"), { isTSX: true }],
    [
      require.resolve("@babel/plugin-transform-react-jsx"),
      { runtime: "automatic" },
    ],
    require.resolve("@babel/plugin-transform-modules-commonjs"),
  ],
})
const compiled = new Module(file, module)
compiled.filename = file
compiled.paths = Module._nodeModulePaths(ROOT)
compiled._compile(code, file)

const results = compiled.exports.els.map((el, i) => {
  // View from react-native is always wrapped; say so if it ever isn't.
  if (el.type !== "StyledComponent")
    return { className: classNames[i], error: "element was not wrapped" }
  // What the element carries, which is what the runtime gets. Babel's JSX
  // transform turns a newline plus indentation inside an attribute string
  // into one space, so it isn't always byte-identical to the input; the
  // classes are.
  const { className } = el.props
  const key = runtime.prepare(className, {})
  const styles = runtime.getSnapshot()[key] || []
  return {
    className,
    style: flatten(styles),
    mask: styles.mask || 0,
    childClassNames: styles.childClassNames || null,
  }
})
fs.rmSync(dir, { recursive: true, force: true })
process.stdout.write(JSON.stringify(results))
