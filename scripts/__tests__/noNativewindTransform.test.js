/**
 * The build has no NativeWind (W3 plan §5.4, proapp's review-w3-2 F2,
 * customerapp-plan.md skeptic H5; ported from proapp's W3.4): what
 * babel.config.js resolves, for every env Babel can be asked for, holds no
 * NativeWind plugin or preset, whether the file is under src, in
 * tappler-shared (through the alias) or neither; and a canary under src,
 * through the config with `comments: false` as Metro compiles a release,
 * comes out with no `nativewind` in it at all.
 *
 * Each check has its control: the same config with a stand-in for
 * `nativewind/babel` put back (scripts/nativewind-stand-in.js, since the
 * package itself left node_modules in W4: a programmatic plugin, which Babel
 * merges with the config's own) fails every one of them, so a check that
 * can't see the plugin fails too, once with the plugin put back as a plugin
 * and once carried by a preset. The resolved lists are the check that
 * counts: a plugin put back with no tailwind config (customerapp's went in
 * W3.4) compiles nothing, so the canary alone would pass it (`env: { production: { plugins:
 * ["nativewind/babel"] } }` fails the nine production rows above, and the
 * canary's row not at all). The lists come from `loadOptions`, which expands
 * every preset into the plugins it brings (review-ca-w3 F3): `loadPartialConfig`
 * lists a preset by its own name, so a local preset that carried the plugin, at
 * the top level or in an env block, resolved to nothing with "nativewind" in it.
 * A plugin wrapped in a function of the config's own is found by that
 * function's source.
 *
 * src/testing/__tests__/noPluginControl.test.tsx (W3.2) is the other half:
 * it draws a className under jest and resolves the config for an app and a
 * shared file under each env.
 */
const fs = require("fs")
const path = require("path")
const babel = require("@babel/core")

// A stand-in for the plugin (the real one is gone from node_modules), and its
// own function, to tell it when a config hands it over as a value
// (`plugins: [require("nativewind/babel")]`), which has no name or file for
// Babel to resolve (proapp's review-w3-4 F3).
const STAND_IN = require("./../nativewind-stand-in")
const NATIVEWIND_PLUGIN = require(STAND_IN.plugin)

const ROOT = path.resolve(__dirname, "..", "..")
const SHARED = path.resolve(ROOT, "..", "tappler-shared")

// Babel's envName: jest's (`yarn test`), Metro's dev server, and a release.
const ENVS = ["test", "development", "production"]
// Who asks: Metro for each platform, and jest.
const CALLERS = [
  { name: "metro", bundler: "metro", platform: "ios" },
  { name: "metro", bundler: "metro", platform: "android" },
  { name: "babel-jest", supportsStaticESM: false },
]
// Under src (never written to disk), in shared, and at the root (neither).
const FILES = {
  src: path.join(ROOT, "src", "components", "transformCanary.tsx"),
  shared: path.join(SHARED, "src", "components", "UI", "DmView", "DmView.tsx"),
  root: path.join(ROOT, "index.js"),
}
const CANARY_SOURCE = [
  'import React from "react"',
  'import { View, Text } from "react-native"',
  "export const Canary = () => (",
  '  <View className="flex-1 bg-white">',
  '    <Text className="text-14 text-black">canary</Text>',
  "  </View>",
  ")",
  "",
].join("\n")

// How the control puts NativeWind back: as a plugin, or inside a preset (a
// local preset file does the same: `module.exports = () => ({ plugins: [...] })`).
const PUT_BACK = {
  plugin: { plugins: [STAND_IN.plugin] },
  preset: { presets: [() => ({ plugins: [STAND_IN.plugin] })] },
}

// `withPlugin`: false, true (as a plugin), or "plugin" / "preset".
const options = (filename, envName, caller, withPlugin) => ({
  filename,
  cwd: ROOT,
  root: ROOT,
  configFile: path.join(ROOT, "babel.config.js"),
  babelrc: false,
  envName,
  caller,
  ...(withPlugin ? PUT_BACK[withPlugin === true ? "plugin" : withPlugin] : {}),
})

