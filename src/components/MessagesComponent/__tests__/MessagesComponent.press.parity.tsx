/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import { openScreen } from "testing/screenKit"
import { CHAT_PREVIEW } from "testing/screenKit/fixtures/entities"
import { pressContaining } from "testing/pressContaining"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * The Messages list row opens its chat: a press on the row calls onPress
 * once, with a last message or without one. (A handler swapped for one that
 * does nothing draws the same tree until it is pressed.)
 */

const PRO_NAME = CHAT_PREVIEW.chat.pro!.registeredName!

const CASES = [
  { name: "a last message", item: CHAT_PREVIEW },
  { name: "no last message", item: { ...CHAT_PREVIEW, lastMessage: undefined } },
]

describe.each(PARITY_MATRIX)(
  "Messages row's press [$language $platform]",
  (env) => {
    it.each(CASES)("calls onPress once, $name", async (row) => {
      const onPress = jest.fn()
      const load = () => {
        const React = require("react") as typeof import("react")
        const Row = require("../MessagesComponent").default
        const Harness = () =>
          React.createElement(Row, { item: row.item, onPress })
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
          pressContaining(session.root, PRO_NAME)
        })
        expect(onPress).toHaveBeenCalledTimes(1)
      } finally {
        session.unmount()
      }
    })
  }
)
