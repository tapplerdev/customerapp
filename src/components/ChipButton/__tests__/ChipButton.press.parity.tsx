/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import { openScreen, pressText } from "testing/screenKit"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * ChipButton (an answer chip in the service questions) takes a press: the
 * chip calls onPress once, selected or not, compact or not. A handler swapped
 * for one that does nothing draws the same tree until it is pressed.
 */

const CASES = [
  { name: "not selected", isSelected: false, compact: false },
  { name: "selected", isSelected: true, compact: false },
  { name: "compact", isSelected: false, compact: true },
]

describe.each(PARITY_MATRIX)("ChipButton's press [$language $platform]", (env) => {
  it.each(CASES)("calls onPress once, $name", async (row) => {
    const onPress = jest.fn()
    const load = () => {
      const React = require("react") as typeof import("react")
      const ChipButton = require("../ChipButton").default
      const Harness = () =>
        React.createElement(ChipButton, {
          label: "Yes, please",
          isSelected: row.isSelected,
          compact: row.compact,
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
        pressText(session.root, "Yes, please")
      })
      expect(onPress).toHaveBeenCalledTimes(1)
    } finally {
      session.unmount()
    }
  })
})
