/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"
import path from "path"

import { renderScreen, rowsByPlatform } from "testing/screenKit"
import {
  PARITY_MATRIX,
  captureMode,
  fixtureFileFor,
  parityName,
} from "testing/hostTreeParity"
import {
  expectFrozenCover,
  expectTwin,
  frozenTwinCases,
  twinsFileFor,
  type CasesFile,
  type TwinCase,
} from "testing/harvest"

import {
  OPAQUE,
  WRAPPERS,
  casesFor,
  type WrapperName,
} from "../__fixtures__/scrollSets"

/*
 * The scroll wrappers' twin path: every set their class-name test pinned
 * (__parity__/scroll.parity.json), as the codemod converted it at the freeze
 * into a call site of its own (__fixtures__/scroll.twins.json, the three
 * wrappers' sets in one file), drawn against that test's own trees. A site that moves to
 * `style` draws what its className drew.
 *
 * Each row builds its frozen site inside its own registry (the elements it
 * builds have to come from the registry that draws them).
 *
 * The twins are drawn from the frozen files: nothing here runs the codemod or
 * needs NativeWind.
 *
 *   DS_FREEZE_TWINS=1 jest -c jest.parity.config.js <this file>   refreeze (W3.1 only: it runs the codemod)
 */

if (captureMode() !== "compare") {
  throw new Error(
    "The twins compare with the class-name test's trees; capture that test, never this one"
  )
}

const FIXTURE = fixtureFileFor(path.join(__dirname, "scroll.parity.tsx"))
const NAMES = Object.keys(WRAPPERS) as WrapperName[]

const spec = (name: WrapperName) => ({
  source: "components/scroll",
  tag: name,
  exportName: name,
  build: { opaque: OPAQUE },
})

/** What the codemod leaves at a site, by the sites, and why. */
const LEFT: Record<
  WrapperName,
  { sites: string[]; left: { attr: string; reason: string }[] }[]
> = { AppScrollView: [], AppFlatList: [], AppKeyboardAwareScrollView: [] }

/** One file holds the three wrappers' twins, each case named `<wrapper>: <set id>` as the class test names it. */
const TWINS = twinsFileFor(__dirname, "scroll")
const idOf = (name: WrapperName, id: string) => `${name}: ${id}`

/** A wrapper's sets with the ids the frozen file and the class test's trees use. */
const casesOf = (name: WrapperName): CasesFile => {
  const cases = casesFor(name)
  return {
    ...cases,
    cases: Object.fromEntries(
      Object.entries(cases.cases).map(([id, entry]) => [idOf(name, id), entry])
    ),
  }
}

/** One wrapper's twin, built in the registry that draws it. */
const twinLoaderFor = (name: WrapperName, id: string) => () => {
  const sets =
    require("../__fixtures__/scrollSets") as typeof import("../__fixtures__/scrollSets")
  const harvest = require("testing/harvest") as typeof import("testing/harvest")
  const frozenId = idOf(name, id)
  const element = harvest.frozenTwinElement(
    TWINS,
    frozenId,
    sets.casesFor(name).cases[id].props,
    spec(name)
  )
  return { default: () => element }
}

const TWINS_OF = Object.fromEntries(
  NAMES.map((name) => [name, frozenTwinCases(TWINS, casesOf(name), spec(name))])
) as Record<WrapperName, TwinCase[]>

describe.each(NAMES)("%s's twins draw what its class names drew", (name) => {
  it("the codemod converts every class the sets pass, but those listed", () => {
    expect(
      TWINS_OF[name]
        .filter((twin) => twin.left.length)
        .map((twin) => ({ sites: twin.sites, left: twin.left }))
    ).toEqual(LEFT[name])
  })

  const rows = rowsByPlatform(
    WRAPPERS[name].map((set) => ({ set })),
    PARITY_MATRIX
  )
  it.each(rows)("$set.id [$env.language $env.platform]", async (row) => {
    const tree = await renderScreen(twinLoaderFor(name, row.set.id), {
      lang: row.env.language,
      platform: row.env.platform,
      navigation: "none",
    })
    expectTwin(
      TWINS,
      idOf(name, row.set.id),
      parityName(idOf(name, row.set.id), row.env),
      tree,
      { file: FIXTURE }
    )
  })
})

describe("the scroll wrappers' twins as a whole", () => {
  it("the twins are every set the class-name test pinned, but the drops", () => {
    expectFrozenCover(
      TWINS,
      FIXTURE,
      NAMES.flatMap((name) =>
        WRAPPERS[name].flatMap((set) =>
          PARITY_MATRIX.map((env) => ({ id: idOf(name, set.id), env }))
        )
      )
    )
  })
})
