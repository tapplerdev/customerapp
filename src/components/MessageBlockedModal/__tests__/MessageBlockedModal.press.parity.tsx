/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import { copy, openScreen, pressTitled } from "testing/screenKit"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * MessageBlockedModal's "Edit message" button does what it says, before and
 * after the ActionBtn becomes a ds Button: it calls onEdit exactly once, and
 * with no onEdit it falls back to onClose.
 */

describe.each(PARITY_MATRIX)(
  "MessageBlockedModal [$language $platform]",
  (env) => {
    const open = async (props: Record<string, unknown>) => {
      const load = () => {
        const React = require("react") as typeof import("react")
        const Modal = require("../MessageBlockedModal").default
        const Harness = () =>
          React.createElement(Modal, {
            isVisible: true,
            description: "This message can't be sent.",
            ...props,
          })
        return { default: Harness }
      }
      return openScreen(load, {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
      })
    }

    it("edits the message once", async () => {
      const onEdit = jest.fn()
      const onClose = jest.fn()
      const session = await open({ onEdit, onClose })
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "edit_message"))
        })
        expect(onEdit).toHaveBeenCalledTimes(1)
        expect(onClose).not.toHaveBeenCalled()
      } finally {
        session.unmount()
      }
    })

    it("falls back to onClose with no onEdit", async () => {
      const onClose = jest.fn()
      const session = await open({ onClose })
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "edit_message"))
        })
        expect(onClose).toHaveBeenCalledTimes(1)
      } finally {
        session.unmount()
      }
    })
  }
)
