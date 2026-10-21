/**
 * scripts/style-ratchet.js on fixture trees: a baseline is written from
 * __fixtures__/style-ratchet/before and the after/ tree is checked against
 * it. Each after/ file exercises one rule:
 *   Rises             className rose, and a DmText came: fails
 *   Converted         className 4 -> 1, px 0 -> 2, legacy and system 0 -> 1: passes
 *   BridgeWithoutFall px rose, className didn't fall: fails
 *   BareText          a bare <DmText> became <Text leading="legacy">: legacy
 *                     rose with no className to fall, but DmText fell: passes
 *   NewFile           a new file with a className: fails
 *   Colours           a colour literal added to a StyleSheet: fails
 *   Improved          className fell, nothing else: passes, listed as improved
 *   Deleted           (only in before/): passes
 *   myAccount/Strict  className fell with px/legacy added: passes the
 *                     ratchet, and is what --strict looks at
 */
const fs = require("fs")
const os = require("os")
const path = require("path")

const {
  countSource,
  scan,
  compare,
  toBaseline,
  formatReport,
  isColourLiteral,
  CLASSNAME_ATTR,
  DEFAULT_BASELINE,
  main,
} = require("../style-ratchet")

const FIXTURES = path.join(__dirname, "..", "__fixtures__", "style-ratchet")
const BEFORE = path.join(FIXTURES, "before")
const AFTER = path.join(FIXTURES, "after")

const run = (argv) => {
  const lines = []
  const log = jest
    .spyOn(console, "log")
    .mockImplementation((s) => lines.push(s))
  const error = jest
    .spyOn(console, "error")
    .mockImplementation((s) => lines.push(s))
  const code = main(argv)
  log.mockRestore()
  error.mockRestore()
  return { code, out: lines.join("\n") }
}

let tmp
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "style-ratchet-test-"))
})
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }))

const baselineFromBefore = () => {
  const file = path.join(tmp, "baseline.json")
  expect(run(["--update", "--root", BEFORE, "--baseline", file]).code).toBe(0)
  return file
}

describe("counting", () => {
  it("counts each metric from the AST, and only where it belongs", () => {
    const file = path.join(FIXTURES, "Counting.tsx")
    const { counts, occurrences } = countSource(
      fs.readFileSync(file, "utf8"),
      file
    )
    expect(counts).toEqual({
      className: 4, // className x2, textClassName, classNameTitle
      // px(3), theme.px(5), Text's { fixed: px(20) } and { legacy: px(27) },
      // Button's { legacy: px(14) }, the two *Types' { legacy } and { fixed }
      px: 7,
      // leading="legacy", leading={isAr ? "legacy" : undefined}, Text's
      // unscaled leading={{ fixed: px(20) }} and size-class
      // leading={{ legacy: px(27) }}, Button's labelLeading="legacy" and
      // labelLeading={{ legacy: px(14) }}, and in a *Type a { legacy }, a
      // "legacy" and a { fixed } (not a step)
      legacy: 9,
      // family="system", family={isAr ? "latin" : "system"}, and a *Type's
      familySystem: 3,
      colorLiteral: 5, // "#fff", rgba(), "white", "#000000", `#CC0000`
      primitives: 3, // the three <DmText> elements
      bridge: 0, // no <LegacyText> (style-ratchet-bridge has them)
    })
    expect(
      occurrences.filter((o) => o.metric === "className").map((o) => o.owner)
    ).toEqual(["DmView", "DmText", "DmText", "DmText"])
    // px() inside an element's attribute belongs to that element
    expect(
      occurrences.filter((o) => o.metric === "px").map((o) => o.owner)
    ).toEqual([
      "Text",
      "Text",
      "Text",
      "Text",
      "MainModal",
      "MainModal",
      "Button",
    ])
  })

  it("matches className and both slot forms", () => {
    for (const name of [
      "className",
      "classNameTitle",
      "classNameModal",
      "textClassName",
      "containerClassName",
    ])
      expect(CLASSNAME_ATTR.test(name)).toBe(true)
    for (const name of ["style", "class", "name", "classname"])
      expect(CLASSNAME_ATTR.test(name)).toBe(false)
  })

  it("knows a colour literal from a token name", () => {
    for (const s of [
      "#fff",
      "#FFFFFF",
      "#00000091",
      "rgba(0, 0, 0, 0.4)",
      "hsl(0, 0%, 0%)",
      "white",
      "Red",
    ])
      expect(isColourLiteral(s)).toBe(true)
    for (const s of ["transparent", "primary", "#ggg", "#12345", "grey2", ""])
      expect(isColourLiteral(s)).toBe(false)
  })
})

