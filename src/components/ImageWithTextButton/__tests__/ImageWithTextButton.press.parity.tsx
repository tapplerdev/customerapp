/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import { openScreen, pressIcon } from "testing/screenKit"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * ImageWithTextButton (an answer card in the service questions, drawn through the
 * className slot) takes a press: the card calls onPress once, selected or
 * not. (A handler swapped for one that does nothing draws the same tree
 * until it is pressed.)
 */

const CASES = [
  { name: "not selected", isSelected: false, imageUrl: "" },
  { name: "selected", isSelected: true, imageUrl: "" },
]

describe.each(PARITY_MATRIX)("ImageWithTextButton's press [$language $platform]", (env) => {
  it.each(CASES)("calls onPress once, $name", async (row) => {
    const onPress = jest.fn()
    const load = () => {
      const React = require("react") as typeof import("react")
      const Card = require("../ImageWithTextButton").default
      const Harness = () =>
        React.createElement(Card, {
          label: "Leaking tap",
          imageUrl: row.imageUrl,
          isSelected: row.isSelected,
          onPress,
        })
      return { default: Harness }
    }
    const session = await openScreen(load, {
      lang: env.language,
      platform: env.platform,
      navigation: "none",
    })
    try {
      expect(onPress).not.toHaveBeenCalled()
      await session.act(() => {
        pressIcon(session.root)
      })
      expect(onPress).toHaveBeenCalledTimes(1)
    } finally {
      session.unmount()
    }
  })
})
