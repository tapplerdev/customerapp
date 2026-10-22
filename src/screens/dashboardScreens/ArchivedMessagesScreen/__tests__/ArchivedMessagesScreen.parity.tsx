/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  openScreen,
  pressIcon,
  renderScreen,
  rowsByPlatform,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"
import { pressContaining } from "testing/pressContaining"

/*
 * ArchivedMessagesScreen, captured before its conversion. It lists the mock
 * archive (MOCK_ARCHIVED_CHATS: the screen has no query yet, so its list
 * never changes and its empty message is unreachable), so one state, and
 * a press for the back chevron and a chat.
 */

const load = () => require("../ArchivedMessagesScreen")
const route = { name: "ArchivedMessagesScreen" }

const rows = rowsByPlatform([{ name: "the archive" }], PARITY_MATRIX)

describe("ArchivedMessagesScreen, captured from the unconverted code", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (c) => {
    const { env } = c
    const tree = await renderScreen(load, {
      ...screenState("data"),
      lang: env.language,
      platform: env.platform,
      route,
    })
    expectParity(parityName(c.name, env), tree)
  })
})

const envs = rowsByPlatform([{}], PARITY_MATRIX)
const open = (env: (typeof PARITY_MATRIX)[number]) =>
  openScreen(load, {
    ...screenState("data"),
    lang: env.language,
    platform: env.platform,
    route,
  })

describe("ArchivedMessagesScreen, presses", () => {
  it.each(envs)(
    "the back chevron goes back [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env)
      try {
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:chevron-left" })
        })
        expect(session.navigation.actions).toMatchObject([{ type: "GO_BACK" }])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a chat opens its conversation [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env)
      try {
        await session.act(() => {
          pressContaining(session.root, "شكرا ليك")
        })
        expect(session.navigation.actions).toMatchObject([
          {
            type: "NAVIGATE",
            payload: {
              name: "MessagesDetailsScreen",
              params: { chatPreview: { chat: { id: 6 } } },
            },
          },
        ])
      } finally {
        session.unmount()
      }
    }
  )
})