describe("the ratchet", () => {
  const check = () => {
    const baseline = JSON.parse(fs.readFileSync(baselineFromBefore(), "utf8"))
    return compare(baseline, scan({ root: AFTER, dirs: ["src"] }))
  }

  it("fails each rise the rules don't allow, file by file", () => {
    const { violations } = check()
    expect(violations.map((v) => [v.file, v.metric, v.from, v.to])).toEqual([
      ["src/components/Colours.tsx", "colorLiteral", 1, 2],
      ["src/screens/BridgeWithoutFall.tsx", "px", 0, 1],
      ["src/screens/NewFile.tsx", "className", 0, 1],
      ["src/screens/Rises.tsx", "className", 1, 2],
      ["src/screens/Rises.tsx", "primitives", 0, 1],
    ])
    expect(violations.find((v) => v.metric === "px").rule).toBe(
      "px() may rise only in a file whose className or DmText/ActionBtn count falls (className 2 -> 2, DmText/ActionBtn 1 -> 1)"
    )
  })

  it("lets a bridge rise where a bare DmText became a Text, and only there", () => {
    const { violations } = check()
    expect(violations.map((v) => v.file)).not.toContain(
      "src/screens/BareText.tsx"
    )
    // Rises.tsx gained a DmText: it may only fall, file by file
    expect(violations.filter((v) => v.metric === "primitives")).toEqual([
      {
        file: "src/screens/Rises.tsx",
        metric: "primitives",
        from: 0,
        to: 1,
        rule: "DmText/ActionBtn may only fall",
      },
    ])
  })

  it("lets px, legacy and system rise where className fell, and lists improvements", () => {
    const { violations, improved } = check()
    expect(violations.map((v) => v.file)).not.toContain(
      "src/screens/Converted.tsx"
    )
    expect(violations.map((v) => v.file)).not.toContain(
      "src/screens/myAccount/Strict.tsx"
    )
    expect(improved).toEqual([
      "src/screens/BareText.tsx",
      "src/screens/Converted.tsx",
      "src/screens/Deleted.tsx",
      "src/screens/Improved.tsx",
      "src/screens/myAccount/Strict.tsx",
    ])
  })

  it("adds files up per directory", () => {
    const { dirsChanged, totals } = check()
    expect(totals.from.className).toBe(17)
    expect(totals.to.className).toBe(9)
    const screens = dirsChanged.find((d) => d.dir === "src/screens")
    expect(screens.from).toEqual({
      className: 17,
      px: 0,
      legacy: 0,
      familySystem: 0,
      colorLiteral: 0,
      primitives: 7,
      bridge: 0,
    })
    expect(screens.to).toEqual({
      className: 9,
      px: 5,
      legacy: 3,
      familySystem: 1,
      colorLiteral: 0,
      primitives: 2,
      bridge: 0,
    })
  })

  it("prints a report a person can act on, and exits 1", () => {
    const file = baselineFromBefore()
    const { code, out } = run(["--root", AFTER, "--baseline", file])
    expect(code).toBe(1)
    expect(out).toContain("style-ratchet: FAIL (5 problems)")
    expect(out).toContain(
      "  src/screens/Rises.tsx\n    className 1 -> 2 (+1): className may only fall"
    )
    expect(out).toContain(
      "    DmText/ActionBtn 0 -> 1 (+1): DmText/ActionBtn may only fall"
    )
    expect(out).toContain(
      "  src/screens/NewFile.tsx\n    className 0 -> 1 (+1): className may only fall"
    )
    expect(out).toContain(
      "    colour literals 1 -> 2 (+1): colour literals may only fall; use a theme colour"
    )
    expect(out).toContain("  totals: className 17 -> 9 (-8), px() 0 -> 5 (+5)")
  })

  it("passes, and points at --update, when only good things happened", () => {
    const file = baselineFromBefore()
    // A copy of after/ without the four bad files.
    const root = path.join(tmp, "good")
    fs.cpSync(AFTER, root, { recursive: true })
    for (const f of [
      "components/Colours.tsx",
      "screens/BridgeWithoutFall.tsx",
      "screens/NewFile.tsx",
      "screens/Rises.tsx",
    ])
      fs.rmSync(path.join(root, "src", f))
    const { code, out } = run(["--root", root, "--baseline", file])
    expect(code).toBe(0)
    expect(out).toContain("style-ratchet: OK")
    expect(out).toContain(
      "files improved; run `yarn ds:ratchet --update` to lock it in"
    )
  })
})

