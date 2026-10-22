import { describe, expect, it, jest } from "@jest/globals"
import path from "path"
import React from "react"

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
import {
  PARITY_MATRIX,
  captureMode,
  expectParity,
  fixtureFileFor,
  hostTree,
  parityName,
} from "testing/hostTreeParity"
import { harvestFilesFor, readHarvest, twinCases } from "testing/harvest"
import SkeletonLoader from "../SkeletonLoader"
/* eslint-enable import/first */

if (captureMode() !== "compare") {
  throw new Error(
    "The twins compare with the class-name test's trees; capture that test, never this one"
  )
}

const FIXTURE = fixtureFileFor(
  path.join(__dirname, "SkeletonLoader.parity.test.tsx")
)
const cases = readHarvest(harvestFilesFor(__dirname, "SkeletonLoader"))
const twins = twinCases(cases, {
  source: "components/SkeletonLoader/SkeletonLoader",
  tag: "SkeletonLoader",
})

/** What the codemod leaves at a site, by the sites, and why. */
const LEFT: { sites: string[]; left: { attr: string; reason: string }[] }[] =
  []

describe("SkeletonLoader's twins draw what its class names drew", () => {
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

// The class strings a caller could still write, and the style each stands for.
const CLASSES: [string, React.ComponentProps<typeof SkeletonLoader>][] = [
  ["mt-[6]", { style: { marginTop: 6 } }],
  ["flex-1", { style: { flexGrow: 1, flexShrink: 1, flexBasis: "0%" } }],
  [
    "mx-[10] mb-[8]",
    { style: { marginLeft: 10, marginRight: 10, marginBottom: 8 } },
  ],
]

describe("className and its style twin draw alike", () => {
  const table = CLASSES.flatMap(([className, twin]) =>
    PARITY_MATRIX.map((env) => ({ className, twin, env }))
  )
  it.each(table)(
    "$className [$env.language $env.platform]",
    ({ className, twin, env }) => {
      const props = { width: 130, height: 16, borderRadius: 4 }
      expect(
        hostTree(<SkeletonLoader {...props} {...twin} />, env)
      ).toEqual(hostTree(<SkeletonLoader {...props} className={className} />, env))
    }
  )

  it("the wrapper draws something for each (the rows above prove something)", () => {
    const props = { width: 130, height: 16, borderRadius: 4 }
    const plain = hostTree(<SkeletonLoader {...props} />, { language: "en" })
    CLASSES.forEach(([className]) => {
      expect(
        hostTree(<SkeletonLoader {...props} className={className} />, {
          language: "en",
        })
      ).not.toEqual(plain)
    })
  })
})
