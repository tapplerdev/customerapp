/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import { copy, openScreen, pressText, pressTitled } from "testing/screenKit"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * LeaveReviewModal's button and its close X do what they say, before and
 * after the ActionBtn becomes a ds Button: "Leave a review" calls
 * onLeaveReview exactly once, the X calls onClose.
 */

describe.each(PARITY_MATRIX)(
  "LeaveReviewModal [$language $platform]",
  (env) => {
    const open = async (props: Record<string, unknown>) => {
      const load = () => {
        const React = require("react") as typeof import("react")
        const Modal = require("../LeaveReviewModal").default
        const Harness = () =>
          React.createElement(Modal, {
            isVisible: true,
            categoryName: "Plumbing",
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

    it("leaves a review once", async () => {
      const onLeaveReview = jest.fn()
      const onClose = jest.fn()
      const session = await open({ onLeaveReview, onClose })
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "leave_review"))
        })
        expect(onLeaveReview).toHaveBeenCalledTimes(1)
        expect(onClose).not.toHaveBeenCalled()
      } finally {
        session.unmount()
      }
    })

    it("closes from the X", async () => {
      const onLeaveReview = jest.fn()
      const onClose = jest.fn()
      const session = await open({ onLeaveReview, onClose })
      try {
        await session.act(() => {
          pressText(session.root, "✕")
        })
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onLeaveReview).not.toHaveBeenCalled()
      } finally {
        session.unmount()
      }
    })
  }
)