describe("--strict", () => {
  const strictRun = (allow) => {
    const file = baselineFromBefore()
    return run([
      "--root",
      AFTER,
      "--baseline",
      file,
      "--strict",
      "src/screens/myAccount/**",
      ...(allow ? ["--allow", allow] : []),
    ])
  }

  it("wants className, px and legacy at 0, except on the allowed components", () => {
    const baseline = JSON.parse(fs.readFileSync(baselineFromBefore(), "utf8"))
    const result = scan({ root: AFTER, dirs: ["src"] })
    const strict = compare(baseline, result, {
      strict: ["src/screens/myAccount/**"],
      allow: ["MainModal"],
    }).strictViolations
    expect(strict.map((v) => [v.metric, v.line, v.owner])).toEqual([
      ["className", 12, "DmView"],
      ["legacy", 13, "Text"],
      ["px", 14, "View"],
    ])
    // Without the allow-list, MainModal's className and the px() in its
    // style count too.
    const all = compare(baseline, result, {
      strict: ["src/screens/myAccount/**"],
    }).strictViolations
    expect(all.map((v) => v.owner)).toEqual([
      "DmView",
      "Text",
      "View",
      "MainModal",
      "MainModal",
    ])
  })

  it("wants only className at 0 with --strict-metrics className", () => {
    const file = baselineFromBefore()
    const { code, out } = run([
      "--root",
      AFTER,
      "--baseline",
      file,
      "--strict",
      "src/screens/myAccount/**",
      "--strict-metrics",
      "className",
      "--allow",
      "MainModal",
    ])
    expect(code).toBe(1)
    expect(out).toContain(
      "  strict src/screens/myAccount/** [className] (1 file): 1 left (allowed on MainModal)"
    )
    expect(out).toContain(
      "    src/screens/myAccount/Strict.tsx:12  className on <DmView>"
    )
    expect(out).not.toContain('leading="legacy" on <Text>')
    expect(
      run(["--root", AFTER, "--baseline", file, "--strict-metrics", "rem"]).code
    ).toBe(2)
  })

  it("wants no DmText or ActionBtn left with --strict-metrics primitives", () => {
    // what a screen area gates on before W3: every <DmText>/<ActionBtn>
    // gone, as the ratchet counts them (with or without a className)
    const file = baselineFromBefore()
    const strict = (metrics, ...extra) =>
      run([
        "--root",
        AFTER,
        "--baseline",
        file,
        "--strict",
        "src/screens/Rises.tsx",
        "--strict-metrics",
        metrics,
        ...extra,
      ])
    const primitives = strict("primitives")
    expect(primitives.code).toBe(1)
    expect(primitives.out).toContain(
      "  strict src/screens/Rises.tsx [DmText/ActionBtn] (1 file): 1 left"
    )
    expect(primitives.out).toContain(
      "    src/screens/Rises.tsx:12  DmText/ActionBtn on <DmText>"
    )
    // the classes on it aren't asked for here, and are with className too
    expect(primitives.out).not.toContain("className on <DmView>")
    expect(strict("className,primitives").out).toContain(
      "  strict src/screens/Rises.tsx [className, DmText/ActionBtn] (1 file): 3 left"
    )
    // the same allow-list as every metric: by the element's name
    expect(strict("primitives", "--allow", "DmText").out).toContain(
      "  strict src/screens/Rises.tsx [DmText/ActionBtn] (1 file): clean (allowed on DmText)"
    )
    // a file with none left passes it
    expect(
      run([
        "--root",
        AFTER,
        "--baseline",
        file,
        "--strict",
        "src/screens/myAccount/**",
        "--strict-metrics",
        "primitives",
      ]).out
    ).toContain(
      "  strict src/screens/myAccount/** [DmText/ActionBtn] (1 file): clean"
    )
  })

  it("reports each occurrence with its line and component", () => {
    const { code, out } = strictRun("MainModal,DmInput")
    expect(code).toBe(1)
    expect(out).toContain(
      "  strict src/screens/myAccount/** (1 file): 3 left (allowed on MainModal, DmInput)"
    )
    expect(out).toContain(
      "    src/screens/myAccount/Strict.tsx:12  className on <DmView>"
    )
    expect(out).toContain(
      '    src/screens/myAccount/Strict.tsx:13  leading="legacy" on <Text>'
    )
    expect(out).toContain(
      "    src/screens/myAccount/Strict.tsx:14  px() on <View>"
    )
  })
})

