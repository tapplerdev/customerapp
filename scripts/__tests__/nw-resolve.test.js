/**
 * scripts/nw-resolve.js against NativeWind itself.
 *
 * Two oracles, neither of which shares code with the resolver's composition:
 * - plain classNames go through scripts/__fixtures__/nw-runtime-oracle.js, a
 *   child process that compiles them with the real `nativewind/babel` plugin
 *   and reads the result back from the real StyleSheetRuntime;
 * - DmText sites are rendered through the real tappler-shared DmText.tsx,
 *   compiled here with the real babel.config.js, in en and ar.
 * The pinned cases below say in plain values what the oracles agree on.
 */
const fs = require("fs")
const os = require("os")
const path = require("path")
const { spawnSync } = require("child_process")
const React = require("react")
const TestRenderer = require("react-test-renderer")
const babel = require("@babel/core")
const parser = require("@babel/parser")
const traverse = require("@babel/traverse").default

const {
  resolve,
  resolveMany,
  resolveDmText,
  legacyTable,
  readLatinRegistry,
  NwResolveError,
  main,
  paths,
  DMTEXT_GUARD,
} = require("../nw-resolve")
const { CLASSNAME_ATTR } = require("../style-ratchet")

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

const { ROOT } = paths
const SHARED = path.join(ROOT, "..", "tappler-shared")
const ORACLE = path.join(
  __dirname,
  "..",
  "__fixtures__",
  "nw-runtime-oracle.js"
)

const runOracle = (classNames) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nw-resolve-test-"))
  const input = path.join(dir, "classNames.json")
  fs.writeFileSync(input, JSON.stringify(classNames))
  const out = spawnSync(process.execPath, [ORACLE, input], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  })
  fs.rmSync(dir, { recursive: true, force: true })
  if (out.status !== 0) throw new Error(`oracle failed:\n${out.stderr}`)
  return JSON.parse(out.stdout)
}

// Every string literal inside a className, className* or *ClassName
// attribute in the .tsx/.jsx files under `roots`: plain strings, clsx
// arguments, conditional branches, both kinds of slot prop. With how many
// files it read, so that finding no strings can be told from reading
// nothing.
const classNamesIn = (roots) => {
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      if (e.isDirectory())
        return e.name === "__tests__" ? [] : walk(path.join(dir, e.name))
      return /\.(tsx|jsx)$/.test(e.name) ? [path.join(dir, e.name)] : []
    })
  const found = new Set()
  const files = roots.flatMap(walk)
  for (const file of files) {
    const ast = parser.parse(fs.readFileSync(file, "utf8"), {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    })
    traverse(ast, {
      JSXAttribute(p) {
        const name = p.node.name.name
        if (typeof name !== "string" || !CLASSNAME_ATTR.test(name)) return
        if (p.node.value && p.node.value.type === "StringLiteral")
          found.add(p.node.value.value)
        p.traverse({
          StringLiteral(q) {
            found.add(q.node.value)
          },
          TemplateLiteral(q) {
            if (q.node.expressions.length === 0)
              found.add(q.node.quasis[0].value.cooked)
          },
        })
      },
    })
  }
  return { files: files.length, classNames: [...found] }
}
const APP_ROOTS = [path.join(ROOT, "src"), path.join(SHARED, "src")]

