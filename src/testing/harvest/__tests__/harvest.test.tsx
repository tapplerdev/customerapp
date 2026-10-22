import { describe, expect, it, jest } from "@jest/globals"
import fs from "fs"
import os from "os"
import path from "path"
import React from "react"
import { Text } from "react-native"

import {
  buildProps,
  classStringsOf,
  classesIn,
  componentImport,
  expectFrozenCover,
  frozenTwinCases,
  harvestCallSites,
  harvestFilesFor,
  readHarvest,
  writeHarvest,
  type FrozenCase,
  type HarvestOptions,
  type HarvestedCase,
  type PropSet,
  type TwinSpec,
  type TwinsFile,
} from "testing/harvest"
import { hostTree, PARITY_MATRIX } from "testing/hostTreeParity"

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

/*
 * The component harvest harness, on call sites written for it
 * (scripts/__fixtures__/harvest/callsites and forwarding): what it reads off a
 * site, how one condition is shared across a site's props, what stops it,
 * and the files it freezes.
 */

// Outside src on purpose: the sites pass class names to a made-up component,
// which the wrap probe (src only) would list for review.
const FIXTURES = path.resolve(
  __dirname,
  "../../../../scripts/__fixtures__/harvest"
)

const OPTIONS: HarvestOptions = {
  srcRoot: path.join(FIXTURES, "callsites"),
  importFrom: /(^|\/)Widget$/,
  props: {
    title: "text",
    className: "class",
    disabled: "bool",
    variant: "value",
    icon: "node",
    item: "any",
    onPress: "fn",
  },
}

const casesOf = (options: HarvestOptions) =>
  Object.values(harvestCallSites(options).harvest.cases)

const sitesOf = (options: HarvestOptions) => harvestCallSites(options).sites

const withTitle = (sets: { props: PropSet }[], title: string) =>
  sets.filter((set) => set.props.title === title).map((set) => set.props)

describe("reading a call site", () => {
  const sets = casesOf(OPTIONS)

  it("takes literals as written", () => {
    expect(withTitle(sets, "Hello")).toEqual([
      { title: "Hello", className: "mt-[4]" },
    ])
  })

  it("shares a condition across the props that read it, so no impossible set is made", () => {
    expect(withTitle(sets, "t:save")).toEqual(
      expect.arrayContaining([
        {
          title: "t:save",
          disabled: true,
          className: "px-[16] opacity-50",
          onPress: { $fn: true },
        },
        {
          title: "t:save",
          disabled: false,
          className: "px-[16]",
          onPress: { $fn: true },
        },
      ])
    )
    expect(withTitle(sets, "t:save")).toHaveLength(2)
  })

  it("draws an element prop as its spec, and every branch of a ?:", () => {
    expect(withTitle(sets, "{name}")).toEqual(
      expect.arrayContaining([
        {
          title: "{name}",
          icon: { $el: "CloseIcon", props: { width: 16 } },
          variant: "dark",
        },
        {
          title: "{name}",
          icon: { $el: "CloseIcon", props: { width: 16 } },
          variant: "light",
        },
      ])
    )
  })

  it("reads children: text, t() keys and elements", () => {
    expect(withTitle(sets, "Children")).toEqual([
      {
        title: "Children",
        children: ["t:child_text", { $el: "Text", children: "inner" }],
      },
    ])
  })

  it("leaves an `any` prop it can't settle as a marker for the test", () => {
    expect(withTitle(sets, "Rows")).toEqual([
      { title: "Rows", item: { $opaque: "item" } },
    ])
  })

  it("lists each site with its conditions", () => {
    expect(
      sitesOf(OPTIONS).map(
        (site) => `${site.site} ${site.cases} ${site.conditions.join(",")}`
      )
    ).toEqual([
      "SiteA.tsx:25 1 ",
      "SiteA.tsx:26 2 isValid",
      "SiteA.tsx:32 2 isDark",
      "SiteA.tsx:37 1 ",
      "SiteA.tsx:41 1 ",
    ])
  })

  it("gives each set a stable id (its hash)", () => {
    const first = Object.keys(harvestCallSites(OPTIONS).harvest.cases)
    const again = Object.keys(harvestCallSites(OPTIONS).harvest.cases)
    expect(again).toEqual(first)
    expect(first.every((id) => /^[0-9a-f]{10}$/.test(id))).toBe(true)
  })

  it("finds a named import through a barrel, under its alias, and reads a constant's member", () => {
    const named = casesOf({
      ...OPTIONS,
      importFrom: /^\.$/,
      exportName: "Widget",
      constants: { HEADER: { className: "px-[20] pt-[10]" } },
    })
    expect(named.map((set) => set.props)).toEqual([
      { title: "Named", className: "px-[20] pt-[10]" },
    ])
  })

  it("finds the component under every name a file imports it by", () => {
    // FilterScreen draws FilterItem as FilterItem and as FilterModalItem
    const twice = { ...OPTIONS, srcRoot: path.join(FIXTURES, "twonames") }
    expect(sitesOf(twice).map((site) => site.site)).toEqual([
      "SiteD.tsx:14",
      "SiteD.tsx:15",
    ])
    expect(casesOf(twice).map((set) => set.props.title)).toEqual(
      expect.arrayContaining(["As Widget", "As Card"])
    )
    // the named export too, when the harvest is told it's the component
    expect(
      sitesOf({ ...twice, exportName: ["default", "Widget"] }).map(
        (site) => site.site
      )
    ).toEqual(["SiteD.tsx:14", "SiteD.tsx:15", "SiteD.tsx:16"])
  })
})