describe("--update", () => {
  it("writes a sorted baseline whose directories add up", () => {
    const baseline = JSON.parse(fs.readFileSync(baselineFromBefore(), "utf8"))
    expect(baseline.scanned).toEqual(["src"])
    expect(Object.keys(baseline.files)).toEqual(
      [...Object.keys(baseline.files)].sort()
    )
    expect(baseline.files["src/screens/Converted.tsx"]).toEqual({
      className: 4,
      primitives: 1,
    })
    expect(baseline.directories.src).toEqual({
      className: 17,
      colorLiteral: 1,
      primitives: 7,
    })
    expect(baseline.totals).toEqual({
      className: 17,
      px: 0,
      legacy: 0,
      familySystem: 0,
      colorLiteral: 1,
      primitives: 7,
      bridge: 0,
    })
  })

  it("refuses while anything rose, unless the rise is accepted", () => {
    const file = baselineFromBefore()
    const before = fs.readFileSync(file, "utf8")
    const refused = run(["--update", "--root", AFTER, "--baseline", file])
    expect(refused.code).toBe(1)
    expect(refused.out).toContain("not updating while counts rose")
    expect(fs.readFileSync(file, "utf8")).toBe(before)

    expect(
      run(["--update", "--accept-rises", "--root", AFTER, "--baseline", file])
        .code
    ).toBe(0)
    expect(run(["--root", AFTER, "--baseline", file]).code).toBe(0)
  })

  it("is a no-op diff when nothing changed", () => {
    const file = baselineFromBefore()
    const first = fs.readFileSync(file, "utf8")
    expect(run(["--update", "--root", BEFORE, "--baseline", file]).code).toBe(0)
    expect(fs.readFileSync(file, "utf8")).toBe(first)
  })
})

