import { describe, expect, it, jest } from "@jest/globals"
import fs from "fs"
import os from "os"
import path from "path"
import React from "react"
import { Text } from "react-native"

import {
  buildProps,
  classStringsOf,
  harvestCallSites,
  harvestFilesFor,
  readHarvest,
  unlistedClasses,
  writeHarvest,
  type CasesFile,
  type HarvestOptions,
  type PropSet,
} from "testing/harvest"
import { describeCompiledClasses } from "testing/harvest/compiledClasses"

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

  it("writes the cases and a .tsx listing their classes, and reads them back", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harvest-"))
    const files = harvestFilesFor(path.join(dir, "__tests__"), "Widget")
    expect(files.cases).toBe(
      path.join(dir, "__fixtures__", "Widget.cases.json")
    )
    const { file, classes } = writeHarvest(files, "Widget", OPTIONS, "abc1234")
    expect(readHarvest(files)).toEqual(file)
    expect(file.capturedAt).toBe("abc1234")
    expect(classes).toHaveLength(3)
    expect(unlistedClasses(files, file)).toEqual([])
    fs.writeFileSync(files.classes, "export const HARVESTED_CLASSES = []\n")
    expect(unlistedClasses(files, file)).toEqual(classes)
  })

  it("says how to make a missing cases file", () => {
    expect(() =>
      readHarvest({ cases: "/nowhere/X.cases.json", classes: "" })
    ).toThrow(/harvest the call sites first \(DS_HARVEST=1/)
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

describe("the compiled-class check", () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const { uncompiledTokens, classTokens } = require("../compiledClasses") as {
    uncompiledTokens: (classStrings: readonly string[]) => string[]
    classTokens: (classStrings: readonly string[]) => string[]
  }

  it("passes a class some .tsx in this run spells out (this file: mt-[4] px-[16])", () => {
    expect(uncompiledTokens(["mt-[4]", "px-[16]"])).toEqual([])
  })

  it("mutant: catches a class no .tsx spells out, which NativeWind never compiled", () => {
    // Built at run time, so no file's text holds the whole class.
    const uncompiled = `mt-[${[7, 7, 7].join("")}]`
    expect(uncompiledTokens(["mt-[4]", uncompiled])).toEqual([uncompiled])
  })

  it("splits class strings into their tokens, once each", () => {
    expect(classTokens(["px-[16] opacity-50", "px-[16]", " mt-[4] "])).toEqual([
      "mt-[4]",
      "opacity-50",
      "px-[16]",
    ])
  })
})

describe("a harvest whose cases pass no class string", () => {
  // A component no call site hands a class. describeCompiledClasses still
  // declares the control and the list, and no token table: jest throws on an
  // empty `it.each` while it collects the file, which would fail it whole.
  const cases: CasesFile = {
    component: "Plain",
    capturedAt: "test",
    elements: 1,
    files: 1,
    cases: { "0123456789": { props: { title: "Hello" }, sites: ["Site.tsx:1"] } },
  }
  const classes = classStringsOf(cases.cases)

  it("has no class string to check", () => {
    expect(classes).toEqual([])
  })

  describeCompiledClasses(
    cases,
    harvestFilesFor(path.join(os.tmpdir(), "no-classes", "__tests__"), "Plain"),
    classes
  )
})
