#!/usr/bin/env node
/**
 * node scripts/ds-codemod/parity/run-real.js --out <dir> [--keep] [--tsc] [--cache <dir>]
 *
 * Pass-1 proof on real app files (targets.js):
 * 1. renders every target, as it is, in en and ar, on ios and android;
 * 2. converts the targets in place with `yarn ds:codemod` (wrap probe on);
 * 3. renders them again, converted;
 * 4. compares the host trees (Button's minHeight for ActionBtn's height is
 *    the one accepted difference, and counted); with --sweep, a file that
 *    can't load or has no component to draw fails the run unless
 *    sweep-gaps.js lists it with its cause (sweep.js);
 * 5. with --tsc, type-checks the converted tree against the error set
 *    before conversion;
 * 6. puts every file back (git checkout of what it changed, removal of the
 *    styles.ts files it created) unless --keep.
 * Refuses to start unless src/ is clean, so step 6 can't touch other work.
 * Writes <out>/summary.json and prints a table.
 */
const { execFileSync, spawnSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..", "..", "..")
const { FILES } = require("./targets")
const { allowButtonHeight, diffTrees } = require("./compare")
const { SWEEP_GAPS } = require("./sweep-gaps")
const { sweepVerdict } = require("./sweep")

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : null
}
const OUT = path.resolve(opt("--out") || path.join(ROOT, ".ds-parity"))
const KEEP = args.includes("--keep")
const TSC = args.includes("--tsc")
const CACHE = opt("--cache")
// --sweep: convert ALL of src and draw every file the codemod changes with no
// props (see real.parity.js), on top of the targets.
const SWEEP = args.includes("--sweep")
const PLATFORMS = ["ios", "android"]

const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" })
// Porcelain lines keep their two status columns: only the final newline goes.
const dirty = () => git("status", "--porcelain", "--", "src").replace(/\n$/, "")

const jest = (phase, platform, extraEnv = {}) => {
  const r = spawnSync(
    process.execPath,
    [
      path.join(ROOT, "node_modules", ".bin", "jest"),
      "-c",
      path.join(__dirname, "jest.config.js"),
      path.join(__dirname, "real.parity.js"),
      ...(CACHE ? ["--cacheDirectory", CACHE] : []),
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        DS_PARITY_PHASE: phase,
        DS_PARITY_PLATFORM: platform,
        DS_PARITY_OUT: OUT,
        ...extraEnv,
      },
    }
  )
  if (extraEnv.DS_PARITY_SWEEP) {
    console.log(`  sweep ${phase} ${platform}: done`)
    return JSON.parse(
      fs.readFileSync(path.join(OUT, phase, `${platform}.sweep.json`), "utf8")
    )
  }
  const tail = `${r.stdout}\n${r.stderr}`
    .split("\n")
    .filter((l) => /Tests:|✕|FAIL/.test(l))
  console.log(`  ${phase} ${platform}: ${tail.join(" ").trim() || "done"}`)
  return JSON.parse(
    fs.readFileSync(path.join(OUT, phase, `${platform}.json`), "utf8")
  )
}

const tscErrors = () => {
  const r = spawnSync(
    process.execPath,
    [
      path.join(ROOT, "node_modules", ".bin", "tsc"),
      "--noEmit",
      "-p",
      "tsconfig.json",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
    }
  )
  // file|code|message, line and column dropped (positions move when a file converts)
  return (r.stdout || "")
    .split("\n")
    .filter((l) => /error TS\d+/.test(l))
    .map((l) => l.replace(/\(\d+,\d+\)/, ""))
}

const multisetDiff = (a, b) => {
  const count = new Map()
  for (const x of a) count.set(x, (count.get(x) || 0) + 1)
  const added = []
  for (const x of b) {
    const n = count.get(x) || 0
    if (n > 0) count.set(x, n - 1)
    else added.push(x)
  }
  const removed = [...count].flatMap(([x, n]) => Array(n).fill(x))
  return { added, removed }
}