// Every plugin and preset a config resolves for a file, overrides and env
// blocks merged, two ways, because each sees what the other can't:
// - loadOptions expands every preset into the plugins it brings, and names
//   each by the file it loaded from (review-ca-w3 F3: loadPartialConfig lists
//   a preset by its own name, so a local preset carrying the plugin, at the
//   top level or in an env block, resolved to nothing with "nativewind" in it);
// - loadPartialConfig lists what the config handed over as written, so a
//   plugin given as a value, or wrapped in a function of the config's own,
//   is told by the function itself (its identity, or its source).
const resolved = (filename, envName, caller, withPlugin) => {
  const given = options(filename, envName, caller, withPlugin)
  const expanded = babel.loadOptions(given).plugins.map((plugin) => {
    return `${plugin.key} (expanded) -> ?`
  })
  const { options: listed } = babel.loadPartialConfig(given)
  const asWritten = [...listed.plugins, ...listed.presets].map((item) => {
    if (item.value === NATIVEWIND_PLUGIN)
      return "nativewind/babel (handed over as a function) -> ?"
    if (
      typeof item.value === "function" &&
      /nativewind/i.test(Function.prototype.toString.call(item.value))
    )
      return "a function that names nativewind -> ?"
    return `${item.file ? item.file.request : item.name || "?"} -> ${
      item.file ? item.file.resolved : "?"
    }`
  })
  return [...asWritten, ...expanded]
}
const nativewindIn = (entries) => entries.filter((e) => /nativewind/i.test(e))

const rows = ENVS.flatMap((envName) =>
  CALLERS.flatMap((caller) =>
    Object.entries(FILES).map(([where, filename]) => ({
      envName,
      caller,
      where,
      filename,
      label: `${envName} ${caller.name}${caller.platform ? ` ${caller.platform}` : ""} ${where}`,
    }))
  )
)

describe("babel.config.js resolves no NativeWind, in any env", () => {
  it("asks for every env and caller, with a file under src, in shared and at the root", () => {
    expect(rows).toHaveLength(ENVS.length * CALLERS.length * 3)
  })

  it.each(rows)("$label", ({ envName, caller, filename }) => {
    const entries = resolved(filename, envName, caller, false)
    // it resolved something (module-resolver, dotenv, Reanimated...)
    expect(entries.length).toBeGreaterThan(2)
    expect(nativewindIn(entries)).toEqual([])
  })

  it.each(rows)(
    "control, nativewind/babel put back: $label",
    ({ envName, caller, filename }) => {
      expect(
        nativewindIn(resolved(filename, envName, caller, "plugin")).length
      ).toBeGreaterThan(0)
    }
  )

  // review-ca-w3 F3: a preset that carries the plugin is seen inside
  it.each(rows)(
    "control, a preset carrying nativewind/babel: $label",
    ({ envName, caller, filename }) => {
      expect(
        nativewindIn(resolved(filename, envName, caller, "preset")).length
      ).toBeGreaterThan(0)
    }
  )
})

describe("a canary under src comes out with no nativewind in it", () => {
  const out = (envName, withPlugin) =>
    babel.transformSync(CANARY_SOURCE, {
      ...options(FILES.src, envName, CALLERS[0], withPlugin),
      comments: false,
    }).code

  it.each(ENVS)("%s", (envName) => {
    const code = out(envName, false)
    expect(code).toContain("canary")
    expect(code.match(/nativewind/gi)).toBeNull()
  })

  it.each(ENVS)("control, nativewind/babel put back wraps it: %s", (envName) => {
    const code = out(envName, true)
    expect(code).toMatch(/require\(["']nativewind["']\)/)
    expect(code).toContain("StyledComponent")
  })
})

describe("the build declares no NativeWind, tailwind or clsx", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
  )
  const FIELDS = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]
  const GONE = ["nativewind", "tailwindcss", "clsx"]

  it.each(GONE)("%s is in no dependency list", (name) => {
    expect(FIELDS.filter((field) => name in (manifest[field] ?? {}))).toEqual(
      []
    )
  })

  it("has no tailwind config left", () => {
    expect(
      fs
        .readdirSync(ROOT)
        .filter((file) => /^tailwind\.config\.[cm]?[jt]s$/.test(file))
    ).toEqual([])
  })

  it("has no NativeWind package in node_modules (control: the stand-in is the only one)", () => {
    expect(() => require.resolve("nativewind", { paths: [ROOT] })).toThrow()
    expect(fs.existsSync(STAND_IN.plugin)).toBe(true)
  })
})
