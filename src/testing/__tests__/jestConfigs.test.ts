import { afterAll, describe, expect, it } from "@jest/globals"
import { spawnSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

/*
 * Every jest config refuses a ../tappler-shared that isn't a real sibling
 * worktree (jest.config.js, which the others start from). With a symlink
 * there, jest drew shared's components without their NativeWind styles:
 * `yarn test` failed 17 tests, and a capture would have baked in uncompiled
 * classes (review, Low K: the refusal lived in jest.parity.config.js only).
 *
 * Each config is copied into a throwaway layout beside a sibling that is a
 * symlink to the real one, missing, or a real directory, and loaded in a
 * node of its own.
 */

const ROOT = path.resolve(__dirname, "../../..")
const CONFIGS = [
  "jest.config.js",
  "jest.parity.config.js",
  "jest.pass1.config.js",
  "jest.parity.reverse.config.js",
]

const layouts = fs.mkdtempSync(path.join(os.tmpdir(), "jest-configs-"))
afterAll(() => {
  fs.rmSync(layouts, { recursive: true, force: true })
})

/** A customerapp holding copies of the configs, beside `sibling`. */
const layout = (name: string, sibling: (shared: string) => void) => {
  const top = path.join(layouts, name)
  const app = path.join(top, "customerapp")
  fs.mkdirSync(app, { recursive: true })
  CONFIGS.forEach((config) =>
    fs.copyFileSync(path.join(ROOT, config), path.join(app, config))
  )
  sibling(path.join(top, "tappler-shared"))
  return app
}

/** What loading `config` in a fresh node says: "" when it loads. */
const load = (app: string, config: string) => {
  const result = spawnSync(
    process.execPath,
    ["-e", `require(${JSON.stringify(path.join(app, config))})`],
    { encoding: "utf8" }
  )
  return result.status === 0 ? "" : result.stderr
}

describe("every jest config refuses a ../tappler-shared that isn't a real sibling", () => {
  const symlinked = layout("symlink", (shared) =>
    fs.symlinkSync(path.join(ROOT, "..", "tappler-shared"), shared)
  )
  const missing = layout("missing", () => undefined)
  const real = layout("real", (shared) => fs.mkdirSync(shared))

  it.each(CONFIGS)("%s: a symlink and a missing sibling are refused, a real one isn't", (config) => {
    expect(load(symlinked, config)).toMatch(
      /tappler-shared must be a real sibling worktree, not a symlink/
    )
    expect(load(missing, config)).toMatch(
      /tappler-shared must be a real sibling worktree, not missing/
    )
    // Past the check, a config may still need what the layout lacks
    // (node_modules), but never refuses the sibling.
    expect(load(real, config)).not.toMatch(/must be a real sibling worktree/)
  })

  it("jest.config.js loads beside a real sibling", () => {
    expect(load(real, "jest.config.js")).toBe("")
  })
})
