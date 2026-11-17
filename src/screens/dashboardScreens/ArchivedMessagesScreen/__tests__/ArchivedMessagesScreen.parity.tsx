/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  openScreen,
  pressIcon,
  renderScreen,
  rowsByPlatform,
  type BackendFixtures,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { CHAT, CHAT_PREVIEW } from "testing/screenKit/fixtures/entities"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"
import { pressContaining } from "testing/pressContaining"

import type { ChatPreviewType } from "types/chat"

/*
 * ArchivedMessagesScreen: the customer's archived chats, as GET
 * /chats?statuses[]=archived lists them (the backend filters and orders by
 * archive time; the Messages tab's own list asks for no statuses). The rows
 * are the real list in two languages, the empty message, and the skeleton
 * while the list loads, and a press for the back chevron and a chat. It used
 * to draw a mock archive, so its empty message was unreachable.
 */

const archived = (
  id: number,
  text: string,
  ownerType: "customer" | "pro"
): ChatPreviewType => ({
  ...CHAT_PREVIEW,
  chat: {
    ...CHAT,
    id,
    status: "archived",
    archivedAt: "2026-10-15T09:00:00.000Z",
  },
  notReadMessages: 0,
  lastMessage: {
    id: id * 10,
    chatId: id,
    text,
    ownerType,
    createdAt: "2026-10-14T09:00:00.000Z",
    readAt: "2026-10-14T09:05:00.000Z",
  },
})

const ARCHIVED = [
  archived(6101, "Thanks, the tap is fixed.", "customer"),
  archived(6102, "I will send the invoice today.", "pro"),
]

/** The backend: the archived list on the archive's request, the rest of the chats otherwise. */
const chatsAnswering =
  (rows: ChatPreviewType[]): BackendFixtures["getChats"] =>
  (args) => {
    const url = decodeURIComponent(
      typeof args === "string" ? args : String((args as { url?: string }).url)
    )
    return {
      data: {
        data: url.includes("statuses[]=archived") ? rows : [CHAT_PREVIEW],
      },
    }
  }

const load = () => require("../ArchivedMessagesScreen")
const route = { name: "ArchivedMessagesScreen" }

const WITH_CHATS = {
  ...screenState("data"),
  api: { ...screenState("data").api, getChats: chatsAnswering(ARCHIVED) },
}

const CASES = [
  { name: "the archive", options: WITH_CHATS },
  {
    name: "no archived chats",
    options: {
      ...WITH_CHATS,
      api: { ...WITH_CHATS.api, getChats: chatsAnswering([]) },
    },
  },
  {
    name: "loading",
    options: {
      ...WITH_CHATS,
      api: { ...WITH_CHATS.api, getChats: "loading" as const },
    },
  },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("ArchivedMessagesScreen", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (c) => {
    const { env } = c
    const tree = await renderScreen(load, {
      ...c.options,
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
    ...WITH_CHATS,
    lang: env.language,
    platform: env.platform,
    route,
  })

describe("ArchivedMessagesScreen, presses", () => {
  it.each(envs)(
    "it asks for the archived chats only, and lists what the backend returns [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env)
      try {
        const asked = session
          .requests()
          .filter((r) => r.endpoint === "getChats")
        expect(asked.map((r) => decodeURIComponent(String(r.args)))).toEqual([
          "/chats?statuses[]=archived",
        ])
        const text = JSON.stringify(session.tree())
        expect(text).toContain("Thanks, the tap is fixed.")
        expect(text).toContain("I will send the invoice today.")
        // The tab's own chat (an active one) is not in the archive.
        expect(text).not.toContain(CHAT_PREVIEW.lastMessage?.text ?? "\0")
      } finally {
        session.unmount()
      }
    }
  )

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
          pressContaining(session.root, "Thanks, the tap is fixed.")
        })
        expect(session.navigation.actions).toMatchObject([
          {
            type: "NAVIGATE",
            payload: {
              name: "MessagesDetailsScreen",
              params: { chatPreview: { chat: { id: 6101 } } },
            },
          },
        ])
      } finally {
        session.unmount()
      }
    }
  )
})