describe("CLI", () => {
  it("checks just a subtree with --dir, and won't --update from one", () => {
    const file = baselineFromBefore()
    // src/components only: Colours rose; nothing under src/screens is read
    // as deleted (no improvements from there).
    const sub = run([
      "--root",
      AFTER,
      "--baseline",
      file,
      "--dir",
      "src/components",
      "--json",
    ])
    expect(sub.code).toBe(1)
    const cmp = JSON.parse(sub.out)
    expect(cmp.violations.map((v) => v.file)).toEqual([
      "src/components/Colours.tsx",
    ])
    expect(cmp.improved).toEqual([])
    expect(cmp.totals.from.className).toBe(0)

    const refused = run([
      "--update",
      "--root",
      BEFORE,
      "--baseline",
      file,
      "--dir",
      "src/screens",
    ])
    expect(refused.code).toBe(2)
    expect(refused.out).toContain("--update rewrites the whole baseline")
  })

  it("takes a ./-prefixed --strict glob, and survives a template literal with a bad escape", () => {
    const file = baselineFromBefore()
    const { out } = run([
      "--root",
      AFTER,
      "--baseline",
      file,
      "--strict",
      "./src/screens/myAccount/**",
    ])
    expect(out).toContain("strict ./src/screens/myAccount/** (1 file): 5 left")
    // String.raw-style bad escapes leave `cooked` null.
    expect(
      countSource("const s = { color: tag`\\unicode` }", "x.ts").counts
        .colorLiteral
    ).toBe(0)
  })

  it("exits 2 on a --strict glob that matches no file", () => {
    const file = baselineFromBefore()
    for (const glob of ["src/screens/myAccount", "src/screens/myAcount/**"]) {
      const { code, out } = run([
        "--root",
        AFTER,
        "--baseline",
        file,
        "--strict",
        glob,
      ])
      expect(code).toBe(2)
      expect(out).toContain(`--strict ${glob} matches no file under src`)
    }
  })

  it("treats an absolute or ./ --dir as the same directory", () => {
    const file = baselineFromBefore()
    const relative = JSON.parse(
      run([
        "--root",
        AFTER,
        "--baseline",
        file,
        "--dir",
        "src/components",
        "--json",
      ]).out
    )
    const absolute = JSON.parse(
      run([
        "--root",
        AFTER,
        "--baseline",
        file,
        "--dir",
        path.join(AFTER, "src", "components"),
        "--json",
      ]).out
    )
    expect(absolute).toEqual(relative)
    expect(absolute.violations.map((v) => v.file)).toEqual([
      "src/components/Colours.tsx",
    ])
    // and --update from ./src is the baseline's own "src", so it's allowed
    expect(
      run(["--update", "--root", BEFORE, "--baseline", file, "--dir", "./src"])
        .code
    ).toBe(0)
  })

  it("exits 2 without a baseline, on a file that doesn't parse, and on bad usage", () => {
    expect(
      run(["--root", BEFORE, "--baseline", path.join(tmp, "missing.json")]).code
    ).toBe(2)

    const root = path.join(tmp, "broken")
    fs.mkdirSync(path.join(root, "src"), { recursive: true })
    fs.writeFileSync(
      path.join(root, "src", "Broken.tsx"),
      "export const X = () => <View>\n"
    )
    const broken = run([
      "--update",
      "--root",
      root,
      "--baseline",
      path.join(tmp, "b.json"),
    ])
    expect(broken.code).toBe(2)
    expect(broken.out).toContain("src/Broken.tsx:")

    expect(run(["--strict"]).code).toBe(2)
    expect(run(["--nope"]).code).toBe(2)
  })

  it("ships a baseline whose directories and totals are the sums of its files", () => {
    const committed = JSON.parse(fs.readFileSync(DEFAULT_BASELINE, "utf8"))
    const rebuilt = toBaseline(
      {
        files: Object.fromEntries(
          Object.entries(committed.files).map(([f, counts]) => [f, { counts }])
        ),
      },
      committed.scanned
    )
    // the metrics it was written with; one added since counts nothing in it
    const listed = Object.fromEntries(
      committed.metrics.map((m) => [m, rebuilt.totals[m]])
    )
    expect(listed).toEqual(committed.totals)
    for (const m of Object.keys(rebuilt.totals))
      if (!committed.metrics.includes(m)) expect(rebuilt.totals[m]).toBe(0)
    expect(rebuilt.directories).toEqual(committed.directories)
  })

  it("holds for this tree: the committed baseline has no rise against src", () => {
    // So a className added anywhere in src fails `yarn test` as well as
    // `yarn ds:ratchet`. Falls pass; --update records them.
    const committed = JSON.parse(fs.readFileSync(DEFAULT_BASELINE, "utf8"))
    const cmp = compare(committed, scan({ dirs: committed.scanned }), {
      dirs: committed.scanned,
    })
    expect(cmp.violations).toEqual([])
    expect(formatReport(cmp)).toContain("style-ratchet: OK")
  })
})

