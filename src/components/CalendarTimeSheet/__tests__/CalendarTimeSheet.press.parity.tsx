/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import { copy, openScreen, pressText, pressTitled } from "testing/screenKit"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * CalendarTimeSheet's Confirm button does what it says, before and after its
 * conversion to ds Button (a handler swapped for one that does nothing draws
 * the same tree until it is pressed): it can't be pressed before a window is
 * picked, and once one is, a press hands onConfirm the day, the window and
 * "date", exactly once.
 */

describe.each(PARITY_MATRIX)(
  "CalendarTimeSheet's Confirm [$language $platform]",
  (env) => {
    const open = async (onConfirm: () => void) => {
      const load = () => {
        const React = require("react") as typeof import("react")
        const Sheet = require("../CalendarTimeSheet").default
        const Harness = () =>
          React.createElement(Sheet, {
            isVisible: true,
            onClose: () => undefined,
            onConfirm,
            hideSpecialOptions: true,
          })
        return { default: Harness }
      }
      return openScreen(load, {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
      })
    }

    it("is disabled until a window is picked", async () => {
      const onConfirm = jest.fn()
      const session = await open(onConfirm)
      try {
        expect(() => pressTitled(session.root, copy(env, "confirm"))).toThrow(
          /disabled/
        )
        expect(onConfirm).not.toHaveBeenCalled()
      } finally {
        session.unmount()
      }
    })

    it("hands onConfirm the day and the window once a window is picked", async () => {
      const onConfirm = jest.fn()
      const session = await open(onConfirm)
      try {
        await session.act(() => {
          pressText(session.root, "12:00 - 3:00 PM")
        })
        await session.act(() => {
          pressTitled(session.root, copy(env, "confirm"))
        })
        expect(onConfirm).toHaveBeenCalledTimes(1)
        expect(onConfirm).toHaveBeenCalledWith(
          "2026-10-20",
          { start: "12:00", end: "15:00" },
          "date"
        )
      } finally {
        session.unmount()
      }
    })
  }
)
