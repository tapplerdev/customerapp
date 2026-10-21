/**
 * The codemod's rules, drawn: every fixture under scripts/__fixtures__/ds-codemod
 * is copied to ds-codemod-out, converted there by the real CLI (in its own
 * process), and then the original and the converted
 * module are rendered with the real NativeWind runtime in English and Arabic
 * (right to left) for each of the fixture's prop cases. The host trees must
 * be equal, apart from the one listed difference (Button's minHeight where
 * ActionBtn set a height). Run per platform:
 *   DS_PARITY_PLATFORM=ios|android jest -c scripts/ds-codemod/parity/jest.config.js
 */
const { execFileSync } = require("child_process")
const fs = require("fs")
const path = require("path")
const React = require("react")

const { allowButtonHeight, diffTrees, renderTree } = require("./render")

// Read through globalThis: babel here (react-native-dotenv) inlines a
// literal `process.env.NAME` at transform time, and jest caches the result.
const ENV = globalThis.process.env

const ROOT = path.resolve(__dirname, "..", "..", "..")
const CLI = path.join(ROOT, "scripts", "ds-codemod.js")
const FIXTURES = path.join(ROOT, "scripts", "__fixtures__", "ds-codemod")
const OUT = path.join(ROOT, "scripts", "__fixtures__", "ds-codemod-out")
const PROVEN = path.join(FIXTURES, "actionbtn", "proven.json")

const MAIN = [
  ["dmtext", "DmTextCases"],
  ["actionbtn", "ActionBtnCases"],
  ["views", "ViewCases"],
  ["slots", "SlotCases"],
  ["names", "NameCases"],
  ["shared", "SharedCases"],
]

const runCodemod = (...args) => {
  const env = { ...process.env }
  // The probe refuses to run inside jest, and rightly: jest's resolver
  // changes what NativeWind wraps. This is its own process.
  delete env.JEST_WORKER_ID
  // --no-probe: the probe can't place a fixture in src/ (a virtual path
  // breaks its relative imports), so wraps come from the import rule alone;
  // the real-file parity run is where the probe is exercised.
  // --proven: the ActionBtn fixture's looks, which this run draws against
  // Button (customerapp has proven none of its own yet), so its
  // conversions are drawn and compared like every other rule's.
  return execFileSync(
    process.execPath,
    [CLI, OUT, "--no-probe", "--quiet", "--proven", PROVEN, ...args],
    {
      cwd: ROOT,
      env,
      encoding: "utf8",
    }
  )
}

const snapshotDir = (dir) => {
  const out = {}
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name)
      if (e.isDirectory()) walk(f)
      else if (/\.(tsx?|md)$/.test(e.name))
        out[path.relative(dir, f)] = fs.readFileSync(f, "utf8")
    }
  }
  walk(dir)
  return out
}

let report
let afterFirst

beforeAll(() => {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.cpSync(FIXTURES, OUT, { recursive: true })
  fs.rmSync(path.join(OUT, "sanity"), { recursive: true, force: true })
  runCodemod(
    "--latent",
    path.join(OUT, "latent-bugs.md"),
    "--report",
    path.join(OUT, "report.json")
  )
  report = JSON.parse(fs.readFileSync(path.join(OUT, "report.json"), "utf8"))
  afterFirst = snapshotDir(OUT)
}, 120000)

afterAll(() => {
  if (!ENV.DS_PARITY_KEEP) fs.rmSync(OUT, { recursive: true, force: true })
})

const relOut = (dir, name) =>
  path.relative(ROOT, path.join(OUT, dir, `${name}.tsx`))

describe.each(MAIN)("fixture %s", (dir, name) => {
  const original = () =>
    // eslint-disable-next-line import/no-dynamic-require
    require(path.join(FIXTURES, dir, name))
  const converted = () =>
    // eslint-disable-next-line import/no-dynamic-require
    require(path.join(OUT, dir, name))

  it("converts and leaves the sites it should, for the stated reasons", () => {
    const { expected } = original()
    const sites = report.sites.filter((s) => s.file === relOut(dir, name))
    const left = {}
    for (const s of sites.filter((x) => x.status === "left"))
      left[s.reason] = (left[s.reason] || 0) + 1
    expect({
      converted: sites.filter((s) => s.status === "converted").length,
      left,
    }).toEqual({ converted: expected.converted, left: expected.left })
    const dropped = report.latent
      .filter((r) => r.file === relOut(dir, name))
      .map((r) => r.class)
    expect(dropped.sort()).toEqual([...expected.dropped].sort())
    const code = fs.readFileSync(path.join(OUT, dir, `${name}.tsx`), "utf8")
    const imports = code.match(/^import[^]*?from\s+["'][^"']+["']/gm) || []
    for (const imported of expected.removedImports)
      expect(
        imports.filter((i) => new RegExp(`\\b${imported}\\b`).test(i))
      ).toEqual([])
  })

  it("draws the same host tree in English and Arabic for every case", async () => {
    const before = original()
    const after = converted()
    const problems = []
    for (const c of before.cases)
      for (const lang of ["en", "ar"]) {
        const a = await renderTree(
          React.createElement(before.default, c.props),
          lang
        )
        const b = await renderTree(
          React.createElement(after.default, c.props),
          lang
        )
        const { diffs } = diffTrees(a, b, allowButtonHeight)
        if (diffs.length)
          problems.push({ case: c.name, lang, diffs: diffs.slice(0, 5) })
      }
    expect(problems).toEqual([])
  })
})

