/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import { copy, openScreen, pressTitled } from "testing/screenKit"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * ErrorModal's OK button closes the card: a press calls onClose once, with
 * the card's own words and with a call site's. (A handler swapped for one
 * that does nothing draws the same tree until it is pressed.)
 */

const CASES = [
  { name: "its own words", props: {} },
  {
    name: "a call site's words",
    props: { title: "Couldn't save", descr: "Check your connection and retry." },
  },
]

describe.each(PARITY_MATRIX)("ErrorModal's OK [$language $platform]", (env) => {
  it.each(CASES)("closes once, $name", async (row) => {
    const onClose = jest.fn()
    const load = () => {
      const React = require("react") as typeof import("react")
      const Modal = require("../ErrorModal").default
      const Harness = () =>
        React.createElement(Modal, { isVisible: true, onClose, ...row.props })
      return { default: Harness }
    }
    const session = await openScreen(load, {
      lang: env.language,
      platform: env.platform,
      navigation: "none",
    })
    try {
      expect(onClose).not.toHaveBeenCalled()
      await session.act(() => {
        pressTitled(session.root, copy(env, "OK"))
      })
      expect(onClose).toHaveBeenCalledTimes(1)
    } finally {
      session.unmount()
    }
  })
})
