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
  harvestFilesFor,
  readHarvest,
  twinsFileFor,
  type CasesFile,
} from "testing/harvest"

import { HAND_CASES, JOBS } from "../__fixtures__/OrderBill.handCases"

/*
 * OrderBill's twin path: every case its class-name test pinned
 * (__parity__/OrderBill.parity.json), as the codemod converted it at the
 * freeze into a call site of its own (__fixtures__/OrderBill.twins.json),
 * drawn against that test's own trees. A site that moves to the twins draws
 * what its class names drew. The harvested site passes no class, so the hand
 * cases (the classes a caller could still pass) went through the codemod
 * beside it.
 *
 * Each row builds its frozen site inside its own registry (the elements it
 * builds have to come from the registry that draws them).
 *
 * The twins are drawn from the frozen file: nothing here runs the codemod or
 * needs NativeWind.
 *
 *   DS_FREEZE_TWINS=1 jest -c jest.parity.config.js <this file>   refreeze (W3.1 only: it runs the codemod)
 */

if (captureMode() !== "compare") {
  throw new Error(
    "The twins compare with the class-name test's trees; capture that test, never this one"
  )
}

const FIXTURE = fixtureFileFor(path.join(__dirname, "OrderBill.parity.tsx"))
const TWINS = twinsFileFor(__dirname, "OrderBill")
const RTL_TEXT = { textAlign: "left" }

/** The class-name test's cases: the harvested sets over each bill, and the hand cases. */
const casesOf = (): CasesFile => {
  const harvested = readHarvest(harvestFilesFor(__dirname, "OrderBill"))
  const cases: CasesFile["cases"] = {}
  Object.entries(harvested.cases).forEach(([id, entry]) =>
    Object.keys(JOBS).forEach((job) => {
      cases[`${id} ${job}`] = {
        props: { ...entry.props, job: { $opaque: job } },
        sites: entry.sites,
      }
    })
  )
  HAND_CASES.forEach(({ name, props }) => {
    cases[name] = {
      props: { ...props, job: { $opaque: props.job } },
      sites: ["hand"],
    }
  })
  return { ...harvested, cases }
}

const CASES = casesOf()

const spec = {
  source: "components/OrderBill/OrderBill",
  tag: "OrderBill",
  build: {
    opaque: (key: string): unknown => (key in JOBS ? JOBS[key] : RTL_TEXT),
  },
}

/** What the codemod leaves at a site, by the sites, and why. */
const LEFT: { sites: string[]; left: { attr: string; reason: string }[] }[] = []

const twinLoader = (id: string) => () => {
  const harvest = require("testing/harvest") as typeof import("testing/harvest")
  const hand = require("../__fixtures__/OrderBill.handCases")
  const element = harvest.frozenTwinElement(TWINS, id, CASES.cases[id].props, {
    ...spec,
    build: {
      opaque: (key: string): unknown =>
        key in hand.JOBS ? hand.JOBS[key] : RTL_TEXT,
    },
  })
  return { default: () => element }
}

describe("OrderBill's twins draw what its class names drew", () => {
  const twins = frozenTwinCases(TWINS, CASES, spec)

  it("the codemod converts every class the cases pass, but those listed", () => {
    expect(
      twins
        .filter((twin) => twin.left.length)
        .map((twin) => ({ sites: twin.sites, left: twin.left }))
    ).toEqual(LEFT)
  })

  it("the hand cases' classes went to the style twin", () => {
    const converted = twins.filter((twin) => twin.sites[0] === "hand")
    expect(converted).toHaveLength(HAND_CASES.length)
    converted.forEach((twin) => {
      expect(twin.code).not.toContain("className=")
      expect(twin.code).toContain("style=")
    })
  })

  const rows = rowsByPlatform(
    twins.map((twin) => ({ id: twin.id })),
    PARITY_MATRIX
  )
  it("the twins are every case the class-name test pinned, but the drops", () => {
    expectFrozenCover(TWINS, FIXTURE, rows)
  })
  it.each(rows)("$id [$env.language $env.platform]", async (row) => {
    const tree = await renderScreen(twinLoader(row.id), {
      lang: row.env.language,
      platform: row.env.platform,
      navigation: "none",
    })
    expectTwin(TWINS, row.id, parityName(row.id, row.env), tree, {
      file: FIXTURE,
    })
  })
})