describe("nw-resolve against NativeWind's own Babel plugin and runtime", () => {
  it("finds every static class string in a file, and nothing else", () => {
    const { files, classNames } = classNamesIn([
      path.join(__dirname, "..", "__fixtures__", "nw-resolve"),
    ])
    expect(files).toBe(1)
    expect(classNames.sort()).toEqual(
      [
        "mt-[4] px-[8]",
        // clsx: each argument, an object key included
        "flex-row",
        "flex-row-reverse",
        "opacity-50",
        // both branches of a conditional
        "bg-red",
        "bg-grey4",
        // a template with nothing in it; `w-[${n}]` is not static
        "items-center",
        // *ClassName and className* slot props
        "p-[12]",
        "text-14",
      ].sort()
    )
  })

  // As the app converts, there are fewer strings each wave, down to none:
  // parity is on whatever is left. The walk itself is proven above, and
  // here it must have read both trees, so none found means none written.
  it("matches on every static className string in src and tappler-shared", () => {
    for (const root of APP_ROOTS) expect(fs.existsSync(root)).toBe(true)
    const { files, classNames } = classNamesIn(APP_ROOTS)
    expect(files).toBeGreaterThan(0)
    const oracle = classNames.length ? runOracle(classNames) : []
    const results = resolveMany(classNames)

    const mismatches = []
    const rejected = []
    results.forEach((r, i) => {
      if (r.error) rejected.push([r, oracle[i]])
      else if (JSON.stringify(r.style) !== JSON.stringify(oracle[i].style))
        mismatches.push({
          className: r.input,
          resolver: r.style,
          runtime: oracle[i].style,
        })
    })
    expect(mismatches).toEqual([])
    // Each rejection (gap/space child styles today) must be one the runtime
    // itself treats as more than one static style. No share of the total:
    // the codemod leaves exactly these behind, so they are a growing part
    // of a shrinking set.
    for (const [r, o] of rejected) {
      const runtimeSaysSo = o.mask !== 0 || o.childClassNames !== null
      const mediaOrUnits = r.error.problems.every((p) =>
        /^(media rule|unit )/.test(p.reason)
      )
      expect({
        className: r.input,
        flagged: runtimeSaysSo || mediaOrUnits,
      }).toEqual({ className: r.input, flagged: true })
    }
  })

  it("matches on the shapes that trip a naive merge", () => {
    const classNames = [
      // order-dependent pairs: the later class wins per key
      "pl-[10] px-[20]",
      "px-[20] pl-[10]",
      "mt-[4] my-[10] mb-[2]",
      "border-1 border-b-0 border-grey4",
      // transforms gather, in order, wherever they sit in the string
      "rotate-[180deg] scale-y-[-1] items-end",
      "scale-x-[-1] mt-[2] rotate-[90deg]",
      "translate-x-2 opacity-50",
      // whitespace and repeats
      "  flex-1   bg-white ",
      "flex-row\n  items-center\tjustify-between",
      "mt-[4] mt-[8] mt-[4]",
      // flex shorthands, sizes, colours with alpha
      "flex-1 flex-[2] grow-0 shrink",
      "w-full h-[47] min-h-[20] basis-1/2",
      "bg-red/5 text-[#123456] border-black/10",
      // DmText's guard leaking a line height into a size that has none
      "text-14 text-black text-left text-22",
      // drops mixed in change nothing else
      "pt-[33] flex-between leading-[20] inset-0 truncate rounded-[8] font-custom600",
    ]
    const oracle = runOracle(classNames)
    classNames.forEach((className, i) => {
      expect({ className, style: resolve(className).style }).toEqual({
        className,
        style: oracle[i].style,
      })
    })
  })
})

