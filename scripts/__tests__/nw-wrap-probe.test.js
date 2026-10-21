/**
 * scripts/nw-wrap-probe.js on its fixtures, transformed by the real
 * babel.config.js as if they lived in src/:
 * - PositiveControl.jsx has the five ways a className consumer gets wrapped
 *   (two React Compiler temporaries, a file-path import, a same-file
 *   component that reads className, a className slot over DmText); every
 *   one must be a BUG.
 * - Clean.jsx has the same compiler shape on DmView, a wrapped
 *   SafeAreaView, and DmText/ActionBtn/MainModal through their barrels;
 *   nothing in it may be a BUG.
 * - Slots.jsx has tappler-shared's className slots over hosts that read
 *   style (ok), over a consumer (BUG) and over our own component (review),
 *   and slot look-alikes that must not pass as ok.
 *
 * Always through the CLI in a child process: inside jest, NativeWind's
 * block list resolves imports with jest's resolver (which finds .tsx), so
 * the file-path import would not be wrapped the way Metro wraps it. The
 * probe refuses to run in-process under jest for that reason.
 */
const path = require("path")
const { spawnSync } = require("child_process")

const {
  probeFile,
  CONTROL,
  CONTROL_EXPECT,
  VIRTUAL_DIR,
} = require("../nw-wrap-probe")

const PROBE = path.join(__dirname, "..", "nw-wrap-probe.js")
const ROOT = path.join(__dirname, "..", "..")
const CLEAN = path.join(path.dirname(CONTROL), "Clean.jsx")
const REASSIGNED = path.join(path.dirname(CONTROL), "Reassigned.jsx")
const SLOTS = path.join(path.dirname(CONTROL), "Slots.jsx")

