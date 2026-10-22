/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import { copy, openScreen, pressText, pressTitled } from "testing/screenKit"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * CancelJobFeedbackModal's Submit button and the buttons around it do what
 * they say, before and after the ActionBtn becomes a ds Button: Submit can't
 * be pressed until the cancel hook says so, and then a press calls its
 * handler exactly once; a reason's row toggles that reason; the close X
 * closes. (A handler swapped for one that does nothing draws the same tree
 * until it is pressed.)
 */

const REASONS = [
  "I did not receive enough offers",
  "Offers are expensive or not suitable",
  "I hired a local pro",
  "Other Reasons",
] as const

describe.each(PARITY_MATRIX)(
  "CancelJobFeedbackModal [$language $platform]",
  (env) => {
    const open = async (
      cancel: Record<string, unknown>,
      onClose: () => void = () => undefined
    ) => {
      const load = () => {
        const React = require("react") as typeof import("react")
        const Modal = require("../CancelJobFeedbackModal").default
        const Harness = () =>
          React.createElement(Modal, {
            isVisible: true,
            onClose,
            onModalHide: () => undefined,
            cancel,
          })
        return { default: Harness }
      }
      return openScreen(load, {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
      })
    }
    const hook = (patch: Record<string, unknown>) => ({
      cancelReasons: REASONS,
      selectedReasons: [] as string[],
      toggleReason: () => undefined,
      otherReasonText: "",
      setOtherReasonText: () => undefined,
      handleSubmitCancel: () => undefined,
      isSubmitting: false,
      hasOtherSelected: false,
      canSubmit: false,
      ...patch,
    })

    it("can't submit until the hook says so", async () => {
      const handleSubmitCancel = jest.fn()
      const session = await open(hook({ handleSubmitCancel }))
      try {
        expect(() => pressTitled(session.root, copy(env, "submit"))).toThrow(
          /disabled/
        )
        expect(handleSubmitCancel).not.toHaveBeenCalled()
      } finally {
        session.unmount()
      }
    })

    it("submits once when it can", async () => {
      const handleSubmitCancel = jest.fn()
      const session = await open(
        hook({
          handleSubmitCancel,
          canSubmit: true,
          selectedReasons: [REASONS[2]],
        })
      )
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "submit"))
        })
        expect(handleSubmitCancel).toHaveBeenCalledTimes(1)
      } finally {
        session.unmount()
      }
    })

    it("can't submit while it is submitting", async () => {
      const handleSubmitCancel = jest.fn()
      const session = await open(
        hook({ handleSubmitCancel, canSubmit: true, isSubmitting: true })
      )
      try {
        expect(() => pressTitled(session.root, copy(env, "submit"))).toThrow(
          /disabled/
        )
        expect(handleSubmitCancel).not.toHaveBeenCalled()
      } finally {
        session.unmount()
      }
    })

    it("toggles the reason that was pressed", async () => {
      const toggleReason = jest.fn()
      const session = await open(hook({ toggleReason }))
      try {
        await session.act(() => {
          pressText(session.root, copy(env, REASONS[1]))
        })
        expect(toggleReason).toHaveBeenCalledTimes(1)
        expect(toggleReason).toHaveBeenCalledWith(REASONS[1])
      } finally {
        session.unmount()
      }
    })

    it("closes from the X", async () => {
      const onClose = jest.fn()
      const session = await open(hook({}), onClose)
      try {
        await session.act(() => {
          pressText(session.root, "✕")
        })
        expect(onClose).toHaveBeenCalledTimes(1)
      } finally {
        session.unmount()
      }
    })
  }
)
