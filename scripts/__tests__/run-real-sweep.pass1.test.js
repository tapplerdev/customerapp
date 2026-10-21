/**
 * run-real's --sweep verdict (scripts/ds-codemod/parity/sweep.js): a file it
 * can't even load is not a file that needs props. The sweep drew 98 files
 * with no props and filed every failure on both sides as "need props", 19
 * of them files that never loaded or hit a mock gap (RequestSummary,
 * ReviewForm, MessagesDetails, ProsListing...: review-ca-w0 M8). A load
 * failure and a file with nothing to draw are their own kinds now, and
 * either fails the run unless sweep-gaps.js lists it with its cause.
 */
const { sweepVerdict } = require("../ds-codemod/parity/sweep")

const tree = (text) => ({ type: "Text", props: {}, children: [text] })
const drew = (text) => ["en", "ar"].map((lang) => ({ lang, tree: tree(text) }))
const threw = (error) =>
  ["en", "ar"].map((lang) => ({ lang, kind: "render", error }))
const load = (error) => [{ kind: "load", error: `import: ${error}` }]
const diffTrees = (a, b) => ({
  diffs: JSON.stringify(a) === JSON.stringify(b) ? [] : [{ path: "root" }],
  accepted: [],
})

const PARSE =
  "Unexpected token 'export' (node_modules/react-native-drop-shadow/lib/module/index.js:3)"

const verdict = ({ files, before, after = before, gaps = [] }) =>
  sweepVerdict({
    files,
    before: { ios: before, android: before },
    after: { ios: after, android: after },
    gaps,
    diffTrees,
  })