describe("customerapp's two ways of importing a component", () => {
  it("componentImport matches components/X and components/X/X, and nothing else", () => {
    const skeleton = componentImport("SkeletonLoader")
    expect(skeleton.test("components/SkeletonLoader")).toBe(true)
    expect(skeleton.test("components/SkeletonLoader/SkeletonLoader")).toBe(true)
    expect(skeleton.test("components/SkeletonLoaderRow")).toBe(false)
    expect(skeleton.test("components/SkeletonLoader/styles")).toBe(false)
    expect(skeleton.test("components/Other/SkeletonLoader")).toBe(false)
  })

  it("finds both in the app: every src/components import is one of the two", () => {
    const SRC = path.resolve(__dirname, "../../..")
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          return entry.name === "testing" ? [] : walk(full)
        }
        return /\.tsx?$/.test(entry.name) ? [full] : []
      })
    const specifiers = walk(SRC).flatMap((file) =>
      [...fs.readFileSync(file, "utf8").matchAll(/from "(components\/[^"]+)"/g)].map(
        (match) => match[1]
      )
    )
    expect(specifiers.length).toBeGreaterThan(100)
    const neither = specifiers.filter((specifier) => {
      const name = specifier.split("/")[1]
      return !componentImport(name).test(specifier)
    })
    // a folder's other files (scroll's index re-exports; styles) aren't components
    expect(neither.filter((s) => !/\/(styles|index|types?)$/.test(s))).toEqual([])
  })
})

