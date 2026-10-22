import { describe, expect, it, jest } from "@jest/globals"
import path from "path"

/*
 * ImageWithTextButton's twin path: every case its class-name test pinned
 * (__parity__/ImageWithTextButton.parity.test.json), as the codemod converted it at the
 * freeze into a call site of its own (__fixtures__/ImageWithTextButton.twins.json),
 * drawn against that test's own trees, with and without art. A site that
 * moves to `style` draws what its className drew.
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
jest.mock("react-native-mmkv", () =>
  require("testing/screenKit/nativeMocks").mmkv()
)
// The answer's art is fetched by SvgUriContainer: the network is shut here,
// as in the screen kit (the request never answers, so the art draws nothing).
global.fetch = jest.fn(() => new Promise<never>(() => undefined)) as never
/* eslint-enable global-require, @typescript-eslint/no-var-requires */

/* eslint-disable import/first */
import { HAND } from "../__fixtures__/ImageWithTextButton.hand"
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

/** The answer's art: an icon url, or none (the grey placeholder). */
let imageUrl = ""

const VARIANTS: Record<string, () => void> = {
  "with art": () => {
    imageUrl = "https://example.com/parity/answer.svg"
  },
  "no art": () => {
    imageUrl = ""
  },
}

const FIXTURE = fixtureFileFor(
  path.join(__dirname, "ImageWithTextButton.parity.test.tsx")
)
const TWINS = twinsFileFor(__dirname, "ImageWithTextButton")
const harvested = readHarvest(harvestFilesFor(__dirname, "ImageWithTextButton"))
// The call sites' cases, and the hand cases that do pass the answer's class.
const cases = { ...harvested, cases: { ...harvested.cases, ...HAND } }
const build = () =>
  frozenTwinCases(TWINS, cases, {
    source: "components/ImageWithTextButton/ImageWithTextButton",
    tag: "ImageWithTextButton",
    omit: ["key"],
    build: { opaque: () => imageUrl },
  })
const twins = build()

/** What the codemod leaves at a site, by the sites, and why. */
const LEFT: { sites: string[]; left: { attr: string; reason: string }[] }[] = []

describe("ImageWithTextButton's twins draw what its class names drew", () => {
  it("the codemod converts every class the cases pass, but those listed", () => {
    expect(
      twins
        .filter((twin) => twin.left.length)
        .map((twin) => ({ sites: twin.sites, left: twin.left }))
    ).toEqual(LEFT)
  })

  const table = // Built per variant: a case's values are read when the codemod's site is
    // built, so each variant converts and builds its own.
    Object.keys(VARIANTS).flatMap((variant) => {
      VARIANTS[variant]()
      return build().flatMap((twin) =>
        PARITY_MATRIX.map((env) => ({
          ...twin,
          name: `${twin.id} ${variant}`,
          variant,
          env,
        }))
      )
    })
  it("the twins are every case the class-name test pinned, but the drops", () => {
    expectFrozenCover(TWINS, FIXTURE, table)
  })
  it.each(table)(
    "$name ($sites.0) [$env.language $env.platform]",
    ({ id, name, element, env, variant }) => {
      VARIANTS[variant]()
      expectTwin(TWINS, id, parityName(name, env), hostTree(element, env), {
        file: FIXTURE,
      })
    }
  )
})
