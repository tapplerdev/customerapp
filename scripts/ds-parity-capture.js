#!/usr/bin/env node
/**
 * Captures host-tree parity fixtures (src/testing/hostTreeParity.ts).
 *
 *   yarn ds:parity:capture <test file> [more jest args] [--force]
 *
 * A screen kit test (`*.parity.tsx`, src/testing/screenKit) is run with
 * jest.parity.config.js, and the live half of a frozen pin (`*.pass1.test.*`,
 * src/testing/frozen.ts) with jest.pass1.config.js, unless a config is given:
 * the default config runs neither.
 *
 * Runs jest on the given test(s) in capture mode: every `expectParity` call
 * writes its case to `__parity__/<test file>.json` beside the test instead of
 * comparing, stamped with the commit it was captured on. A case that is
 * already in the fixture is refused unless --force is passed.
 *
 * Run it on the code BEFORE a change (the pre-conversion screen), commit the
 * fixture with the test, then make the change and run the test normally.
 */
const path = require("path")
const { execFileSync, spawnSync } = require("child_process")

const root = path.resolve(__dirname, "..")
const args = process.argv.slice(2)
const force = args.includes("--force")
const given = args.filter((arg) => arg !== "--force")
// A screen kit test (`*.parity.tsx`) and a pin's live half
// (`*.pass1.test.*`) run under their own configs.
const configOf = (arg) =>
  /\.parity\.tsx?$/.test(arg)
    ? "jest.parity.config.js"
    : /\.pass1\.test\.[jt]sx?$/.test(arg)
      ? "jest.pass1.config.js"
      : null
const configs = [...new Set(given.map(configOf).filter(Boolean))]
const configGiven = given.some(
  (arg) => arg === "-c" || arg.startsWith("--config")
)
if (configs.length > 1 && !configGiven) {
  console.error(
    `ds:parity:capture: ${configs.join(" and ")} can't run in one go; capture each kind on its own`
  )
  process.exit(2)
}
const jestArgs =
  configs.length && !configGiven
    ? ["-c", path.join(root, configs[0]), ...given]
    : given

if (jestArgs.length === 0) {
  console.error(
    "usage: yarn ds:parity:capture <test file> [jest args] [--force]"
  )
  process.exit(2)
}

let commit = "unknown"
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim()
} catch (error) {
  console.warn("ds:parity:capture: no git commit to stamp the cases with")
}

console.log(
  `ds:parity:capture: capturing on ${commit}${force ? " (--force: overwriting cases)" : ""}`
)

const result = spawnSync(
  path.join(root, "node_modules/.bin/jest"),
  ["--runInBand", ...jestArgs],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      DS_PARITY_CAPTURE: force ? "force" : "1",
      DS_PARITY_COMMIT: commit,
    },
  }
)

process.exit(result.status === null ? 1 : result.status)
