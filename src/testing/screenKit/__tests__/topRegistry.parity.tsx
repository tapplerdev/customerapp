/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   what a module does when the test file itself loads it is the point. */
import { describe, expect, it } from "@jest/globals"

import { renderScreen } from "testing/screenKit"

/*
 * A module imported at the top of a *.parity.tsx loads in the test file's own
 * module registry, which is no row's: it is always LTR (and iOS, and jest's
 * window). A styles file that reads I18nManager.isRTL as it loads
 * (FoodCheckoutScreen/styles.ts:15) imported there kept its English branch in
 * every Arabic row, in the capture and the compare alike, so a mutant of the
 * Arabic branch passed (review, Low K). The kit's setup makes that registry's
 * I18nManager refuse to say its direction, naming the fix: load the module in
 * the loader or a step, in the row's registry.
 */

// Taken while this file loads, in its own registry, as a top-level import is.
const TOP_LEVEL = require("react-native").I18nManager as { isRTL: boolean }
let atTop: unknown
try {
  atTop = require("../__fixtures__/RtlAtImport")
} catch (error) {
  atTop = error
}

describe("the test file's own registry has no layout direction", () => {
  it("reading it throws, saying where to load the module instead", () => {
    expect(() => TOP_LEVEL.isRTL).toThrow(
      /imported at the top of a \*\.parity\.tsx[^]*inside the loader/
    )
  })

  it("a module that reads it as it loads can't be imported at the top", () => {
    expect(atTop).toBeInstanceOf(Error)
    expect(String(atTop)).toMatch(/I18nManager\.isRTL read in the test file's own registry/)
  })

  it("the same module in the loader draws the row's direction", async () => {
    const ar = await renderScreen(() => require("../__fixtures__/RtlAtImport"), {
      lang: "ar",
      navigation: "none",
    })
    expect(ar?.children).toEqual(["rtl rtl"])
  })
})
