/**
 * jest transformer for the parity runs: babel-jest with the app's own
 * babel.config.js. A fixture (scripts/__fixtures__/ds-codemod, or the
 * codemod's output for one in ds-codemod-out) gets the two things a file in
 * src/ gets that a file elsewhere doesn't:
 * - NativeWind: only files in tailwind `content` are compiled, and
 *   tailwind reads the file from disk, so the plugin is handed a config
 *   whose content also lists the fixture directories
 *   (tailwind.fixtures.config.js, the app's config plus those globs);
 * - the React Compiler's infer mode, which babel.config.js's override gives
 *   src/ only.
 * Everything else (src, tappler-shared, node_modules) passes through as the
 * normal jest run compiles it.
 */
const path = require("path")
const babelJest = require("babel-jest").default

const ROOT = path.resolve(__dirname, "..", "..", "..")
const FIXTURE_DIRS = [
  path.join(ROOT, "scripts", "__fixtures__", "ds-codemod") + path.sep,
  path.join(ROOT, "scripts", "__fixtures__", "ds-codemod-out") + path.sep,
]
const isFixture = (file) => FIXTURE_DIRS.some((d) => file.startsWith(d))

const app = babelJest.createTransformer()
const fixture = babelJest.createTransformer({
  plugins: [
    [
      require.resolve("babel-plugin-react-compiler"),
      { panicThreshold: "none" },
    ],
    [
      require.resolve("nativewind/babel"),
      { tailwindConfig: path.join(__dirname, "tailwind.fixtures.config.js") },
    ],
  ],
})

const pick = (file) => (isFixture(file) ? fixture : app)

module.exports = {
  canInstrument: app.canInstrument,
  process: (source, file, options) => pick(file).process(source, file, options),
  processAsync: (source, file, options) =>
    pick(file).processAsync(source, file, options),
  getCacheKey: (source, file, options) =>
    `${isFixture(file) ? "fixture:" : ""}${pick(file).getCacheKey(source, file, options)}`,
  getCacheKeyAsync: async (source, file, options) =>
    `${isFixture(file) ? "fixture:" : ""}${await pick(file).getCacheKeyAsync(source, file, options)}`,
  isFixture,
}
