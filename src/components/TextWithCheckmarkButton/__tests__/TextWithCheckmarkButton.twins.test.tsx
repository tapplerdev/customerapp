import { describe, expect, it, jest } from "@jest/globals"
import path from "path"
import React from "react"

/*
 * TextWithCheckmarkButton's twin path: every case its class-name test pinned
 * (__parity__/TextWithCheckmarkButton.parity.test.json), as the codemod
 * converted it at the freeze into a call site of its own
 * (__fixtures__/TextWithCheckmarkButton.twins.json), drawn against that
 * test's own trees. A site that moves to the twins draws what its class names
 * drew.
 *
 * The harvested site passes no class, so the hand cases (the classes a
 * caller could still pass) went through the codemod beside it.
 *
 * The twins are drawn from the frozen file: nothing here runs the codemod or
 * needs NativeWind.
 *
 *   DS_FREEZE_TWINS=1 jest <this file>   refreeze (W3.1 only: it runs the codemod)
 */

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)
jest.mock("assets/icons/check-mark.svg", () => {
  const { createElement } = jest.requireActual("react") as typeof React
  return {
    __esModule: true,
    default: (props: object) => createElement("svg:check-mark", props),
  }
})

/* eslint-disable import/first */
import { HAND_CASES } from "../__fixtures__/TextWithCheckmarkButton.handCases"
import {
  PARITY_MATRIX,
  captureMode,
  fixtureFileFor,
  hostTree,
  parityName,
} from "testing/hostTreeParity"
import {
  expectFrozenCover,
  expectTwin,
  frozenTwinCases,
  harvestFilesFor,
  readHarvest,
  twinsFileFor,
} from "testing/harvest"
/* eslint-enable import/first */

if (captureMode() !== "compare") {
  throw new Error(
    "The twins compare with the class-name test's trees; capture that test, never this one"
  )
}

const FIXTURE = fixtureFileFor(
  path.join(__dirname, "TextWithCheckmarkButton.parity.test.tsx")
)
const TWINS = twinsFileFor(__dirname, "TextWithCheckmarkButton")
const harvested = readHarvest(
  harvestFilesFor(__dirname, "TextWithCheckmarkButton")
)
const HAND = "hand"
const cases = {
  ...harvested,
  cases: {
    ...harvested.cases,
    ...Object.fromEntries(
      HAND_CASES.map(({ name, props }) => [
        name,
        { props: { ...props, onPress: { $fn: true as const } }, sites: [HAND] },
      ])
    ),
  },
}
const twins = frozenTwinCases(TWINS, cases, {
  source: "components/TextWithCheckmarkButton/TextWithCheckmarkButton",
  tag: "TextWithCheckmarkButton",
  omit: ["key"],
  build: { opaque: () => 0 },
})

/** What the codemod leaves at a site, by the sites, and why. */
const LEFT: { sites: string[]; left: { attr: string; reason: string }[] }[] = []

describe("TextWithCheckmarkButton's twins draw what its class names drew", () => {
  it("the codemod converts every class the cases pass, but those listed", () => {
    expect(
      twins
        .filter((twin) => twin.left.length)
        .map((twin) => ({ sites: twin.sites, left: twin.left }))
    ).toEqual(LEFT)
  })

  it("the hand cases' classes went to the style twin", () => {
    const converted = twins.filter((twin) => twin.sites[0] === HAND)
    expect(converted).toHaveLength(HAND_CASES.length)
    converted.forEach((twin) => {
      expect(twin.code).not.toContain("className=")
      expect(twin.code).toContain("style=")
    })
  })

  const table = twins.flatMap((twin) =>
    PARITY_MATRIX.map((env) => ({ ...twin, env }))
  )
  it("the twins are every case the class-name test pinned, but the drops", () => {
    expectFrozenCover(TWINS, FIXTURE, table)
  })
  it.each(table)(
    "$id ($sites.0) [$env.language $env.platform]",
    ({ id, element, env }) => {
      expectTwin(TWINS, id, parityName(id, env), hostTree(element, env), {
        file: FIXTURE,
      })
    }
  )
})