describe("LegacyText (bridge): it may rise only where DmText/ActionBtn falls as much", () => {
  // __fixtures__/style-ratchet-bridge: a baseline from before/, after/
  // checked against it. `.jsx`, so the app's tsc (which takes every file
  // under the app) parses them without checking their import of LegacyText,
  // which tappler-shared doesn't export yet.
  // LegacyText is imported from its own folder,
  // @tappler/shared/src/components/LegacyText (a default export).
  //   Swapped    two DmText became two LegacyText: passes
  //   TooMany    one DmText became two LegacyText (a renamed default import,
  //              and `{ default as Legacy }` from the folder's file): fails
  //   Elsewhere  a className fell, the DmText stayed, a LegacyText came: fails
  //   Fresh      (after/ only) a new file with a LegacyText: fails
  const BRIDGE = path.join(FIXTURES, "..", "style-ratchet-bridge")
  const baseline = () => {
    const file = path.join(tmp, "bridge.json")
    expect(
      run(["--update", "--root", path.join(BRIDGE, "before"), "--baseline", file])
        .code
    ).toBe(0)
    return file
  }

  it("counts it under its name, a local alias, and the folder's default import", () => {
    const file = path.join(BRIDGE, "after", "src", "screens", "TooMany.jsx")
    const { counts, occurrences } = countSource(
      fs.readFileSync(file, "utf8"),
      file
    )
    expect(counts).toMatchObject({ bridge: 2, primitives: 0 })
    expect(
      occurrences.filter((o) => o.metric === "bridge").map((o) => o.owner)
    ).toEqual(["LegacyText", "LegacyText"])
  })

  it("follows every way a file can name it, from its home or a barrel", () => {
    const code = [
      'import React from "react"',
      'import A from "@tappler/shared/src/components/LegacyText"',
      'import { default as B } from "@tappler/shared/src/components/LegacyText"',
      'import C from "@tappler/shared/src/components/LegacyText/LegacyText"',
      'import { LegacyText as D } from "@tappler/shared/src/components/UI"',
      'import * as Home from "@tappler/shared/src/components/LegacyText"',
      'import Other from "./LegacyTextLookalike"',
      "const E = A",
      "const F = E",
      "export const X = () => (",
      "  <>",
      "    <A>a</A><B>b</B><C>c</C><D>d</D><Home.default>h</Home.default>",
      "    <E>e</E><F>f</F><LegacyText>by name</LegacyText>",
      "    <Other>not LegacyText</Other>",
      "  </>",
      ")",
    ].join("\n")
    const { counts, occurrences } = countSource(code, "Spellings.tsx")
    expect(counts.bridge).toBe(8)
    expect(
      new Set(
        occurrences.filter((o) => o.metric === "bridge").map((o) => o.owner)
      )
    ).toEqual(new Set(["LegacyText"]))
  })

  it("passes a DmText swapped for one, and fails a rise no DmText fall pays for", () => {
    const { code, out } = run([
      "--root",
      path.join(BRIDGE, "after"),
      "--baseline",
      baseline(),
    ])
    expect(code).toBe(1)
    expect(out).toContain("style-ratchet: FAIL (3 problems)")
    expect(out).not.toContain("src/screens/Swapped.jsx")
    // one DmText for two
    expect(out).toContain(
      "LegacyText 0 -> 2 (+2): LegacyText may rise only in a file whose DmText/ActionBtn count falls by at least as much (LegacyText 0 -> 2, DmText/ActionBtn 1 -> 0)"
    )
    // a className fell, no DmText did
    expect(out).toContain(
      "(LegacyText 0 -> 1, DmText/ActionBtn 1 -> 1)"
    )
    // a new file
    expect(out).toMatch(
      /src\/screens\/Fresh\.jsx\n\s+LegacyText 0 -> 1 \(\+1\)/
    )
  })

  it("is a --strict-metrics key like the others", () => {
    const { code, out } = run([
      "--root",
      path.join(BRIDGE, "after"),
      "--baseline",
      baseline(),
      "--strict",
      "src/screens/Swapped.jsx",
      "--strict-metrics",
      "bridge",
    ])
    expect(code).toBe(1)
    expect(out).toContain(
      "  strict src/screens/Swapped.jsx [LegacyText] (1 file): 2 left"
    )
    expect(out).toContain(
      "    src/screens/Swapped.jsx:7  LegacyText on <LegacyText>"
    )
  })
})

