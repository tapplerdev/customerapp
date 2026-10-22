/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import {
  BOTTOM_GAP_INSETS,
  copy,
  openScreen,
  pressText,
  rowsByPlatform,
  treeAfter,
} from "testing/screenKit"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * JobMenuSheet, the ••• sheet JobDetail and the chat share: JobDetail passes it
 * the details and cancel rows, the chat (S3's MessagesDetails) the details,
 * block and report rows, and a direct message the last two only. The rows
 * JobDetail's own tests can't reach (block, report), every combination, the
 * bottom insets (the sheet pads by them), and a press on each row, which calls
 * its handler once.
 */

const noop = () => undefined

type Case = {
  state: string
  props: Record<string, unknown>
  insets?: { bottom: number }
}

const CASES: Case[] = [
  {
    state: "all four rows",
    props: {
      onShowDetails: noop,
      cancelLabel: "Cancel service request",
      onCancel: noop,
      onBlock: noop,
      onReport: noop,
    },
  },
  { state: "details only", props: { onShowDetails: noop } },
  {
    state: "details and cancel",
    props: { onShowDetails: noop, cancelLabel: "Cancel order", onCancel: noop },
  },
  { state: "block and report", props: { onBlock: noop, onReport: noop } },
  {
    state: "all four, no bottom inset",
    props: {
      onShowDetails: noop,
      cancelLabel: "Cancel service request",
      onCancel: noop,
      onBlock: noop,
      onReport: noop,
    },
    insets: { bottom: BOTTOM_GAP_INSETS[0] },
  },
  {
    state: "all four, a tall bottom inset",
    props: {
      onShowDetails: noop,
      cancelLabel: "Cancel service request",
      onCancel: noop,
      onBlock: noop,
      onReport: noop,
    },
    insets: { bottom: BOTTOM_GAP_INSETS[1] },
  },
]

const sheet = (props: Record<string, unknown>) => () => {
  const React = require("react") as typeof import("react")
  const Sheet = require("../JobMenuSheet").default
  const Harness = () =>
    React.createElement(Sheet, { isVisible: true, onClose: noop, ...props })
  return { default: Harness }
}

const options = (env: ParityEnv, insets?: { bottom: number }) => ({
  lang: env.language,
  platform: env.platform,
  navigation: "none" as const,
  ...(insets ? { insets } : {}),
})

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("JobMenuSheet, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async (entry) => {
    const tree = await treeAfter(
      sheet(entry.props),
      options(entry.env, entry.insets),
      entry.env
    )
    expectParity(parityName(entry.state, entry.env), tree)
  })
})

describe("JobMenuSheet: each row calls its handler once", () => {
  it.each(PARITY_MATRIX)(
    "details, cancel, block, report [$language $platform]",
    async (env) => {
      const handlers = {
        onShowDetails: jest.fn(),
        onCancel: jest.fn(),
        onBlock: jest.fn(),
        onReport: jest.fn(),
      }
      const session = await openScreen(
        sheet({ ...handlers, cancelLabel: "Cancel service request" }),
        options(env)
      )
      try {
        const press = [
          [copy(env, "my_request_details"), handlers.onShowDetails],
          ["Cancel service request", handlers.onCancel],
          [copy(env, "block_pro"), handlers.onBlock],
          [copy(env, "file_a_complain_against_pro"), handlers.onReport],
        ] as const
        for (const [label, handler] of press) {
          // eslint-disable-next-line no-await-in-loop
          await session.act(() => {
            pressText(session.root, label)
          })
          expect(handler).toHaveBeenCalledTimes(1)
        }
        for (const [, handler] of press)
          expect(handler).toHaveBeenCalledTimes(1)
      } finally {
        session.unmount()
      }
    }
  )
})
