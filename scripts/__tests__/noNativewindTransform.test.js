/**
 * The build has no NativeWind (W3 plan §5.4, proapp's review-w3-2 F2,
 * customerapp-plan.md skeptic H5; ported from proapp's W3.4): what
 * babel.config.js resolves, for every env Babel can be asked for, holds no
 * NativeWind plugin or preset, whether the file is under src, in
 * tappler-shared (through the alias) or neither; and a canary under src,
 * through the config with `comments: false` as Metro compiles a release,
 * comes out with no `nativewind` in it at all.
 *
 * Each check has its control: the same config with `nativewind/babel` put
 * back (as a programmatic plugin, which Babel merges with the config's own,
 * and with a throwaway tailwind config, because the plugin compiles nothing
 * without one) fails every one of them, so a check that can't see the plugin
 * fails too. The resolved lists are the check that counts: a plugin put back
 * with no tailwind config (customerapp's went in W3.4) compiles nothing, so
 * the canary alone would pass it (`env: { production: { plugins:
 * ["nativewind/babel"] } }` fails the nine production rows above, and the
 * canary's row not at all).
 *
 * src/testing/__tests__/noPluginControl.test.tsx (W3.2) is the other half:
 * it draws a className under jest and resolves the config for an app and a
 * shared file under each env.
 */
const fs = require("fs")
const os = require("os")
const path = require("path")
const babel = require("@babel/core")

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

// The control's tailwind config, in a directory of its own.
const control = fs.mkdtempSync(path.join(os.tmpdir(), "no-nativewind-"))
const CONTROL_TAILWIND = path.join(control, "tailwind.config.js")
fs.writeFileSync(
  CONTROL_TAILWIND,
  'module.exports = { content: ["./src/**/*.{jsx,tsx}"], theme: { extend: {} } }\n'
)
afterAll(() => fs.rmSync(control, { recursive: true, force: true }))

const options = (filename, envName, caller, withPlugin) => ({
  filename,
  cwd: ROOT,
  root: ROOT,
  configFile: path.join(ROOT, "babel.config.js"),
  babelrc: false,
  envName,
  caller,
  ...(withPlugin
    ? {
        plugins: [["nativewind/babel", { tailwindConfig: CONTROL_TAILWIND }]],
      }
    : {}),
})

// Every plugin and preset a config resolves for a file, overrides and env
// blocks merged, by what it was asked for and the file it resolved to.
const resolved = (filename, envName, caller, withPlugin) => {
  const { options: resolvedOptions } = babel.loadPartialConfig(
    options(filename, envName, caller, withPlugin)
  )
  return [...resolvedOptions.plugins, ...resolvedOptions.presets].map(
    (item) =>
      `${item.file ? item.file.request : item.name || "?"} -> ${
        item.file ? item.file.resolved : "?"
      }`
  )
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
        nativewindIn(resolved(filename, envName, caller, true))
      ).toHaveLength(1)
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
