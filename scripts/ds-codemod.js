#!/usr/bin/env node
/**
 * yarn ds:codemod <files|dirs|globs> [--dry] [--report out.json] [--no-probe]
 *                 [--latent latent-bugs.md] [--quiet]
 *
 * Pass 1 of the StyleSheet migration: rewrites NativeWind class names as the
 * design system's components and styles, pixel for pixel. Every value comes
 * from ds:resolve (NativeWind 2.0.11's own compiler with this app's
 * tailwind.config.js), and every conversion is checked against it for every
 * combination of the site's conditions before anything is written; a site
 * that can't be written exactly is left as it is and reported, never
 * approximated.
 *
 * Rules (scripts/ds-codemod/*):
 * 1. <DmText className> -> ds <Text size weight leading color align family
 *    style> (dmtext.js). Arabic's leading-[Npx] x 1.32 is the token table's,
 *    `legacy` stays unscaled, exactly as DmText does today.
 * 2. <ActionBtn className textClassName disable ...> -> ds <Button size shape
 *    label labelWeight disabledLook style> (actionbtn.js).
 * 3. DmView and the hosts NativeWind styles at the call site (SafeAreaView,
 *    Animated.View, MapView...): className -> style, atoms from `a` where an
 *    atom is exactly the output, otherwise entries in a co-located styles.ts.
 *    The element's own style stays, after the class styles, as NativeWind
 *    orders them; an animated style is never flattened or moved.
 * 4. clsx, template strings and ternaries keep their conditions, as a style
 *    array in the same order (plain.js).
 * 5. A `*className` on one of our components becomes its style slot only once
 *    the component declares the slot (slots.js); until then it waits.
 * 6. Classes NativeWind drops today are left out of the output (they draw
 *    nothing) and written to latent-bugs.md with file:line.
 * 7. Imports: the ds names it uses are added; DmText, ActionBtn and clsx
 *    imports nothing uses any more are removed.
 * Nothing else changes: no prop is renamed beyond these mappings, no logic is
 * touched. A converted site has no className, so re-running the codemod
 * skips it and picks up only what is still waiting (wave 2 converts
 * components first, then re-runs over the screens).
 *
 * Formatting: the source is spliced, not reprinted, and prettier runs only
 * over a file that was prettier-clean before (so no unrelated line moves).
 *
 * Exit: 0 done (sites left as they were are not an error), 1 a file failed
 * to convert or the probe's positive control failed, 2 usage.
 */
const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")
const DEFAULT_LATENT = path.join(ROOT, "latent-bugs.md")

const USAGE = `usage: yarn ds:codemod <files|dirs|globs> [--dry] [--report out.json] [--no-probe] [--latent file.md] [--quiet]

  --dry        change nothing; print (and with --report, write) what would happen
  --report     write every site, its outcome and the totals as JSON
  --no-probe   don't ask ds:probe which call sites NativeWind wraps (faster;
               misses React Compiler temporaries, so a wrapped DmText or
               ActionBtn would be converted as if it weren't)
  --latent     where dropped classes are appended (default latent-bugs.md)
  --quiet      only the totals`

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory())
      return [
        "node_modules",
        "__tests__",
        "__mocks__",
        "__fixtures__",
      ].includes(e.name)
        ? []
        : walk(full)
    return /\.(tsx|jsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)
      ? [full]
      : []
  })

const expand = (args) => {
  const files = []
  for (const a of args) {
    const abs = path.resolve(a)
    if (fs.existsSync(abs)) {
      if (fs.statSync(abs).isDirectory()) files.push(...walk(abs))
      else files.push(abs)
      continue
    }
    const fg = require("fast-glob")
    const hits = fg.sync(a, {
      absolute: true,
      ignore: ["**/node_modules/**", "**/__tests__/**"],
    })
    if (hits.length === 0) throw new Error(`ds-codemod: nothing matches ${a}`)
    files.push(...hits.filter((f) => /\.(tsx|jsx)$/.test(f)))
  }
  return [...new Set(files)].sort()
}

