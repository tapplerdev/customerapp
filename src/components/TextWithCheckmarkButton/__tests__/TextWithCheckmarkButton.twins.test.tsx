import { describe, expect, it, jest } from "@jest/globals"
import path from "path"
import React from "react"

/*
 * TextWithCheckmarkButton's twin path: every case its class-name test pins
 * (TextWithCheckmarkButton.parity.test.tsx), converted by the codemod as a
 * call site of its own (testing/harvest's twinCases), drawn against that
 * test's own trees. A site that moves to the twins draws what its class names
 * drew.
 *
 * The harvested site passes no class, so the hand cases (the classes a
 * caller could still pass) go through the codemod beside it.
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
// The harvested class strings and the hand cases', compiled: a class the
// codemod leaves stays one.
import "../__fixtures__/TextWithCheckmarkButton.classes"
import { HAND_CASES } from "../__fixtures__/TextWithCheckmarkButton.handCases"
import {
  PARITY_MATRIX,
  captureMode,
  expectParity,
  fixtureFileFor,
  hostTree,
  parityName,
} from "testing/hostTreeParity"
import { harvestFilesFor, readHarvest, twinCases } from "testing/harvest"
import TextWithCheckmarkButton from "../TextWithCheckmarkButton"
/* eslint-enable import/first */

if (captureMode() !== "compare") {
  throw new Error(
    "The twins compare with the class-name test's trees; capture that test, never this one"
  )
}

const FIXTURE = fixtureFileFor(
  path.join(__dirname, "TextWithCheckmarkButton.parity.test.tsx")
)
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
const twins = twinCases(cases, {
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
  it.each(table)(
    "$id ($sites.0) [$env.language $env.platform]",
    ({ id, element, env }) => {
      expectParity(parityName(id, env), hostTree(element, env), {
        file: FIXTURE,
      })
    }
  )

  it("each hand class draws something (the rows above prove something)", () => {
    const plain = hostTree(
      <TextWithCheckmarkButton
        label="Satin"
        isSelected={false}
        onPress={() => undefined}
      />,
      { language: "en" }
    )
    HAND_CASES.forEach(({ name, props }) => {
      const drawn = hostTree(
        <TextWithCheckmarkButton onPress={() => undefined} {...props} />,
        { language: "en" }
      )
      // Picked adds the check mark, so compare a picked hand case with a
      // picked plain one.
      const base = props.isSelected
        ? hostTree(
            <TextWithCheckmarkButton
              label="Satin"
              isSelected
              onPress={() => undefined}
            />,
            { language: "en" }
          )
        : plain
      expect({
        name,
        same: JSON.stringify(drawn) === JSON.stringify(base),
      }).toEqual({
        name,
        same: false,
      })
    })
  })
})
