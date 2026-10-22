import { describe, expect, it, jest } from "@jest/globals"
import path from "path"

/*
 * BannerContainer's twin path: every case its class-name test pins
 * (BannerContainer.parity.test.tsx), converted by the codemod as a call site
 * of its own (testing/harvest's twinCases), drawn against that test's own
 * trees. A site that moves to `style` and `containerStyle` draws what its
 * className and containerClassName drew.
 */

/* eslint-disable global-require, @typescript-eslint/no-var-requires -- a
   jest.mock factory must require lazily: it is hoisted above every import. */
jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)
/* eslint-enable global-require, @typescript-eslint/no-var-requires */

/* eslint-disable import/first */
// The harvested class strings, compiled: a class the codemod leaves stays one.
import "../__fixtures__/BannerContainer.classes"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
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

/** The tags a site's element props name that draw themselves here (the rest are stand-ins). */
const ELEMENTS = {
  DmText: DmText as React.ComponentType<object>,
  DmView: DmView as React.ComponentType<object>,
}

const FIXTURE = fixtureFileFor(
  path.join(__dirname, "BannerContainer.parity.test.tsx")
)
const cases = readHarvest(harvestFilesFor(__dirname, "BannerContainer"))
const build = () =>
  twinCases(cases, {
    source: "components/BannerContainer/BannerContainer",
    tag: "BannerContainer",
    build: { elements: ELEMENTS },
  })
const twins = build()

/** What the codemod leaves at a site, by the sites, and why. */
const LEFT: { sites: string[]; left: { attr: string; reason: string }[] }[] = []

describe("BannerContainer's twins draw what its class names drew", () => {
  it("the codemod converts every class the cases pass, but those listed", () => {
    expect(
      twins
        .filter((twin) => twin.left.length)
        .map((twin) => ({ sites: twin.sites, left: twin.left }))
    ).toEqual(LEFT)
  })

  const table = twins.flatMap((twin) =>
    PARITY_MATRIX.map((env) => ({ ...twin, name: twin.id, env }))
  )
  it.each(table)(
    "$name ($sites.0) [$env.language $env.platform]",
    ({ name, element, env }) => {
      expectParity(parityName(name, env), hostTree(element, env), {
        file: FIXTURE,
      })
    }
  )
})
