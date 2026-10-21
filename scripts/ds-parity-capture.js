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
 *
 * The stamp is the commit the captured code is, so it says when that isn't
 * HEAD (review, Low K: it stamped HEAD over any uncommitted change). Test
 * material may differ from HEAD (the new test, its fixture, a harvest's
 * cases: anything under __tests__, __fixtures__ or __parity__, and
 * `*.parity.*` / `*.test.*` files). Any other change, the app's code, the
 * kit's, a config, makes it `<HEAD>-dirty.<hash>`, the hash of those changes
 * (their diff against HEAD and the untracked files' contents), and the
 * capture says which paths they are.
 */
const crypto = require("crypto")
const fs = require("fs")
const path = require("path")
const { execFileSync, spawnSync } = require("child_process")

const TEST_MATERIAL = /(^|\/)(__tests__|__fixtures__|__parity__)\/|\.(parity|test)\.[jt]sx?$/

/** A path the captured code doesn't depend on: a test, its fixture, its inputs. */
const isTestMaterial = (file) => TEST_MATERIAL.test(file)

/**
 * The stamp for a capture in `cwd`: `{ commit, dirty }`, where `dirty`
 * lists the changed paths that aren't test material and `commit` is HEAD's
 * short hash, with `-dirty.<hash of those changes>` when there are any.
 */
const stampOf = (cwd) => {
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 1 << 28 })
  const head = git("rev-parse", "--short", "HEAD").trim()
  // NUL-separated `XY path`; a rename's second (old) path follows its own NUL.
  const entries = git(
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all"
  ).split("\0")
  const changed = []
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    if (entry) {
      const status = entry.slice(0, 2)
      changed.push({ status, file: entry.slice(3) })
      if (status.includes("R") || status.includes("C")) i += 1
    }
  }
  const dirty = changed.filter(({ file }) => !isTestMaterial(file))
  if (dirty.length === 0) return { commit: head, dirty: [] }
  const hash = crypto.createHash("sha1")
  const tracked = dirty.filter(({ status }) => status !== "??")
  if (tracked.length > 0) {
    hash.update(
      git("diff", "HEAD", "--binary", "--", ...tracked.map(({ file }) => file))
    )
  }
  dirty
    .filter(({ status }) => status === "??")
    .map(({ file }) => file)
    .sort()
    .forEach((file) => {
      hash.update(`\0${file}\0`)
      hash.update(fs.readFileSync(path.join(cwd, file)))
    })
  return {
    commit: `${head}-dirty.${hash.digest("hex").slice(0, 10)}`,
    dirty: dirty.map(({ status, file }) => `${status} ${file}`),
  }
}

const main = () => {
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
    return 2
  }
  const jestArgs =
    configs.length && !configGiven
      ? ["-c", path.join(root, configs[0]), ...given]
      : given

  if (jestArgs.length === 0) {
    console.error(
      "usage: yarn ds:parity:capture <test file> [jest args] [--force]"
    )
    return 2
  }

  let commit = "unknown"
  try {
    const stamp = stampOf(root)
    commit = stamp.commit
    if (stamp.dirty.length > 0) {
      console.warn(
        `ds:parity:capture: ${stamp.dirty.length} uncommitted change(s) besides test material, so the cases ` +
          `say ${commit}, not HEAD. A capture is of the code BEFORE a change: commit it first unless these ` +
          `belong to it:\n${stamp.dirty.map((line) => `  ${line}`).join("\n")}`
      )
    }
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
  return result.status === null ? 1 : result.status
}

if (require.main === module) process.exit(main())

module.exports = { isTestMaterial, stampOf }
