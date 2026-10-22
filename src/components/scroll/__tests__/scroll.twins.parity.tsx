/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"
import path from "path"

import { renderScreen, rowsByPlatform } from "testing/screenKit"
import {
  PARITY_MATRIX,
  captureMode,
  expectParity,
  fixtureFileFor,
  parityName,
} from "testing/hostTreeParity"
import { twinCases, type TwinCase } from "testing/harvest"

import {
  OPAQUE,
  WRAPPERS,
  casesFor,
  type WrapperName,
} from "../__fixtures__/scrollSets"

/*
 * The scroll wrappers' twin path: every set their class-name test pins
 * (scroll.parity.tsx), converted by the codemod as a call site of its own
 * (testing/harvest's twinCases), drawn against that test's own trees. A site
 * that moves to `style` draws what its className drew.
 *
 * The codemod runs inside each row's registry (the elements it builds have to
 * come from the registry that draws them), once per registry and wrapper.
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

/** One wrapper's twins, built in the registry that draws them. */
const twinLoaderFor = (name: WrapperName, id: string) => () => {
  const React = require("react") as typeof import("react")
  const sets =
    require("../__fixtures__/scrollSets") as typeof import("../__fixtures__/scrollSets")
  const harvest = require("testing/harvest") as typeof import("testing/harvest")
  const cache = ((globalThis as Record<string, unknown>).__scrollTwins ??=
    {}) as Record<string, { react: unknown; twins: TwinCase[] }>
  if (cache[name]?.react !== React) {
    cache[name] = {
      react: React,
      twins: harvest.twinCases(sets.casesFor(name), spec(name)),
    }
  }
  const twin = cache[name].twins.find((candidate) => candidate.id === id)
  if (!twin) throw new Error(`no twin case ${id}`)
  return { default: () => twin.element }
}

describe.each(NAMES)("%s's twins draw what its class names drew", (name) => {
  it("the codemod converts every class the sets pass, but those listed", () => {
    const twins = twinCases(casesFor(name), spec(name))
    expect(
      twins
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
    expectParity(parityName(`${name}: ${row.set.id}`, row.env), tree, {
      file: FIXTURE,
    })
  })
})
