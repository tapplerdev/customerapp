/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import { openScreen, pressText } from "testing/screenKit"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * AnimatedSelectCategory's tabs (the food menu's sections): a press on a
 * tab hands setSelectedCategory that tab's index, once, whichever tab it is
 * and whatever came before. (A handler swapped for one that does nothing
 * draws the same tree until it is pressed.)
 */

const TITLES = ["Main dishes", "Desserts", "Drinks", "Salads"]

describe.each(PARITY_MATRIX)(
  "AnimatedSelectCategory's tabs [$language $platform]",
  (env) => {
    it("hands setSelectedCategory the pressed tab's index", async () => {
      const setSelectedCategory = jest.fn()
      const load = () => {
        const React = require("react") as typeof import("react")
        const Tabs = require("../AnimatedSelectCategory").default
        const Harness = () =>
          React.createElement(Tabs, {
            categories: TITLES,
            setSelectedCategory,
          })
        return { default: Harness }
      }
      const session = await openScreen(load, {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
      })
      try {
        expect(setSelectedCategory).not.toHaveBeenCalled()
        for (const index of [2, 0, 3]) {
          // eslint-disable-next-line no-await-in-loop
          await session.act(() => {
            pressText(session.root, TITLES[index])
          })
        }
        expect(setSelectedCategory.mock.calls).toEqual([[2], [0], [3]])
      } finally {
        session.unmount()
      }
    })
  }
)
