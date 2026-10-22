import { describe, expect, it, jest } from "@jest/globals"
import path from "path"

/*
 * SkeletonLoader's twin path: every case its class-name test pins
 * (SkeletonLoader.parity.test.tsx), converted by the codemod as a call site
 * of its own (testing/harvest's twinCases), drawn against that test's own
 * trees. A site that moves to `style` draws what its className drew.
 *
 * No call site passes a class any more (the five at JobDetail drew nothing
 * and went in W1's prep), so the harvested cases hand the codemod nothing to
 * convert. The second block is the twin's proof where a class IS passed:
 * className and the style it stands for, drawn live against each other.
 */

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

/* eslint-disable import/first */
// The harvested class strings, compiled: a class the codemod leaves stays one.
import "../__fixtures__/SkeletonLoader.classes"
import { HAND_CASES } from "../__fixtures__/SkeletonLoader.handCases"
import {
  PARITY_MATRIX,
  captureMode,
  expectParity,
  fixtureFileFor,
  hostTree,
  parityName,
} from "testing/hostTreeParity"
import { harvestFilesFor, readHarvest, twinCases } from "testing/harvest"
/* eslint-enable import/first */

if (captureMode() !== "compare") {
  throw new Error(
    "The twins compare with the class-name test's trees; capture that test, never this one"
  )
}

const FIXTURE = fixtureFileFor(
  path.join(__dirname, "SkeletonLoader.parity.test.tsx")
)
const harvested = readHarvest(harvestFilesFor(__dirname, "SkeletonLoader"))
const HAND = "hand"
const cases = {
  ...harvested,
  cases: {
    ...harvested.cases,
    ...Object.fromEntries(
      HAND_CASES.map(({ name, props }) => [name, { props, sites: [HAND] }])
    ),
  },
}
const twins = twinCases(cases, {
  source: "components/SkeletonLoader/SkeletonLoader",
  tag: "SkeletonLoader",
})

/** What the codemod leaves at a site, by the sites, and why. */
const LEFT: { sites: string[]; left: { attr: string; reason: string }[] }[] = []

describe("SkeletonLoader's twins draw what its class names drew", () => {
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
  it.each(table)(
    "$id ($sites.0) [$env.language $env.platform]",
    ({ id, element, env }) => {
      expectParity(parityName(id, env), hostTree(element, env), {
        file: FIXTURE,
      })
    }
  )
})