// A plain node process, like Metro's workers: without jest's marker.
const { JEST_WORKER_ID, ...plainEnv } = process.env
const cli = (args) => {
  const out = spawnSync(process.execPath, [PROBE, ...args], {
    cwd: ROOT,
    env: plainEnv,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  return { code: out.status, stdout: out.stdout, stderr: out.stderr }
}
const probeJson = (file, as) => {
  const r = cli(["--json", ...(as ? ["--as", as] : []), file])
  return { code: r.code, ...JSON.parse(r.stdout) }
}
const summary = (w) => ({
  component: w.component,
  via: w.via,
  temp: w.temp,
  status: w.status,
})

describe("nw-wrap-probe", () => {
  it("flags every wrap in the positive control as a BUG, with how it got there", () => {
    const r = probeJson(CONTROL, path.join(VIRTUAL_DIR, "PositiveControl.jsx"))
    expect(r.code).toBe(1)
    expect(r.control).toEqual({ ok: true, wraps: expect.any(Array) })
    const [file] = r.files
    expect(file.error).toBeUndefined()
    expect(file.wraps.map(summary)).toEqual([
      // SettingsProfileHeader's shape, which compiles to T0/T1 for real
      { component: "MainModal", via: ["T1"], temp: true, status: "bug" },
      { component: "ActionBtn", via: ["T0"], temp: true, status: "bug" },
      // imported by file path, so NativeWind can't tell it's the barrel's
      { component: "DmTextByPath", via: [], temp: false, status: "bug" },
      // defined in the same file, and reads className
      { component: "Row", via: [], temp: false, status: "bug" },
      // a className slot (wrapped on purpose) over a consumer
      { component: "Title", via: [], temp: false, status: "bug" },
    ])
    expect(file.wraps.map((w) => w.key)).toEqual([
      "MainModal",
      "ActionBtn",
      "DmText",
      "Row",
      "Title",
    ])
    expect(file.wraps[4].host).toMatchObject({ kind: "import", key: "DmText" })
    expect(file.wraps.map((w) => w.component)).toEqual(
      CONTROL_EXPECT.map((e) => e.component)
    )
  })

  it("finds no BUG in the clean file, and keeps its temporaries visible", () => {
    const r = probeJson(CLEAN, path.join(VIRTUAL_DIR, "Clean.jsx"))
    expect(r.code).toBe(0)
    const [file] = r.files
    expect(file.error).toBeUndefined()
    expect(file.wraps.map(summary)).toEqual([
      { component: "DmView", via: ["T1"], temp: true, status: "ok" },
      { component: "DmView", via: ["T0"], temp: true, status: "ok" },
      { component: "SafeAreaView", via: [], temp: false, status: "ok" },
    ])
    expect(file.counts).toEqual({ wraps: 3, temps: 2, bug: 0, review: 0 })
    // DmText x3, ActionBtn and MainModal came through their barrels, so
    // NativeWind passed their className through untouched.
    expect(file.unwrapped).toBe(5)
  })

  it("follows every assignment of a tag, and the worst value wins", () => {
    const r = probeJson(REASSIGNED, path.join(VIRTUAL_DIR, "Reassigned.jsx"))
    expect(r.code).toBe(1)
    const verdicts = r.files[0].wraps.map((w) => [
      w.line,
      w.component,
      w.status,
    ])
    expect(verdicts).toEqual([
      // let Label = DmView; if (big) Label = DmText
      [19, "Label", "bug"],
      // let Label; if (big) Label = View; else Label = DmText
      [27, "Label", "bug"],
      // Label = pick(big): unreadable, so review, never ok
      [34, "t1", "review"],
      // View or Text, both react-native
      [41, "Label", "ok"],
      // a known consumer through a bare specifier
      [46, "ActionBtn", "bug"],
      // a bare specifier that resolves to nothing installed
      [50, "BareCard", "review"],
    ])
    const [later, branches] = r.files[0].wraps
    expect(later.options.map((o) => o.name)).toEqual(["DmView", "DmText"])
    expect(branches.options.map((o) => o.name)).toEqual(["View", "DmText"])
    expect(r.files[0].wraps[2].reason).toBe(
      "can't tell what t1 is: it's what pick() returns"
    )
  })

  it("passes tappler-shared's className slots as their host, and nothing that only looks like one", () => {
    const r = probeJson(SLOTS, path.join(VIRTUAL_DIR, "Slots.jsx"))
    expect(r.code).toBe(1)
    const [file] = r.files
    expect(file.error).toBeUndefined()
    expect(
      file.wraps.map((w) => [w.line, w.component, w.via, w.status])
    ).toEqual([
      // classNameSlot(DmView), (TextInput), lazyClassNameSlot(() => Animated.Text)
      [29, "Box", [], "ok"],
      [30, "Field", [], "ok"],
      [31, "Placeholder", [], "ok"],
      // const Label = ClassNameText, and ClassNameText itself, each given
      // the class string again as fontClassName
      [32, "ClassNameText", ["Label"], "ok"],
      [35, "ClassNameText", [], "ok"],
      // over DmText: the slot hands it style, so its font layer is lost
      [38, "Title", [], "bug"],
      // over our own component: as unknown as wrapping it directly
      [39, "Framed", [], "review"],
      // classNameSlot from a module that isn't tappler-shared's
      [40, "Imposter", [], "review"],
      // lazyClassNameSlot(() => pick()): no host to read
      [41, "Unreadable", [], "review"],
      // ClassNameText without fontClassName, and with another expression
      // there: a caller's font and Arabic leading draw nothing (S8)
      [44, "ClassNameText", ["Label"], "review"],
      [45, "ClassNameText", ["Label"], "review"],
      // a same-file function called classNameSlot
      [55, "Inner", [], "review"],
    ])
    const by = Object.fromEntries(file.wraps.map((w) => [w.line, w]))
    expect(by[29]).toMatchObject({
      kind: "slot",
      factory: "classNameSlot",
      fromSlots: true,
      host: { kind: "import", key: "DmView" },
    })
    expect(by[31].host).toMatchObject({
      name: "Animated.Text",
      thirdParty: true,
    })
    expect(by[40]).toMatchObject({
      kind: "slot",
      fromSlots: false,
      slotSource: "./classNameSlots",
    })
    expect(by[29].reason).toBe(
      "className slot over DmView, wrapped on purpose: DmView gets the component's base, then the caller's classes, as style; DmView forwards style"
    )
    expect(by[40].reason).toBe(
      "can't tell what Imposter is: it's what classNameSlot() from ./classNameSlots returns, and that isn't tappler-shared's components/classNameSlots"
    )
    expect(by[44].reason).toBe(
      "ClassNameText without fontClassName={the same classes as className}: a caller's font-customNNN and Arabic leading-[Npx] draw nothing"
    )
    expect(file.counts).toEqual({ wraps: 12, temps: 0, bug: 1, review: 6 })
  })

  it("reads the compiler's memo cache as the value stored in it", () => {
    // `let T0; if (miss) { T0 = ActionBtn; $[3] = T0 } else { T0 = $[3] }`:
    // the cache read must not turn the temporary into an unknown.
    const r = probeJson(CONTROL, path.join(VIRTUAL_DIR, "PositiveControl.jsx"))
    const [modal, btn] = r.files[0].wraps
    expect([modal.kind, modal.key, modal.via]).toEqual([
      "import",
      "MainModal",
      ["T1"],
    ])
    expect([btn.kind, btn.key, btn.via]).toEqual([
      "import",
      "ActionBtn",
      ["T0"],
    ])
  })

  it("sees nothing in a file outside tailwind content, and says so", () => {
    // The same control at its real path: NativeWind skips it entirely,
    // which is why every run probes it as if it were in src/ first.
    const r = probeJson(CONTROL)
    expect(r.code).toBe(0)
    expect(r.files[0].wraps).toEqual([])
    expect(r.files[0].note).toMatch(/^outside tailwind content/)
  })

  it("counts any extra --consumer as a BUG too", () => {
    const r = cli([
      "--json",
      "--consumer",
      "DmView",
      "--as",
      path.join(VIRTUAL_DIR, "Clean.jsx"),
      CLEAN,
    ])
    expect(r.code).toBe(1)
    expect(JSON.parse(r.stdout).files[0].counts.bug).toBe(2)
  })

  it("prints each wrap with its line, path and verdict", () => {
    const r = cli([
      "--as",
      path.join(VIRTUAL_DIR, "PositiveControl.jsx"),
      CONTROL,
    ])
    expect(r.stdout).toMatch(
      /BUG {4}:19 {2}<MainModal> via T1 \[compiler temporary\] {2}MainModal reads its className/
    )
    expect(r.stdout).toMatch(
      /BUG {4}:20 {2}<ActionBtn> via T0 \[compiler temporary\]/
    )
    expect(r.stdout).toMatch(
      /BUG {4}:55 {2}<Title> {2}className slot over DmText, which gets the caller's classes as style: DmText reads its className/
    )
    expect(r.stdout).toContain("positive control flagged (5 of 5)")
    expect(r.stdout).toContain("5 BUG, 0 to review")
  })

  it("refuses bad usage, and refuses to run inside jest", () => {
    expect(cli(["--as", "src/x.tsx", CLEAN, CONTROL]).code).toBe(2)
    expect(cli(["--platform", "web"]).code).toBe(2)
    expect(() => probeFile(CLEAN)).toThrow(/not inside jest/)
  })
})
