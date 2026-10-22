import { describe, expect, it, jest } from "@jest/globals"
import path from "path"
import React from "react"

/*
 * The no-plugin control, in `yarn test` since W3.2 took NativeWind's Babel
 * plugin out of babel.config.js: this run must really draw without it.
 * ClassNameOnView is a literal className on a View in a file under src, so
 * whatever transform jest compiles it with applies. Without the plugin the
 * className reaches the host as a plain prop; with it back anywhere in jest's
 * transform, the View is wrapped and draws marginTop 4, and this fails.
 *
 * Jest runs all of that in Babel's `test` env, so a plugin added under
 * `env.development` or `env.production` in babel.config.js would pass the
 * render and still be in Metro's dev or release bundle (proapp's W3.2 review,
 * F2). The second block resolves the plugins babel.config.js gives an app
 * file and a shared one under each env, and compiles the canary's source as
 * Metro does: no NativeWind plugin, no wrap, no require of it.
 */

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

/* eslint-disable import/first */
import {
  CLASS_NAME_ON_VIEW_SOURCE,
  ClassNameOnView,
} from "testing/__fixtures__/ClassNameOnView"
import { hostTree } from "testing/hostTreeParity"
/* eslint-enable import/first */

const ROOT = path.resolve(__dirname, "../../..")
const SHARED = path.resolve(ROOT, "..", "tappler-shared")

describe("this suite really runs without NativeWind", () => {
  it("leaves a className on a host as a plain prop", () => {
    // A literal className on a View, in a file this run compiles: with
    // NativeWind's plugin it would draw marginTop 4.
    const tree = hostTree(<ClassNameOnView />, { language: "en" })
    expect(tree).toEqual({
      type: "View",
      props: { className: "mt-[4]" },
      children: [],
    })
  })
})

describe("babel.config.js carries no NativeWind plugin, in any env", () => {
  const babel = require("@babel/core") as typeof import("@babel/core")
  const ENVS = ["test", "development", "production"]
  const FILES = {
    "an app file": path.join(
      ROOT,
      "src",
      "testing",
      "__fixtures__",
      "__canary__.tsx"
    ),
    "a shared file": path.join(
      SHARED,
      "src",
      "components",
      "UI",
      "DmView",
      "DmView.tsx"
    ),
  }
  const options = (filename: string, envName: string) => ({
    filename,
    cwd: ROOT,
    configFile: path.join(ROOT, "babel.config.js"),
    babelrc: false,
    envName,
    caller: { name: "metro", platform: "ios" },
  })

  it.each(
    ENVS.flatMap((envName) =>
      Object.entries(FILES).map(([what, file]) => ({ envName, what, file }))
    )
  )("resolves none for $what in $envName", ({ envName, file }) => {
    const resolved = babel.loadOptions(options(file, envName)) as {
      plugins?: { key?: string; file?: { request?: string } }[]
    } | null
    const names = (resolved?.plugins ?? []).map((plugin) =>
      String(plugin.file?.request ?? plugin.key)
    )
    expect(names.length).toBeGreaterThan(0)
    expect(names.filter((name) => /nativewind/i.test(name))).toEqual([])
  })

  it.each(ENVS)("compiles the canary to a plain className in %s", (envName) => {
    const out = babel.transformSync(
      CLASS_NAME_ON_VIEW_SOURCE,
      options(FILES["an app file"], envName)
    )
    expect(out?.code).toContain("className")
    expect(out?.code).not.toMatch(
      /nativewind|StyledComponent|NativeWindStyleSheet/i
    )
  })
})