it("writes each dropped class to latent-bugs.md with file:line", () => {
  const md = fs.readFileSync(path.join(OUT, "latent-bugs.md"), "utf8")
  expect(md).toMatch(/^# Latent bugs/)
  const rows = md.split("\n").filter((l) => /^\| scripts\//.test(l))
  expect(rows.length).toBe(report.latent.length)
  expect(
    rows.some((r) =>
      /DmTextCases\.tsx:\d+ \| DmText \| `flex-between` \|/.test(r)
    )
  ).toBe(true)
})

it("changes nothing when run again (a converted site has no className)", () => {
  const out = runCodemod(
    "--latent",
    path.join(OUT, "latent-bugs.md"),
    "--report",
    path.join(OUT, "report2.json")
  )
  const second = JSON.parse(
    fs.readFileSync(path.join(OUT, "report2.json"), "utf8")
  )
  fs.rmSync(path.join(OUT, "report2.json"))
  expect(second.totals.converted).toBe(0)
  const now = snapshotDir(OUT)
  delete now["report.json"]
  expect(now).toEqual(afterFirst)
  void out
}, 120000)

// The comparison isn't vacuous: one token off in the converted file is a
// difference it reports, and Button's listed minHeight is accepted only
// where the value is ActionBtn's height.
describe("the parity check", () => {
  // Each mutant its own file: jest keeps a required module by path.
  let mutants = 0
  const mutant = async (dir, name, from, to) => {
    const src = fs.readFileSync(path.join(OUT, dir, `${name}.tsx`), "utf8")
    expect(src).toContain(from)
    mutants += 1
    const file = path.join(OUT, dir, `${name}Mutant${mutants}.tsx`)
    fs.writeFileSync(file, src.replace(from, to))
    try {
      // eslint-disable-next-line import/no-dynamic-require
      const before = require(path.join(FIXTURES, dir, name))
      // eslint-disable-next-line import/no-dynamic-require
      const after = require(file)
      const c = before.cases[0]
      const a = await renderTree(
        React.createElement(before.default, c.props),
        "ar"
      )
      const b = await renderTree(
        React.createElement(after.default, c.props),
        "ar"
      )
      return diffTrees(a, b, allowButtonHeight)
    } finally {
      fs.rmSync(file)
    }
  }

  it("reports a converted text one leading step off", async () => {
    const { diffs } = await mutant(
      "dmtext",
      "DmTextCases",
      'leading="tight"',
      'leading="normal"'
    )
    expect(diffs).toEqual([
      expect.objectContaining({
        path: expect.stringMatching(/style\.lineHeight$/),
        a: 16 * 1.32,
        b: 18 * 1.32,
      }),
    ])
  })

  it("reports a style whose typography became props but whose colour was lost", async () => {
    const { diffs } = await mutant(
      "dmtext",
      "DmTextCases",
      '{ color: "#8C8C8C", textAlign: "left" }',
      '{ textAlign: "left" }'
    )
    expect(diffs).toEqual([
      expect.objectContaining({
        path: expect.stringMatching(/style\.color$/),
        a: "#8C8C8C",
      }),
    ])
  })

  it("reports a typed prop the conversion forgot (the rule a border-0 hid comes back)", async () => {
    const { diffs } = await mutant(
      "slots",
      "SlotCases",
      "separator={false} ",
      ""
    )
    expect(diffs).toEqual([
      expect.objectContaining({
        path: expect.stringMatching(/style\.height$/),
        a: 0,
        b: 1,
      }),
    ])
  })

  it("reports MainModal's radius one off (the wrapper takes it)", async () => {
    const { diffs } = await mutant(
      "shared",
      "SharedCases",
      "radius={px(20)}",
      "radius={px(21)}"
    )
    expect(diffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringMatching(/style\.borderTopLeftRadius$/),
          a: 20,
          b: 21,
        }),
      ])
    )
  })

  it("reports a *Type one leading off, and a field's Arabic leading one off", async () => {
    const title = await mutant(
      "shared",
      "SharedCases",
      "leading: { legacy: px(27) }",
      "leading: { legacy: px(26) }"
    )
    expect(title.diffs).toEqual([
      expect.objectContaining({
        path: expect.stringMatching(/style\.lineHeight$/),
        a: 27 * 1.32,
        b: 26 * 1.32,
      }),
    ])
    const field = await mutant(
      "shared",
      "SharedCases",
      "arabicLeading: px(19)",
      "arabicLeading: px(18)"
    )
    expect(field.diffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringMatching(/style\.lineHeight$/),
          a: 19 * 1.32,
          b: 18 * 1.32,
        }),
      ])
    )
  })

  it("reports a converted button one size off, and accepts only the listed height", async () => {
    const { diffs, accepted } = await mutant(
      "actionbtn",
      "ActionBtnCases",
      'size="lg"',
      'size="md"'
    )
    expect(diffs.length).toBeGreaterThan(0)
    expect(accepted.length).toBeGreaterThan(0)
  })
})
