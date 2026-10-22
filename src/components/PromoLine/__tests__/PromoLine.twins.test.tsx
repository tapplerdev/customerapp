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
 * ProCardBase:219 drew nothing and went in W1's prep), so the second block is
 * the twin's proof where a class IS passed: className and the style it
 * stands for, drawn live against each other.
 */

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

/* eslint-disable import/first */
// The harvested class strings, compiled: a class the codemod leaves stays one.
import "../__fixtures__/PromoLine.classes"
import {
  PARITY_MATRIX,
  captureMode,
  expectParity,
  fixtureFileFor,
  hostTree,
  parityName,
} from "testing/hostTreeParity"
import { harvestFilesFor, readHarvest, twinCases } from "testing/harvest"
import PromoLine from "../PromoLine"
/* eslint-enable import/first */

if (captureMode() !== "compare") {
  throw new Error(
    "The twins compare with the class-name test's trees; capture that test, never this one"
  )
}

const FIXTURE = fixtureFileFor(
  path.join(__dirname, "PromoLine.parity.test.tsx")
)
const cases = readHarvest(harvestFilesFor(__dirname, "PromoLine"))
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

// The class strings a caller could still write, and the style each stands for
// (the same two the class-name test pins).
const CLASSES: [string, React.ComponentProps<typeof PromoLine>["style"]][] = [
  ["mt-[6]", { marginTop: 6 }],
  ["mx-[10] mb-[8]", { marginLeft: 10, marginRight: 10, marginBottom: 8 }],
]

describe("className and its style twin draw alike", () => {
  const table = CLASSES.flatMap(([className, style]) =>
    PARITY_MATRIX.map((env) => ({ className, style, env }))
  )
  it.each(table)(
    "$className [$env.language $env.platform]",
    ({ className, style, env }) => {
      expect(
        hostTree(<PromoLine promoMessage="x" style={style} />, env)
      ).toEqual(hostTree(<PromoLine promoMessage="x" className={className} />, env))
    }
  )

  it("each class draws something (the rows above prove something)", () => {
    const plain = hostTree(<PromoLine promoMessage="x" />, { language: "en" })
    CLASSES.forEach(([className]) => {
      expect(
        hostTree(<PromoLine promoMessage="x" className={className} />, {
          language: "en",
        })
      ).not.toEqual(plain)
    })
  })
})