describe("run-real's sweep verdict", () => {
  it("files a load failure as one, apart from a file that needs props, and fails on it", () => {
    const v = verdict({
      files: ["src/A.tsx", "src/B.tsx", "src/C.tsx"],
      before: {
        "src/A.tsx": drew("a"),
        "src/B.tsx": load(PARSE),
        "src/C.tsx": threw("TypeError: Cannot read properties of undefined"),
      },
    })
    expect(v).toMatchObject({ drawn: 4, equal: 4, needProps: 4, ok: false })
    expect(v.loadFailures).toEqual([
      { file: "src/B.tsx", platform: "ios", error: `import: ${PARSE}` },
      { file: "src/B.tsx", platform: "android", error: `import: ${PARSE}` },
    ])
  })

  it("lets a listed gap through with its cause, and fails on one that no longer happens", () => {
    const gaps = [
      {
        file: "src/B.tsx",
        kind: "load",
        match: /react-native-drop-shadow/,
        cause: "react-native-drop-shadow ships ESM",
      },
    ]
    const listed = verdict({
      files: ["src/B.tsx"],
      before: { "src/B.tsx": load(PARSE) },
      gaps,
    })
    expect(listed).toMatchObject({ ok: true, loadFailures: [], stale: [] })
    expect(listed.gaps).toEqual([
      {
        file: "src/B.tsx",
        kind: "load",
        cause: "react-native-drop-shadow ships ESM",
        platforms: ["ios", "android"],
      },
    ])
    // another cause in the same file is not the listed gap
    expect(
      verdict({
        files: ["src/B.tsx"],
        before: { "src/B.tsx": load("doesn't seem to be linked") },
        gaps,
      }).ok
    ).toBe(false)
    const stale = verdict({
      files: ["src/B.tsx"],
      before: { "src/B.tsx": drew("b") },
      gaps,
    })
    expect(stale).toMatchObject({ ok: false, stale: ["src/B.tsx"] })
  })

  it("lists a file with no component to draw apart too, and a render gap by its own cause", () => {
    const v = verdict({
      files: ["src/D.tsx", "src/E.tsx"],
      before: {
        "src/D.tsx": [{ kind: "export", error: "no component export" }],
        "src/E.tsx": threw(
          "TypeError: _reactNativeReanimated.FadeIn.duration(...).delay is not a function"
        ),
      },
      gaps: [
        {
          file: "src/E.tsx",
          kind: "render",
          match: /FadeIn\.duration\(\.\.\.\)\.delay/,
          cause: "the reanimated mock's FadeIn doesn't chain",
        },
      ],
    })
    expect(v).toMatchObject({ ok: false, needProps: 0 })
    expect(v.noComponent).toEqual(["src/D.tsx"])
    expect(v.gaps.map((g) => g.file)).toEqual(["src/E.tsx"])
  })

  // review-ca-w0, the T re-check's L6: a gap was matched on its before
  // error only, so a gap file that failed another way once converted passed.
  it("takes a listed gap only when the converted file fails the same way, and fails one that fails another way after", () => {
    const loadGap = {
      file: "src/B.tsx",
      kind: "load",
      match: /react-native-drop-shadow/,
      cause: "react-native-drop-shadow ships ESM",
    }
    const renderGap = {
      file: "src/E.tsx",
      kind: "render",
      match: /FadeIn\.duration\(\.\.\.\)\.delay/,
      cause: "the reanimated mock's FadeIn doesn't chain",
    }
    const FADE =
      "TypeError: _reactNativeReanimated.FadeIn.duration(...).delay is not a function"
    const same = verdict({
      files: ["src/B.tsx", "src/E.tsx"],
      before: { "src/B.tsx": load(PARSE), "src/E.tsx": threw(FADE) },
      gaps: [loadGap, renderGap],
    })
    expect(same).toMatchObject({ ok: true, problems: [], needProps: 0 })
    const other = verdict({
      files: ["src/B.tsx", "src/E.tsx"],
      before: { "src/B.tsx": load(PARSE), "src/E.tsx": threw(FADE) },
      after: {
        "src/B.tsx": load("RNCGeolocation doesn't seem to be linked"),
        "src/E.tsx": threw("TypeError: styles.button2 is undefined"),
      },
      gaps: [loadGap, renderGap],
    })
    expect(other).toMatchObject({ ok: false, needProps: 0, stale: [] })
    expect(
      other.problems.map((p) => [p.file, p.platform, p.lang, p.problem, p.after])
    ).toEqual([
      [
        "src/B.tsx",
        "ios",
        undefined,
        "a known gap before, another failure after",
        "import: RNCGeolocation doesn't seem to be linked",
      ],
      ...["en", "ar"].map((lang) => [
        "src/E.tsx",
        "ios",
        lang,
        "a known gap before, another failure after",
        "TypeError: styles.button2 is undefined",
      ]),
      [
        "src/B.tsx",
        "android",
        undefined,
        "a known gap before, another failure after",
        "import: RNCGeolocation doesn't seem to be linked",
      ],
      ...["en", "ar"].map((lang) => [
        "src/E.tsx",
        "android",
        lang,
        "a known gap before, another failure after",
        "TypeError: styles.button2 is undefined",
      ]),
    ])
  })

  it("fails a file that loads or draws on one side only, or has no result", () => {
    const v = verdict({
      files: ["src/F.tsx", "src/G.tsx", "src/H.tsx"],
      before: {
        "src/F.tsx": drew("f"),
        "src/G.tsx": drew("g"),
      },
      after: {
        "src/F.tsx": load(PARSE),
        "src/G.tsx": drew("g changed"),
      },
    })
    expect(v.ok).toBe(false)
    expect(
      v.problems.map((p) => [p.file, p.platform, p.problem || "diffs"])
    ).toEqual([
      ["src/F.tsx", "ios", "loads before, not after"],
      ["src/G.tsx", "ios", "diffs"],
      ["src/G.tsx", "ios", "diffs"],
      ["src/H.tsx", "ios", "no result"],
      ["src/F.tsx", "android", "loads before, not after"],
      ["src/G.tsx", "android", "diffs"],
      ["src/G.tsx", "android", "diffs"],
      ["src/H.tsx", "android", "no result"],
    ])
  })
})

describe("the sweep's known gaps (sweep-gaps.js)", () => {
  it("names each file that exists, what kind of gap it is, and why", () => {
    const fs = require("fs")
    const path = require("path")
    const { SWEEP_GAPS } = require("../ds-codemod/parity/sweep-gaps")
    const ROOT = path.resolve(__dirname, "..", "..")
    expect(SWEEP_GAPS.length).toBe(18)
    for (const gap of SWEEP_GAPS) {
      expect(fs.existsSync(path.join(ROOT, gap.file))).toBe(true)
      expect(["load", "export", "render"]).toContain(gap.kind)
      expect(gap.match).toBeInstanceOf(RegExp)
      expect(gap.cause).toMatch(/\w{4}/)
    }
  })
})
