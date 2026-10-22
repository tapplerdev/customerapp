import { describe, expect, it, jest } from "@jest/globals"
import path from "path"
import React from "react"

/*
 * PromoLine's twin path: every case its class-name test pins
 * (PromoLine.parity.test.tsx), converted by the codemod as a call site of its
 * own (testing/harvest's twinCases), drawn against that test's own trees. A
 * site that moves to the twins draws what its class names drew.
 *
 * No harvested site passes a class (the two at ProCard:274 and
 * ProCardBase:219 drew nothing and went in W1's prep), so the hand cases (the
 * classes a caller could still pass, captured beside them) go through the
 * codemod too.
 */

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

/* eslint-disable import/first */
// The harvested class strings, compiled: a class the codemod leaves stays one.
import "../__fixtures__/PromoLine.classes"
import { HAND_CASES } from "../__fixtures__/PromoLine.handCases"
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
  path.join(__dirname, "PromoLine.parity.test.tsx")
)
const harvested = readHarvest(harvestFilesFor(__dirname, "PromoLine"))
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
  source: "components/PromoLine/PromoLine",
  tag: "PromoLine",
})

/** What the codemod leaves at a site, by the sites, and why. */
const LEFT: { sites: string[]; left: { attr: string; reason: string }[] }[] = []

describe("PromoLine's twins draw what its class names drew", () => {
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

describe("each hand class draws something", () => {
  it("its tree differs from the bare banner's", () => {
    const { default: PromoLine } = jest.requireActual(
      "../PromoLine"
    ) as typeof import("../PromoLine")
    const plain = JSON.stringify(
      hostTree(<PromoLine promoMessage="{promo}" />, { language: "en" })
    )
    HAND_CASES.forEach(({ name, props }) => {
      expect({
        name,
        same:
          JSON.stringify(
            hostTree(<PromoLine {...props} />, { language: "en" })
          ) === plain,
      }).toEqual({ name, same: false })
    })
  })
})
