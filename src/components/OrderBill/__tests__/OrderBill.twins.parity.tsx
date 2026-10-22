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
import {
  harvestFilesFor,
  readHarvest,
  twinCases,
  type CasesFile,
  type TwinCase,
} from "testing/harvest"

import { HAND_CASES, JOBS } from "../__fixtures__/OrderBill.handCases"

/*
 * OrderBill's twin path: every case its class-name test pins
 * (OrderBill.parity.tsx), converted by the codemod as a call site of its own
 * (testing/harvest's twinCases), drawn against that test's own trees. A site
 * that moves to the twins draws what its class names drew. The harvested site
 * passes no class, so the hand cases (the classes a caller could still pass)
 * go through the codemod beside it.
 *
 * The codemod runs inside each row's registry (the elements it builds have to
 * come from the registry that draws them), once per registry.
 */

if (captureMode() !== "compare") {
  throw new Error(
    "The twins compare with the class-name test's trees; capture that test, never this one"
  )
}

const FIXTURE = fixtureFileFor(path.join(__dirname, "OrderBill.parity.tsx"))
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
  const React = require("react") as typeof import("react")
  const harvest = require("testing/harvest") as typeof import("testing/harvest")
  const hand = require("../__fixtures__/OrderBill.handCases")
  const cache = ((globalThis as Record<string, unknown>).__orderBillTwins ??=
    {}) as { react?: unknown; twins?: TwinCase[] }
  if (cache.react !== React) {
    cache.react = React
    cache.twins = harvest.twinCases(casesOf(), {
      ...spec,
      build: {
        opaque: (key: string): unknown =>
          key in hand.JOBS ? hand.JOBS[key] : RTL_TEXT,
      },
    })
  }
  const twin = cache.twins?.find((candidate) => candidate.id === id)
  if (!twin) throw new Error(`no twin case ${id}`)
  return { default: () => twin.element }
}

describe("OrderBill's twins draw what its class names drew", () => {
  const twins = twinCases(casesOf(), spec)

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
  it.each(rows)("$id [$env.language $env.platform]", async (row) => {
    const tree = await renderScreen(twinLoader(row.id), {
      lang: row.env.language,
      platform: row.env.platform,
      navigation: "none",
    })
    expectParity(parityName(row.id, row.env), tree, { file: FIXTURE })
  })
})