const main = () => {
  if (dirty()) {
    console.error(
      `run-real: src/ has changes; commit or stash them first:\n${dirty()}`
    )
    return 2
  }
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })
  console.log(`run-real: ${FILES.length} files, out ${OUT}`)
  const before = {}
  for (const p of PLATFORMS) before[p] = jest("original", p)
  // The sweep's list: every file the codemod would change.
  let sweepFiles = []
  const sweepBefore = {}
  const sweepList = path.join(OUT, "sweep-files.json")
  if (SWEEP) {
    const dry = path.join(OUT, "sweep-dry.json")
    spawnSync(
      process.execPath,
      [
        path.join(ROOT, "scripts", "ds-codemod.js"),
        "src",
        "--dry",
        "--quiet",
        "--report",
        dry,
      ],
      { cwd: ROOT }
    )
    const report = JSON.parse(fs.readFileSync(dry, "utf8"))
    sweepFiles = [
      ...new Set(
        report.sites.filter((x) => x.status === "converted").map((x) => x.file)
      ),
    ]
      .filter((f) => f.startsWith("src/") && !f.includes("/dev/"))
      .sort()
    fs.writeFileSync(sweepList, JSON.stringify(sweepFiles))
    for (const p of PLATFORMS)
      sweepBefore[p] = jest("original", p, { DS_PARITY_SWEEP: sweepList })
  }
  const baseErrors = TSC ? tscErrors() : null

  let changed = []
  const summary = { files: {}, totals: {}, tsc: null }
  try {
    const conv = spawnSync(
      process.execPath,
      [
        path.join(ROOT, "scripts", "ds-codemod.js"),
        ...(SWEEP ? ["src"] : FILES),
        "--latent",
        path.join(OUT, "latent-bugs.md"),
        "--report",
        path.join(OUT, "report.json"),
        "--quiet",
      ],
      { cwd: ROOT, encoding: "utf8" }
    )
    console.log(conv.stdout.trim().split("\n").slice(-12).join("\n"))
    if (conv.status !== 0) console.error(conv.stderr)
    changed = dirty()
      .split("\n")
      .filter(Boolean)
      .map((l) => ({ state: l.slice(0, 2).trim(), file: l.slice(3) }))
    const after = {}
    for (const p of PLATFORMS) after[p] = jest("converted", p)
    if (SWEEP) {
      const sweepAfter = {}
      for (const p of PLATFORMS)
        sweepAfter[p] = jest("converted", p, { DS_PARITY_SWEEP: sweepList })
      summary.sweep = sweepVerdict({
        files: sweepFiles,
        before: sweepBefore,
        after: sweepAfter,
        gaps: SWEEP_GAPS,
        diffTrees,
        allow: allowButtonHeight,
      })
    }
    if (TSC) {
      const d = multisetDiff(baseErrors, tscErrors())
      summary.tsc = {
        before: baseErrors.length,
        added: d.added,
        removed: d.removed,
      }
    }

    const report = JSON.parse(
      fs.readFileSync(path.join(OUT, "report.json"), "utf8")
    )
    let renders = 0
    let equal = 0
    let accepted = 0
    for (const file of FILES) {
      const sites = report.sites.filter((s) => s.file === file)
      const row = {
        converted: sites.filter((s) => s.status === "converted").length,
        left: sites.filter((s) => s.status === "left").length,
        renders: 0,
        equal: 0,
        accepted: 0,
        problems: [],
      }
      for (const p of PLATFORMS) {
        const a = before[p][file] || []
        const b = after[p][file] || []
        if (a.length !== b.length)
          row.problems.push({
            platform: p,
            problem: "different number of renders",
          })
        a.forEach((x, i) => {
          const y = b[i]
          row.renders++
          if (x.error || (y && y.error)) {
            row.problems.push({
              platform: p,
              case: x.case,
              lang: x.lang,
              error: x.error || y.error,
              both: !!(x.error && y && y.error),
            })
            return
          }
          const d = diffTrees(x.tree, y.tree, allowButtonHeight)
          row.accepted += d.accepted.length
          if (d.diffs.length)
            row.problems.push({
              platform: p,
              case: x.case,
              lang: x.lang,
              diffs: d.diffs.slice(0, 6),
            })
          else row.equal++
        })
      }
      renders += row.renders
      equal += row.equal
      accepted += row.accepted
      summary.files[file] = row
    }
    summary.totals = {
      files: FILES.length,
      renders,
      equal,
      accepted,
      codemod: report.totals,
    }
  } finally {
    if (!KEEP) {
      for (const c of changed) {
        if (c.state === "??")
          fs.rmSync(path.join(ROOT, c.file), { recursive: true, force: true })
        else git("checkout", "--", c.file)
      }
      if (dirty()) console.error(`run-real: could not restore:\n${dirty()}`)
    }
  }
  fs.writeFileSync(
    path.join(OUT, "summary.json"),
    JSON.stringify(summary, null, 2)
  )
  console.log("\nfile | converted | left | renders equal")
  for (const [file, r] of Object.entries(summary.files))
    console.log(
      `${file.replace(/^src\//, "")} | ${r.converted} | ${r.left} | ${r.equal}/${r.renders}${r.accepted ? ` (${r.accepted} Button heights)` : ""}${r.problems.length ? ` PROBLEMS ${r.problems.length}` : ""}`
    )
  console.log(
    `\n${summary.totals.equal}/${summary.totals.renders} renders equal; ${summary.totals.accepted} accepted Button heights`
  )
  if (summary.tsc)
    console.log(
      `tsc: ${summary.tsc.before} before, +${summary.tsc.added.length} / -${summary.tsc.removed.length} after`
    )
  if (summary.sweep) {
    const v = summary.sweep
    console.log(
      `sweep: ${v.files} files, ${v.equal}/${v.drawn} renders that draw are equal (${v.accepted} Button heights), ${v.needProps} need props (failed before and after), ${v.gaps.length} known gaps, ${v.loadFailures.length} load failures, ${v.noComponent.length} with no component, ${v.stale.length} stale gaps, ${v.problems.length} problems`
    )
    for (const g of v.gaps)
      console.log(`  known gap (${g.kind}) ${g.file}: ${g.cause}`)
    for (const f of v.loadFailures)
      console.log(
        `  LOAD FAILURE ${f.file} (${f.platform}): ${f.error} (fix it, or list it in sweep-gaps.js with its cause)`
      )
    for (const f of v.noComponent)
      console.log(`  NO COMPONENT ${f} (list it in sweep-gaps.js)`)
    for (const f of v.stale)
      console.log(`  STALE GAP ${f}: it no longer fails as listed`)
  }
  return summary.totals.equal === summary.totals.renders &&
    (!summary.tsc || summary.tsc.added.length === 0) &&
    (!summary.sweep || summary.sweep.ok)
    ? 0
    : 1
}

process.exitCode = main()
