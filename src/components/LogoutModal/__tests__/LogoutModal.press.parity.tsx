/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import { copy, openScreen, pressTitled } from "testing/screenKit"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * LogoutModal's two buttons do what they say: Yes signs out (onPress, once,
 * and nothing closes), No closes (onClose, once, and nobody signs out), and
 * while a sign-out is in flight neither can be pressed. (A handler swapped
 * for one that does nothing draws the same tree until it is pressed.)
 */

describe.each(PARITY_MATRIX)(
  "LogoutModal's buttons [$language $platform]",
  (env) => {
    const open = (props: Record<string, unknown>) => {
      const load = () => {
        const React = require("react") as typeof import("react")
        const Modal = require("../LogoutModal").default
        const Harness = () =>
          React.createElement(Modal, {
            isVisible: true,
            onModalHide: () => undefined,
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

    it("Yes signs out once and does not close", async () => {
      const onPress = jest.fn()
      const onClose = jest.fn()
      const session = await open({ onPress, onClose })
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "yes"))
        })
        expect(onPress).toHaveBeenCalledTimes(1)
        expect(onClose).not.toHaveBeenCalled()
      } finally {
        session.unmount()
      }
    })

    it("No closes once and does not sign out", async () => {
      const onPress = jest.fn()
      const onClose = jest.fn()
      const session = await open({ onPress, onClose })
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "no"))
        })
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onPress).not.toHaveBeenCalled()
      } finally {
        session.unmount()
      }
    })

    it("refuses both while the sign-out is in flight", async () => {
      const onPress = jest.fn()
      const onClose = jest.fn()
      const session = await open({ onPress, onClose, isLoading: true })
      try {
        expect(() => pressTitled(session.root, copy(env, "yes"))).toThrow(
          /disabled/
        )
        expect(() => pressTitled(session.root, copy(env, "no"))).toThrow(
          /disabled/
        )
        expect(onPress).not.toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
      } finally {
        session.unmount()
      }
    })
  }
)
