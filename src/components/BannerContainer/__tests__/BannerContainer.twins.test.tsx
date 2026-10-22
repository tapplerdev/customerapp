import { describe, expect, it, jest } from "@jest/globals"
import path from "path"

/*
 * BannerContainer's twin path: every case its class-name test pinned
 * (__parity__/BannerContainer.parity.test.json), as the codemod converted it
 * at the freeze into a call site of its own
 * (__fixtures__/BannerContainer.twins.json), drawn against that test's own
 * trees. A site that moves to `style` and `containerStyle` draws what its
 * className and containerClassName drew. The label the cases build as a
 * DmText went into the site as the JSX the codemod converted too.
 *
 * The twins are drawn from the frozen file: nothing here runs the codemod or
 * needs NativeWind.
 *
 *   DS_FREEZE_TWINS=1 jest <this file>   refreeze (W3.1 only: it runs the codemod)
 */

/* eslint-disable global-require, @typescript-eslint/no-var-requires -- a
   jest.mock factory must require lazily: it is hoisted above every import. */
jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)
/* eslint-enable global-require, @typescript-eslint/no-var-requires */

/* eslint-disable import/first */
import { HAND_CLASSED } from "../__fixtures__/BannerContainer.hand"
import { DmView } from "@tappler/shared/src/components/UI"
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

/** The tags a site's element props name that draw themselves here (the rest are stand-ins). */
const ELEMENTS = {
  DmView: DmView as React.ComponentType<object>,
}

const FIXTURE = fixtureFileFor(
  path.join(__dirname, "BannerContainer.parity.test.tsx")
)
const TWINS = twinsFileFor(__dirname, "BannerContainer")
const harvested = readHarvest(harvestFilesFor(__dirname, "BannerContainer"))
const label = { $el: "DmText", children: "x" } as const
/**
 * By hand: the one call site passes a box class and no block class, so no
 * harvested row draws the box's own 8pt padding (what a box class, even an
 * empty one, replaces). The class test drew these two with a real DmText.
 */
const HAND_PADDING: typeof HAND_CLASSED = {
  "hand no box class (the padded box)": {
    props: { bannerText: "Offers", children: label },
    sites: ["by hand"],
  },
  "hand an empty box class": {
    props: { bannerText: "Offers", containerClassName: "", children: label },
    sites: ["by hand"],
  },
}
// The call site's cases, and the hand cases that pass the block's class too.
const cases = {
  ...harvested,
  cases: { ...harvested.cases, ...HAND_CLASSED, ...HAND_PADDING },
}
const twins = frozenTwinCases(TWINS, cases, {
  source: "components/BannerContainer/BannerContainer",
  tag: "BannerContainer",
  build: { elements: ELEMENTS },
})

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
  it("the twins are every case the class-name test pinned, but the drops", () => {
    expectFrozenCover(TWINS, FIXTURE, table)
  })
  it.each(table)(
    "$name ($sites.0) [$env.language $env.platform]",
    ({ id, name, element, env }) => {
      expectTwin(TWINS, id, parityName(name, env), hostTree(element, env), {
        file: FIXTURE,
      })
    }
  )
})