describe("what stops a harvest", () => {
  it("a prop it wasn't told about", () => {
    const { disabled, ...props } = OPTIONS.props
    expect(disabled).toBe("bool")
    expect(() => harvestCallSites({ ...OPTIONS, props })).toThrow(
      /SiteA.tsx:26: a prop the harvest doesn't know \("disabled"\)/
    )
  })

  it("a class it can't settle, until a rewrite says what the callers pass", () => {
    const forwarding = {
      ...OPTIONS,
      srcRoot: path.join(FIXTURES, "forwarding"),
    }
    expect(() => harvestCallSites(forwarding)).toThrow(
      /SiteC.tsx:9: a class value it can't settle \(add a rewrite\): className/
    )
    const sets = casesOf({
      ...forwarding,
      rewrites: {
        "SiteC.tsx:9": {
          reason: "SiteC forwards its callers' class; they pass these two",
          values: { className: 'oneOf("mt-[1]", "mt-[2]")' },
        },
      },
    })
    expect(sets.map((set) => set.props.className).sort()).toEqual([
      "mt-[1]",
      "mt-[2]",
    ])
  })

  it("skips a site it is told to, and refuses a skip that matches nothing", () => {
    const forwarding = {
      ...OPTIONS,
      srcRoot: path.join(FIXTURES, "forwarding"),
    }
    expect(
      harvestCallSites({
        ...forwarding,
        skip: { "SiteC.tsx:9": "forwards its callers' class" },
      }).harvest.elements
    ).toBe(0)
    expect(() =>
      harvestCallSites({ ...OPTIONS, skip: { "SiteA.tsx:99": "moved" } })
    ).toThrow(/sites that aren't there \(moved\?\): SiteA.tsx:99/)
  })

  it("a rewrite for a site that isn't there, or for a value the site doesn't have", () => {
    expect(() =>
      harvestCallSites({
        ...OPTIONS,
        rewrites: { "SiteA.tsx:99": { reason: "moved", values: {} } },
      })
    ).toThrow(
      /rewrites or skips for sites that aren't there \(moved\?\): SiteA.tsx:99/
    )
    expect(() =>
      harvestCallSites({
        ...OPTIONS,
        rewrites: {
          "SiteA.tsx:25": { reason: "stale", values: { gone: '"x"' } },
        },
      })
    ).toThrow(/SiteA.tsx:25: rewrites that match nothing \(stale\?\): gone/)
  })
})

describe("the class strings and the frozen files", () => {
  it("collects every class string, in elements too", () => {
    const { harvest } = harvestCallSites(OPTIONS)
    expect(classStringsOf(harvest.cases)).toEqual([
      "mt-[4]",
      "px-[16]",
      "px-[16] opacity-50",
    ])
  })

  it("writes the cases (and no classes file), and reads them back", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harvest-"))
    const files = harvestFilesFor(path.join(dir, "__tests__"), "Widget")
    expect(files.cases).toBe(
      path.join(dir, "__fixtures__", "Widget.cases.json")
    )
    const { file } = writeHarvest(files, "Widget", OPTIONS, "abc1234")
    expect(readHarvest(files)).toEqual(file)
    expect(file.capturedAt).toBe("abc1234")
    expect(fs.readdirSync(path.join(dir, "__fixtures__"))).toEqual([
      "Widget.cases.json",
    ])
  })

  it("says how to make a missing cases file", () => {
    expect(() => readHarvest({ cases: "/nowhere/X.cases.json" })).toThrow(
      /harvest the call sites first \(DS_HARVEST=1/
    )
  })
})

describe("building props from a set", () => {
  it("makes handlers, elements (an SVG stand-in for an unknown tag), children and opaque values", () => {
    const props = buildProps(
      {
        title: "Hello",
        onPress: { $fn: true },
        icon: { $el: "CloseIcon", props: { width: 16 } },
        children: ["t:child_text", { $el: "Text", children: "inner" }],
        item: { $opaque: "item" },
      },
      { elements: { Text }, opaque: { item: { id: 3 } } }
    )
    expect(props.title).toBe("Hello")
    expect(typeof props.onPress).toBe("function")
    expect(React.isValidElement(props.icon)).toBe(true)
    expect((props.icon as React.ReactElement).props).toEqual({ width: 16 })
    expect(props.children[0]).toBe("t:child_text")
    expect((props.children[1] as React.ReactElement).type).toBe(Text)
    expect(props.item).toEqual({ id: 3 })
  })

  it("refuses an opaque value the test didn't give, or takes one from a function", () => {
    expect(() => buildProps({ item: { $opaque: "item" } })).toThrow(
      /no value for "item"/
    )
    expect(
      buildProps(
        { item: { $opaque: "item" } },
        { opaque: (source) => `<${source}>` }
      )
    ).toEqual({ item: "<item>" })
  })
})

describe("the class-free check (expectClassFree)", () => {
  const one = (props: PropSet): Record<string, HarvestedCase> => ({
    a: { props, sites: ["Site.tsx:1"] },
  })

  it("passes cases with no class string, and an empty one", () => {
    expect(
      classesIn({
        ...one({ title: "Hello", className: "" }),
        b: { props: { icon: { $el: "CloseIcon" } }, sites: ["Site.tsx:2"] },
      })
    ).toEqual([])
  })

  it("finds a class on the component, a *ClassName twin and NativeWind's tw", () => {
    expect(
      classesIn(
        one({ className: "mt-[4]", titleClassName: "text-16", tw: "px-[2]" })
      )
    ).toEqual([
      'a className: "mt-[4]"',
      'a titleClassName: "text-16"',
      'a tw: "px-[2]"',
    ])
  })

  it("finds one on an element, in its children too (where classStringsOf never looked)", () => {
    const nested = one({
      leading: {
        $el: "DmView",
        props: { className: "flex-row" },
        children: [{ $el: "SomeIcon", props: { className: "w-[18]" } }],
      },
    })
    expect(classesIn(nested)).toEqual([
      'a leading.className: "flex-row"',
      'a leading.children[0].className: "w-[18]"',
    ])
    expect(classStringsOf(nested)).toEqual(["flex-row"])
  })

  it("finds a DmText or an ActionBtn, with no class at all", () => {
    expect(
      classesIn(
        one({
          children: [{ $el: "DmText", children: "x" }, { $el: "ActionBtn" }],
        })
      )
    ).toEqual(["a children[0]: a <DmText>", "a children[1]: a <ActionBtn>"])
  })
})

/*
 * The frozen twins, on frozen files written here by hand: a site that draws
 * React Native's View with a literal and a value from `__twin_site__`. Each
 * test has a file of its own (the cover check reads what the test's case
 * sets fed, by file).
 */
describe("the frozen twins (frozenTwinCases, expectFrozenCover)", () => {
  const SPEC: TwinSpec = {
    source: "react-native",
    tag: "V",
    exportName: "View",
    build: { opaque: () => 42 },
  }
  const props: PropSet = { testID: "plain", hitSlop: { $opaque: "slop" } }
  const frozenCase: FrozenCase = {
    sites: ["Site.tsx:1"],
    props,
    code: [
      'import React from "react"',
      'import { View as V } from "react-native"',
      'import __twin from "__twin_site__"',
      "",
      'export default <V testID={"plain"} hitSlop={__twin.values[0]} />',
      "",
    ].join("\n"),
    styles: null,
    values: [{ $opaque: "slop" }],
    left: [],
  }
  const cases = { a: { props, sites: ["Site.tsx:1"] } }
  /** A fresh frozen file and a class fixture that captured case `a`. */
  const twin = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "twins-"))
    const file = path.join(dir, "Plain.twins.json")
    const fixture = path.join(dir, "Plain.parity.test.json")
    fs.writeFileSync(
      fixture,
      JSON.stringify({
        cases: Object.fromEntries(
          PARITY_MATRIX.map((env) => [
            `a [${env.language} ${env.platform}]`,
            {},
          ])
        ),
        trees: {},
      })
    )
    const write = (frozen: Partial<TwinsFile>) =>
      fs.writeFileSync(
        file,
        JSON.stringify({
          component: "Plain",
          codemod: "test",
          cases: { a: frozenCase },
          drops: {},
          ...frozen,
        })
      )
    return { file, fixture, write }
  }
  const rowsOf = (ids: string[]) =>
    ids.flatMap((id) => PARITY_MATRIX.map((env) => ({ id, env })))
  const DROP = {
    reason: "r",
    coveredBy: "src/testing/harvest/__tests__/harvest.test.tsx",
  }

  it("draws the frozen code, with its values built now", () => {
    const { file, write } = twin()
    write({})
    const [drawn] = frozenTwinCases(file, { cases }, SPEC)
    expect(drawn.code).toBe(frozenCase.code)
    expect(hostTree(drawn.element, PARITY_MATRIX[0])).toEqual({
      type: "View",
      props: { hitSlop: 42, testID: "plain" },
      children: [],
    })
  })

  it("refuses a case the file doesn't hold, or one that changed since the freeze", () => {
    const { file, write } = twin()
    write({ cases: {} })
    expect(() => frozenTwinCases(file, { cases }, SPEC)).toThrow(
      /a isn't in .*: refreeze/
    )
    write({})
    expect(() =>
      frozenTwinCases(
        file,
        { cases: { a: { props: { ...props, testID: "moved" }, sites: [] } } },
        SPEC
      )
    ).toThrow(/a isn't the case .* froze \(its props changed\)/)
  })

  it("refuses a drop the test and the file disagree on", () => {
    const { file, write } = twin()
    write({ cases: {}, drops: { a: { reason: "r", sites: ["(hand)"] } } })
    expect(() => frozenTwinCases(file, { cases }, SPEC)).toThrow(
      /a is dropped in .*, but the test says otherwise/
    )
    expect(
      frozenTwinCases(file, { cases }, { ...SPEC, drops: { a: DROP } })
    ).toEqual([])
  })

  it("cover: passes the rows that draw every captured case", () => {
    const { file, fixture, write } = twin()
    write({})
    frozenTwinCases(file, { cases }, SPEC)
    expectFrozenCover(file, fixture, rowsOf(["a"]))
  })

  it("cover, mutant: fails a frozen file that lost its cases, or rows that skip some", () => {
    const { file, fixture, write } = twin()
    write({})
    frozenTwinCases(file, { cases }, SPEC)
    expect(() =>
      expectFrozenCover(file, fixture, rowsOf(["a"]).slice(1))
    ).toThrow()
    write({ cases: {} })
    expect(() => expectFrozenCover(file, fixture, [])).toThrow()
  })

  it("cover: a drop takes its cases out, and needs a parity file for a real site", () => {
    const { file, fixture, write } = twin()
    write({ cases: {}, drops: { a: { ...DROP, sites: ["Site.tsx:1"] } } })
    frozenTwinCases(file, { cases }, { ...SPEC, drops: { a: DROP } })
    expectFrozenCover(file, fixture, [])
    write({
      cases: {},
      drops: {
        a: { reason: "r", sites: ["Site.tsx:1"], coveredBy: "nowhere.tsx" },
      },
    })
    expect(() => expectFrozenCover(file, fixture, [])).toThrow()
  })

  // F4 (review-w3-1.md): a stray drop record used to pass unnoticed.
  it("cover, mutant: fails a stray drop for a case the class test never captured", () => {
    const { file, fixture, write } = twin()
    write({ drops: { "0000000000": { ...DROP, sites: ["(by hand)"] } } })
    frozenTwinCases(file, { cases }, SPEC)
    expect(() => expectFrozenCover(file, fixture, rowsOf(["a"]))).toThrow(
      /0000000000: a drop the test doesn't declare[\s\S]*0000000000: drops 0000000000, which the class test never captured/
    )
  })

  it("cover, mutant: fails a drop that is also a kept case", () => {
    const { file, fixture, write } = twin()
    write({ drops: { a: { ...DROP, sites: ["Site.tsx:1"] } } })
    frozenTwinCases(file, { cases }, { ...SPEC, drops: { a: DROP } })
    expect(() => expectFrozenCover(file, fixture, [])).toThrow(
      /a: a drop that is also a kept case/
    )
  })

  it("cover, mutant: fails a drop the test declares for a case no set feeds", () => {
    const { file, fixture, write } = twin()
    write({ drops: { b: { ...DROP, sites: ["(by hand)"] } } })
    frozenTwinCases(file, { cases }, { ...SPEC, drops: { b: DROP } })
    expect(() => expectFrozenCover(file, fixture, rowsOf(["a"]))).toThrow(
      /b: a drop for a case no set feeds/
    )
  })
})