describe("what NativeWind gives, pinned", () => {
  it("flex-1 is grow 1 / shrink 1 / basis 0%, not React Native's flex: 1", () => {
    // `flex-1 bg-white`, the commonest screen root in the app.
    const { style } = resolve("flex-1 bg-white")
    expect(style).toEqual({
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: "0%",
      backgroundColor: "#FFFFFF",
    })
    expect(style).not.toHaveProperty("flex")
  })

  it("keeps both transforms, in class order, in one array appended last", () => {
    // SettingsItem.tsx:59 and SettingScreen.tsx:313, the RTL chevron flip.
    const { style, provenance } = resolve(
      "rotate-[180deg] scale-y-[-1] items-end"
    )
    expect(style).toEqual({
      alignItems: "flex-end",
      transform: [{ rotate: "180deg" }, { scaleY: -1 }],
    })
    expect(Object.keys(style)).toEqual(["alignItems", "transform"])
    expect(provenance.transform).toBe("rotate-[180deg] scale-y-[-1]")
  })

  it("emits physical keys, so an edge set before its axis loses", () => {
    expect(resolve("pl-[10] px-[20]").style).toEqual({
      paddingLeft: 20,
      paddingRight: 20,
    })
    expect(resolve("px-[20] pl-[10]").style).toEqual({
      paddingLeft: 10,
      paddingRight: 20,
    })
    expect(resolve("px-[20]").style).not.toHaveProperty("paddingHorizontal")
  })

  it("reports what NativeWind drops, with why, and keeps the rest exact", () => {
    // MyAccountDetailsScreen.tsx:252
    const details = resolve("px-[15] pt-[17] flex-between")
    expect(details.style).toEqual({
      paddingLeft: 15,
      paddingRight: 15,
      paddingTop: 17,
    })
    expect(details.dropped).toEqual([
      {
        class: "flex-between",
        reason: expect.stringMatching(/^unknown class/),
      },
    ])

    // MyAccountChangePasswordScreen.tsx:132, a clsx branch
    expect(resolve("text-grey10 font-400").dropped).toEqual([
      { class: "font-400", reason: expect.stringMatching(/^unknown class/) },
    ])

    // CreateFoodMenuOptionScreen.tsx:324: unitless leading, and the font
    // class is DmText's, not a drop
    const food = resolve("text-11 leading-[14] font-custom700")
    expect(food.style).toEqual({ fontSize: 11, lineHeight: 14 })
    expect(food.dropped).toEqual([
      { class: "leading-[14]", reason: expect.stringMatching(/^unitless/) },
    ])
    expect(food.consumed).toEqual([
      expect.objectContaining({ class: "font-custom700" }),
    ])

    // ServiceDetailSkeletonScreen.tsx:35: a bare arbitrary radius
    const skeleton = resolve("mx-[12] mb-[16] p-[12] bg-red/5 rounded-[8]")
    expect(skeleton.style).not.toHaveProperty("borderTopLeftRadius")
    expect(skeleton.dropped).toEqual([
      {
        class: "rounded-[8]",
        reason: expect.stringContaining('"border-radius: 8"'),
      },
    ])

    // rtl:/ltr: compile under a key no className can produce
    expect(resolve("ml-[4] rtl:ml-[3]").dropped).toEqual([
      { class: "rtl:ml-[3]", reason: expect.stringContaining(".rtl:ml-[3])") },
    ])
    expect(resolve("inset-0").dropped[0].reason).toContain('"inset: 0px"')
  })

  it("names the part of a class NativeWind throws away", () => {
    const { style, notes } = resolve("truncate")
    expect(style).toEqual({ overflow: "hidden" })
    expect(notes).toEqual([
      "truncate: NativeWind drops part of it: text-overflow: ellipsis (invalid property)",
      "truncate: NativeWind drops part of it: white-space: nowrap (invalid property)",
    ])
  })

  it.each([
    ["ios:pt-[4] mt-[2]", "ios:pt-[4]", /^masked \(ios\)/],
    ["dark:bg-black", "dark:bg-black", /^masked \(dark\)/],
    ["w-[50vw]", "w-[50vw]", /^unit width in vw/],
    ["h-screen", "h-screen", /^unit height in vh/],
    ["flex-row gap-[8]", "gap-[8]", /^styles its children/],
    ["space-y-4", "space-y-4", /^styles its children/],
    ["shadow bg-white", "shadow", /^media rule \(@media android \| @media ios/],
    // Object.prototype's own names: the runtime finds the prototype's
    // functions in its plain-object tables and throws at render.
    ["mt-[4] toString", "toString", /^a name Object.prototype already has/],
    ["constructor", "constructor", /^a name Object.prototype already has/],
    ["__proto__", "__proto__", /^a name Object.prototype already has/],
  ])("fails loudly on %s", (className, cls, reason) => {
    let error
    try {
      resolve(className)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(NwResolveError)
    expect(error.problems).toEqual([
      { class: cls, reason: expect.stringMatching(reason) },
    ])
  })

  it("is right that NativeWind's runtime can't take a prototype name", () => {
    expect(() => runOracle(["mt-[4] toString"])).toThrow(
      "TypeError: this.topics[className] is not iterable"
    )
  })
})

/*
 * The real DmText, as Metro builds it. Importing it through
 * @tappler/shared would be simpler, but jest resolves that to the package's
 * real path, and in a worktree whose ../tappler-shared is a symlink that
 * path is outside tailwind `content`, so NativeWind would not wrap its Text
 * and every style would be empty. Compiling it at the in-content path with
 * the real babel.config.js is the same transform Metro runs.
 */
const compileForJest = (filename, code, options) => {
  const out = babel.transformSync(code, {
    filename,
    babelrc: false,
    sourceType: "module",
    ...options,
  }).code
  const mod = { exports: {} }
  const localRequire = (request) =>
    // eslint-disable-next-line import/no-dynamic-require
    require(
      request.startsWith(".")
        ? path.resolve(path.dirname(filename), request)
        : request
    )
  // eslint-disable-next-line no-new-func
  new Function("exports", "require", "module", "__filename", "__dirname", out)(
    mod.exports,
    localRequire,
    mod,
    filename,
    path.dirname(filename)
  )
  return { exports: mod.exports, code: out }
}

const loadDmText = () => {
  const file = path.join(
    SHARED,
    "src",
    "components",
    "UI",
    "DmText",
    "DmText.tsx"
  )
  const { exports, code } = compileForJest(
    file,
    fs.readFileSync(file, "utf8"),
    {
      cwd: ROOT,
      root: ROOT,
      configFile: path.join(ROOT, "babel.config.js"),
      caller: { name: "metro", bundler: "metro", platform: "ios" },
    }
  )
  // Proof the transform under test happened: the Text is wrapped.
  expect(code).toContain("StyledComponent")
  return exports.default
}

// A call site's classes reach the runtime from the call site's own file
// (NativeWind v2 compiles each file's classes into that file). Do the same
// for the test strings: the real plugin over a file of elements carrying
// them, written as raw attribute strings like app source (Tailwind scans
// the text, so an escaped "\t" would hide the class after it).
const registerLikeACallSite = (classNames) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nw-resolve-callsite-"))
  const file = path.join(dir, "CallSite.tsx")
  fs.writeFileSync(
    file,
    `import { Text } from "react-native"\nexport const els = [\n${classNames
      .map((c) => `  <Text className="${c}" />,`)
      .join("\n")}\n]\n`
  )
  const configFile = path.join(dir, "tailwind.config.js")
  fs.writeFileSync(
    configFile,
    `module.exports = { ...require(${JSON.stringify(
      path.join(ROOT, "tailwind.config.js")
    )}), content: [${JSON.stringify(file)}] }\n`
  )
  compileForJest(file, fs.readFileSync(file, "utf8"), {
    cwd: dir,
    configFile: false,
    plugins: [
      [require.resolve("nativewind/babel"), { tailwindConfig: configFile }],
      [require.resolve("@babel/plugin-transform-typescript"), { isTSX: true }],
      [
        require.resolve("@babel/plugin-transform-react-jsx"),
        { runtime: "automatic" },
      ],
      require.resolve("@babel/plugin-transform-modules-commonjs"),
    ],
  })
  fs.rmSync(dir, { recursive: true, force: true })
}

describe("--dmtext against the real DmText", () => {
  // Real call sites (file:line on origin/dev), plus three shapes no site has.
  const SITES = [
    "text-13 leading-[22px] font-custom400", // MyAccountPhoneNumberScreen.tsx:89
    " text-11 leading-[22px] font-custom500 text-red", // :103, leading space
    "text-16 leading-[22px] font-custom600 text-black pb-[10]", // MyAccountDetailsScreen.tsx:253
    "text-22 leading-[29px] font-custom700", // AccountUpgradesViewMyProfileScreen.tsx:281
    "text-16 text-grey1", // MyAccountAddressScreen.tsx:269, no font class
    "text-12 leading-[16px] font-sans700 flex-1 text-right mt-[4]", // AccountUpgradesViewElemComponent.tsx:22
    "text-11 leading-[14] font-custom700", // CreateFoodMenuOptionScreen.tsx:324, unitless
    "text-16 leading-[20px] font-sans400 leading-[26.4px]", // BusinessModal.tsx:89 (en branch)
    "text-15 font-custom600 font-custom400", // two font classes: only the first is stripped
    "text-14 leading-[100px] font-custom500", // a 3-digit leading is never scaled
    "", // no className: DmText's default font-custom400
  ]
  let DmText
  let i18n
  let StyleSheet

  beforeAll(() => {
    i18n = require("locales/i18n").default
    StyleSheet = require("react-native").StyleSheet
    // proapp's Latin faces, as index.js registers them before the app runs.
    require(path.join(SHARED, "src", "helpers", "helpers")).setLatinFontWeights(
      readLatinRegistry().weights
    )
    registerLikeACallSite(SITES)
    DmText = loadDmText()
  })

  const renderHostStyle = (className) => {
    let renderer
    React.act(() => {
      renderer = TestRenderer.create(
        React.createElement(DmText, className === "" ? {} : { className }, "x")
      )
    })
    const [host] = renderer.root.findAll((n) => n.type === "Text")
    const style = StyleSheet.flatten(host.props.style)
    renderer.unmount()
    return style
  }

  it.each(["en", "ar"])(
    "matches the rendered style of every site in %s",
    (lang) => {
      React.act(() => {
        i18n.changeLanguage(lang)
      })
      for (const className of SITES) {
        const expected = renderHostStyle(className)
        const resolved = resolveDmText(
          className === "" ? undefined : className,
          {
            lang,
          }
        )
        expect({ className, style: resolved.style }).toEqual({
          className,
          style: expected,
        })
      }
    }
  )

  it("puts the family and the Arabic x1.32 on top, from takeFontStyles", () => {
    const site = "text-13 leading-[22px] font-custom400"
    const en = resolveDmText(site, { lang: "en" })
    expect(en.style).toEqual({
      fontSize: 13,
      lineHeight: 22,
      color: "#000000",
      textAlign: "left",
      fontFamily: "Poppins-Regular",
    })
    const ar = resolveDmText(site, { lang: "ar" })
    expect(ar.style).toEqual({
      ...en.style,
      lineHeight: 22 * 1.32,
      fontFamily: "TheSans-Plain",
    })
    expect(ar.layers.nativewind.lineHeight).toBe(22)
    expect(ar.provenance.lineHeight).toBe(
      "leading-[22px] x 1.32 (takeFontStyles, ar)"
    )
    expect(en.nativewindInput).toBe(
      "text-14 text-black text-left text-13 leading-[22px] font-"
    )
  })

  it("reports font classes as consumed, and a site without one as the system face", () => {
    const two = resolveDmText("text-15 font-custom600 font-custom400", {
      lang: "en",
    })
    expect(two.nativewindInput).toBe(
      "text-14 text-black text-left text-15 font- font-custom400"
    )
    expect(two.style.fontFamily).toBe("Poppins-Regular")
    expect(two.dropped).toEqual([])
    expect(two.consumed.map((c) => c.class)).toEqual([
      "font-custom600",
      "font-custom400",
    ])

    const system = resolveDmText("text-16 text-grey1", { lang: "en" })
    expect(system.style).not.toHaveProperty("fontFamily")
    expect(system.notes).toContain(
      "no font-customNNN: DmText sets no fontFamily, so this text is in the system face"
    )
  })

  it("restates DmText.tsx's guard, strip and default exactly", () => {
    // nw-resolve writes these three down rather than reading them, so a
    // change to DmText.tsx has to fail here first.
    const file = path.join(
      SHARED,
      "src",
      "components",
      "UI",
      "DmText",
      "DmText.tsx"
    )
    const ast = parser.parse(fs.readFileSync(file, "utf8"), {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    })
    const found = { guard: [], strip: [], fontDefault: [] }
    traverse(ast, {
      BinaryExpression(p) {
        const { left, right, operator } = p.node
        if (
          operator === "+" &&
          left.type === "StringLiteral" &&
          right.type === "Identifier"
        )
          found.guard.push(left.value)
      },
      CallExpression(p) {
        const { callee, arguments: args } = p.node
        if (
          callee.type === "MemberExpression" &&
          callee.property.name === "replace"
        )
          found.strip.push(
            args.map((a) =>
              a.type === "RegExpLiteral" ? `/${a.pattern}/${a.flags}` : a.value
            )
          )
        if (callee.type === "Identifier" && callee.name === "takeFontStyles")
          found.fontDefault.push(
            args[0].type === "LogicalExpression" &&
              args[0].right.type === "StringLiteral"
              ? args[0].right.value
              : null
          )
      },
    })
    expect(found.guard).toEqual([`${DMTEXT_GUARD.join(" ")} `])
    expect(found.strip).toEqual([["/custom(\\d{3})/", ""]])
    expect(found.fontDefault).toEqual(["font-custom400"])
  })

  it("reads proapp's Latin faces from index.js rather than restating them", () => {
    expect(readLatinRegistry()).toEqual({
      weights: {
        400: "Poppins-Regular",
        500: "Poppins-Medium",
        600: "Poppins-SemiBold",
        700: "Poppins-Bold",
      },
      source: expect.stringMatching(/^index\.js:\d+$/),
    })
  })

  it("generates the legacy line-height column, unscaled in Arabic", () => {
    const rows = Object.fromEntries(legacyTable().map((r) => [r.size, r]))
    // Revision 2 item 4: the rows the hand-written table was missing.
    expect(rows[13].lineHeight).toBe(22)
    expect(rows[22].lineHeight).toBe(22)
    expect(rows[30].lineHeight).toBe(22)
    expect(rows[48].lineHeight).toBe(57.6)
    expect(rows[14].lineHeight).toBe(22)
    expect(rows[16].lineHeight).toBe(19)
    expect(rows[22].from).toBe("text-14 (DmText guard)")
    for (const r of Object.values(rows))
      expect(r.lineHeightAr).toBe(r.lineHeight)
  })
})

describe("CLI", () => {
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

  it("prints the style with each key's class, and the drops", () => {
    const { code, out } = run(["pt-[33] flex-between"])
    expect(code).toBe(0)
    expect(out).toContain("  paddingTop: 33, // pt-[33]")
    expect(out).toContain("DROPPED:\n  flex-between: unknown class")
  })

  it("exits 1 when a class can't be one static style, 2 on bad usage", () => {
    expect(run(["flex-row gap-[8]"]).code).toBe(1)
    expect(run(["--dmtext", "--lang", "fr", "text-13"]).code).toBe(2)
    expect(run([]).code).toBe(2)
  })
})
