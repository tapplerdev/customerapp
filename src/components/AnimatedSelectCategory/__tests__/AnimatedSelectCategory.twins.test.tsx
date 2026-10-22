import { describe, expect, it, jest } from "@jest/globals"
import path from "path"

/*
 * AnimatedSelectCategory's twin path: every case its class-name test pinned
 * (__parity__/AnimatedSelectCategory.parity.test.json), as the codemod
 * converted it at the freeze into a call site of its own
 * (__fixtures__/AnimatedSelectCategory.twins.json), drawn against that
 * test's own trees. A site that moves to `textStyle` and `textType`
 * draws what its textClassName drew.
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
jest.mock("react-native-reanimated", () =>
  require("testing/screenKit/nativeMocks").reanimated()
)
// The scroll module exports AppFlashList too: FlashList ships ESM jest
// doesn't transform, and nothing here renders it.
jest.mock("@shopify/flash-list", () => ({ FlashList: "FlashList" }))
// The scroll module also exports AppKeyboardAwareScrollView: its library ships ESM jest
// doesn't transform, and nothing here renders it.
jest.mock("react-native-keyboard-aware-scroll-view", () => ({
  KeyboardAwareScrollView: "KeyboardAwareScrollView",
}))
/* eslint-enable global-require, @typescript-eslint/no-var-requires */

/* eslint-disable import/first */
import { HAND_CLASSED } from "../__fixtures__/AnimatedSelectCategory.hand"
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

// The class-name test's values for what a site computes.
/** The menu's section titles, which FoodMenuScreen computes. */
const SECTION_TITLES = ["Main dishes", "Desserts", "Drinks", "Salads"]

const FIXTURE = fixtureFileFor(
  path.join(__dirname, "AnimatedSelectCategory.parity.test.tsx")
)
const TWINS = twinsFileFor(__dirname, "AnimatedSelectCategory")
const harvested = readHarvest(
  harvestFilesFor(__dirname, "AnimatedSelectCategory")
)
/**
 * By hand: the one call site passes the default lines, so no harvested row
 * draws the tabs' own title type, or no lines (the class test's two).
 */
const HAND_OWN: typeof HAND_CLASSED = {
  "hand the tabs' own title type": {
    props: {
      categories: { $opaque: "sections" },
      setSelectedCategory: { $fn: true },
    },
    sites: ["by hand"],
  },
  "hand no lines": {
    props: {
      categories: { $opaque: "sections" },
      setSelectedCategory: { $fn: true },
      textClassName: "text-13 leading-[16px] font-custom500 text-center",
      showLines: false,
    },
    sites: ["by hand"],
  },
}
// The call site's cases, and the hand cases whose class sets a colour and a margin too.
const cases = {
  ...harvested,
  cases: { ...harvested.cases, ...HAND_OWN, ...HAND_CLASSED },
}
const twins = frozenTwinCases(TWINS, cases, {
  source: "components/AnimatedSelectCategory",
  tag: "AnimatedSelectCategory",
  build: { opaque: () => SECTION_TITLES },
})

/** What the codemod leaves at a site, by the sites, and why. */
const LEFT: { sites: string[]; left: { attr: string; reason: string }[] }[] = []

describe("AnimatedSelectCategory's twins draw what its class names drew", () => {
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
