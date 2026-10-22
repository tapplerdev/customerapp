import { describe, expect, it, jest } from "@jest/globals"
import path from "path"

/*
 * AnimatedSelectCategory's twin path: every case its class-name test pins
 * (AnimatedSelectCategory.parity.test.tsx), converted by the codemod as a
 * call site of its own (testing/harvest's twinCases), drawn against that
 * test's own trees. A site that moves to `textStyle` and `textType`
 * draws what its textClassName drew.
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
// The harvested class strings, compiled: a class the codemod leaves stays one.
import "../__fixtures__/AnimatedSelectCategory.classes"
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

// The class-name test's values for what a site computes.
/** The menu's section titles, which FoodMenuScreen computes. */
const SECTION_TITLES = ["Main dishes", "Desserts", "Drinks", "Salads"]

const FIXTURE = fixtureFileFor(
  path.join(__dirname, "AnimatedSelectCategory.parity.test.tsx")
)
const cases = readHarvest(harvestFilesFor(__dirname, "AnimatedSelectCategory"))
const build = () =>
  twinCases(cases, {
    source: "components/AnimatedSelectCategory",
    tag: "AnimatedSelectCategory",
    build: { opaque: () => SECTION_TITLES },
  })
const twins = build()

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
  it.each(table)(
    "$name ($sites.0) [$env.language $env.platform]",
    ({ name, element, env }) => {
      expectParity(parityName(name, env), hostTree(element, env), {
        file: FIXTURE,
      })
    }
  )
})