// One NativeWind run for every class-looking word in the files, so each
// site's resolution is a cache hit.
const prefetchFiles = (files) => {
  const { prefetch } = require("./nw-resolve")
  const words = new Set()
  for (const f of files) {
    const code = fs.readFileSync(f, "utf8")
    for (const m of code.matchAll(/["'`]([^"'`\n]*)["'`]/g))
      for (const w of m[1].split(/\s+/))
        if (/^-?[a-z][\w-]*(\[[^\]\s]+\])?(\/\d+)?$/i.test(w) && w.length < 60)
          words.add(w)
  }
  prefetch([...words])
}

const prettierFor = async (file) => {
  const prettier = require("prettier")
  const options = (await prettier.resolveConfig(file)) || {}
  return { prettier, options: { ...options, filepath: file } }
}

const isClean = async (code, file) => {
  const { prettier, options } = await prettierFor(file)
  try {
    return await prettier.check(code, options)
  } catch {
    return false
  }
}

const format = async (code, file) => {
  const { prettier, options } = await prettierFor(file)
  return prettier.format(code, options)
}

// ---------------------------------------------------------------------------
// latent-bugs.md

const LATENT_HEADER = `# Latent bugs the design-system codemod found

Classes NativeWind 2 drops today, and typography in a DmText's style that
DmText's font layer draws over: they render nothing, so pass 1 of the
StyleSheet migration leaves them out to stay pixel-identical, and this file is
the only place they survive. Pass 2 decides what each one meant and fixes it on
purpose, with a screenshot.

\`yarn ds:codemod\` appends a row per dropped class (or style key) per converted
site, sorted by file. The line is the file's line BEFORE conversion
(\`git show <base>:<file>\`). On a merge conflict keep both sides: rows never
repeat.

| Site | Element | Class | Why it renders nothing |
| --- | --- | --- | --- |
`

const latentRow = (r) =>
  `| ${r.file}:${r.line ?? "?"} | ${r.tag} | \`${r.class.replace(/\|/g, "\\|")}\` | ${r.reason.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`

const appendLatent = (file, rows) => {
  const existing = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8")
    : LATENT_HEADER
  const lines = existing.split("\n")
  const tableAt = lines.findIndex((l) => l.startsWith("| --- |"))
  if (tableAt < 0)
    throw new Error(`ds-codemod: ${file} has no table to append to`)
  const head = lines.slice(0, tableAt + 1)
  const old = lines.slice(tableAt + 1).filter((l) => l.startsWith("| "))
  const all = [...new Set([...old, ...rows.map(latentRow)])]
  const key = (row) => {
    const m = row.match(/^\| (.*?):(\d+|\?) \|/)
    return m ? [m[1], Number(m[2]) || 0] : ["", 0]
  }
  all.sort((x, y) => {
    const [fx, lx] = key(x)
    const [fy, ly] = key(y)
    return fx < fy ? -1 : fx > fy ? 1 : lx - ly || (x < y ? -1 : 1)
  })
  fs.writeFileSync(file, `${[...head, ...all].join("\n")}\n`)
  return all.length - old.length
}

// ---------------------------------------------------------------------------

const totalsOf = (sites, files) => {
  const t = {
    files: files.length,
    filesChanged: 0,
    sites: sites.length,
    converted: 0,
    left: 0,
    leftByReason: {},
    byKind: {},
    dropped: 0,
    escapes: { legacy: 0, px: 0, system: 0 },
    // converted DmText whose own style had typography; its dead keys
    styleTypography: 0,
    deadStyle: 0,
  }
  for (const s of sites) {
    const k = (t.byKind[s.kind] = t.byKind[s.kind] || { converted: 0, left: 0 })
    if (s.status === "converted") {
      t.converted++
      k.converted++
      t.dropped += (s.dropped || []).length
      t.deadStyle += (s.deadStyle || []).length
      if (s.flags)
        for (const f of Object.keys(t.escapes)) if (s.flags[f]) t.escapes[f]++
      if (s.flags && s.flags.styleTypography) t.styleTypography++
    } else {
      t.left++
      k.left++
      t.leftByReason[s.reason] = (t.leftByReason[s.reason] || 0) + 1
    }
  }
  t.leftByReason = Object.fromEntries(
    Object.entries(t.leftByReason).sort((a, b) => b[1] - a[1])
  )
  return t
}

const run = async (argv) => {
  const args = []
  const opts = {
    dry: false,
    report: null,
    probe: true,
    latent: DEFAULT_LATENT,
    quiet: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--dry") opts.dry = true
    else if (a === "--report") opts.report = path.resolve(argv[++i])
    else if (a === "--no-probe") opts.probe = false
    else if (a === "--latent") opts.latent = path.resolve(argv[++i])
    else if (a === "--quiet") opts.quiet = true
    else if (a === "--help" || a === "-h") {
      console.log(USAGE)
      return 0
    } else if (a.startsWith("--")) {
      console.error(`ds-codemod: unknown option ${a}\n${USAGE}`)
      return 2
    } else args.push(a)
  }
  if (args.length === 0) {
    console.error(USAGE)
    return 2
  }
  const files = expand(args)
  const { convertSource } = require("./ds-codemod/convert")
  const { rel } = require("./ds-codemod/modules")
  let probe = null
  if (opts.probe) {
    probe = require("./nw-wrap-probe")
    const control = probe.runControl()
    if (!control.ok) {
      console.error(
        "ds-codemod: ds:probe's positive control failed, so its wrap list can't be trusted (run yarn ds:probe)"
      )
      return 1
    }
  }
  prefetchFiles(files)

  const sites = []
  const latent = []
  const notes = []
  const outputs = []
  // styles.ts files as this run leaves them: components in one directory
  // share one, so each conversion merges into what the last one wrote.
  const overlay = new Map()
  const io = {
    read: (f) => (overlay.has(f) ? overlay.get(f) : fs.readFileSync(f, "utf8")),
    exists: (f) => overlay.has(f) || fs.existsSync(f),
  }
  const stylesOriginal = new Map()
  const failures = []
  for (const file of files) {
    let wraps = []
    if (probe) {
      const r = probe.probeFile(file)
      if (r.error) {
        failures.push({ file: rel(file), error: `probe: ${r.error}` })
        continue
      }
      wraps = r.wraps || []
    }
    const code = fs.readFileSync(file, "utf8")
    let result
    try {
      result = convertSource(code, file, { wraps, io })
    } catch (error) {
      failures.push({ file: rel(file), error: error.stack || String(error) })
      continue
    }
    sites.push(...result.sites)
    latent.push(...result.latent)
    notes.push(...result.notes)
    if (result.styles) {
      const f = result.styles.file
      if (!stylesOriginal.has(f))
        stylesOriginal.set(
          f,
          fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null
        )
      overlay.set(f, result.styles.code)
    }
    if (result.changed) outputs.push({ file, code, result })
  }

  // Write (or not), formatting only what was clean before.
  let stylesCreated = 0
  let stylesMerged = 0
  const unformatted = []
  for (const o of outputs) {
    const clean = await isClean(o.code, o.file)
    const next = clean ? await format(o.result.code, o.file) : o.result.code
    if (!clean) unformatted.push(rel(o.file))
    if (!opts.dry) fs.writeFileSync(o.file, next)
  }
  // Each styles file once, as the last conversion left it.
  for (const [f, text] of overlay) {
    const before = stylesOriginal.get(f)
    if (before === null) stylesCreated++
    else stylesMerged++
    const clean = before === null || (await isClean(before, f))
    if (!opts.dry) fs.writeFileSync(f, clean ? await format(text, f) : text)
  }
  let latentAdded = 0
  if (!opts.dry && latent.length)
    latentAdded = appendLatent(opts.latent, latent)

  const totals = {
    ...totalsOf(sites, files),
    filesChanged: outputs.length,
    stylesCreated,
    stylesMerged,
    failures: failures.length,
    latentRows: latent.length,
  }
  if (opts.report)
    fs.writeFileSync(
      opts.report,
      JSON.stringify(
        { dry: opts.dry, totals, failures, unformatted, notes, sites, latent },
        null,
        2
      )
    )
  if (!opts.quiet) {
    for (const f of failures)
      console.error(`FAILED ${f.file}: ${f.error.split("\n")[0]}`)
    for (const n of notes) console.log(`note  ${n.file}:${n.line} ${n.note}`)
    const byFile = new Map()
    for (const s of sites)
      byFile.set(s.file, [...(byFile.get(s.file) || []), s])
    for (const [file, list] of byFile) {
      const c = list.filter((s) => s.status === "converted").length
      console.log(`${file}: ${c} converted, ${list.length - c} left`)
      for (const s of list.filter((x) => x.status === "left"))
        console.log(
          `  left  :${s.line} <${s.tag}> ${s.attr || ""} ${s.reason}${s.detail ? `: ${s.detail}` : ""}`
        )
    }
  }
  console.log(
    `\nds-codemod${opts.dry ? " (dry run)" : ""}: ${totals.files} files, ${totals.sites} sites: ` +
      `${totals.converted} converted, ${totals.left} left, ${totals.dropped} dropped classes` +
      (opts.dry
        ? ""
        : `; ${totals.filesChanged} files written, ${latentAdded} new latent-bug rows`) +
      (failures.length ? `; ${failures.length} files FAILED` : "")
  )
  for (const [reason, n] of Object.entries(totals.leftByReason))
    console.log(`  left ${reason}: ${n}`)
  return failures.length ? 1 : 0
}

module.exports = { run, appendLatent, LATENT_HEADER, totalsOf, expand }

if (require.main === module)
  run(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code
    },
    (error) => {
      console.error(error.stack || String(error))
      process.exitCode = 1
    }
  )