describe("DmText/ActionBtn (primitives): under any name, and only falling, file by file", () => {
  const UI = "@tappler/shared/src/components/UI"
  const dmTexts = (n, imp = `import { DmText, DmView } from "${UI}"`, tag = "DmText") =>
    `import React from "react"\n${imp}\nexport const X = () => (<DmView>${Array.from({ length: n }, (_, i) => `\n  <${tag}>t${i}</${tag}>`).join("")}\n</DmView>)\n`
  const legacyTexts = (n) =>
    `import React from "react"\nimport { DmView } from "${UI}"\nimport LegacyText from "@tappler/shared/src/components/LegacyText"\nexport const X = () => (<DmView>${Array.from({ length: n }, (_, i) => `\n  <LegacyText>t${i}</LegacyText>`).join("")}\n</DmView>)\n`
  const counted = (code) => countSource(code, "X.tsx")
  // files: { name: [before source or null, after source or null] }
  const ratchet = (files, options = {}) => {
    const baseline = { files: {} }
    const result = { files: {} }
    for (const [file, [before, after]] of Object.entries(files)) {
      if (before !== null) baseline.files[file] = counted(before).counts
      if (after !== null) result.files[file] = counted(after)
    }
    return compare(baseline, result, options)
  }

  it("counts them under a renamed import, their own module's default, and a namespace", () => {
    expect(
      counted(dmTexts(2, `import { DmText as Label, DmView } from "${UI}"`, "Label")).counts.primitives
    ).toBe(2)
    expect(
      counted(dmTexts(1, `import { DmView } from "${UI}"\nimport T from "${UI}/DmText"`, "T")).counts.primitives
    ).toBe(1)
    const ns = counted(
      `import React from "react"\nimport * as UI from "${UI}"\nexport const X = () => <UI.DmView><UI.ActionBtn title="a" /><UI.DmText>b</UI.DmText></UI.DmView>\n`
    )
    expect(ns.counts.primitives).toBe(2)
    expect(
      ns.occurrences.filter((o) => o.metric === "primitives").map((o) => o.owner)
    ).toEqual(["ActionBtn", "DmText"])
  })

  it("keeps an aliased DmText in the strict gate, and out of LegacyText's credit", () => {
    const aliased = dmTexts(1, `import { DmText as Label, DmView } from "${UI}"`, "Label")
    const strict = ratchet(
      { "src/A.tsx": [dmTexts(1), aliased] },
      { strict: ["src/**"], strictMetrics: ["className", "primitives"] }
    ).strictViolations
    expect(strict.map((v) => [v.metric, v.owner])).toEqual([["primitives", "DmText"]])
    // two DmText kept under another name don't pay for two LegacyText
    const swap = `import React from "react"\nimport { DmText as Label, DmView } from "${UI}"\nimport LegacyText from "@tappler/shared/src/components/LegacyText"\nexport const X = () => (<DmView><Label>a</Label><Label>b</Label><LegacyText>c</LegacyText><LegacyText>d</LegacyText></DmView>)\n`
    expect(
      ratchet({ "src/A.tsx": [dmTexts(2), swap] }).violations.map((v) => v.metric)
    ).toEqual(["bridge"])
  })

  it("fails a DmText moved into another file, or a new one, which can't pay for a LegacyText", () => {
    const moved = ratchet({
      "src/A.tsx": [dmTexts(2), legacyTexts(2)],
      "src/B.tsx": [dmTexts(0), dmTexts(2)],
    })
    expect(moved.violations.map((v) => [v.file, v.metric, v.from, v.to])).toEqual([
      ["src/B.tsx", "primitives", 0, 2],
    ])
    expect(moved.violations[0].rule).toBe("DmText/ActionBtn may only fall")
    const fresh = ratchet({
      "src/A.tsx": [dmTexts(2), legacyTexts(2)],
      "src/New.tsx": [null, dmTexts(2)],
    })
    expect(fresh.violations.map((v) => [v.file, v.metric])).toEqual([
      ["src/New.tsx", "primitives"],
    ])
    // a fall alone, or a swap in the same file, is fine
    expect(ratchet({ "src/A.tsx": [dmTexts(2), legacyTexts(2)] }).violations).toEqual([])
  })
})
