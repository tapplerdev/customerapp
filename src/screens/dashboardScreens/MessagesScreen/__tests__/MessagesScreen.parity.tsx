/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressTitled,
  renderScreen,
  rowsByPlatform,
  typeInto,
} from "testing/screenKit"
import { guestState, screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import {
  CHAT,
  CHAT_PREVIEW,
  DAYS_AGO,
  HOURS_AGO,
  PRO_COMPANY,
  some,
} from "testing/screenKit/fixtures/entities"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"
import { pressContaining } from "testing/pressContaining"
import type { ChatPreviewType } from "types/chat"

/*
 * MessagesScreen (the Messages tab), captured before its conversion: the
 * list a signed-in customer sees (a photo avatar with an unread count, an
 * initial avatar, a long last message, an older date, the archived count
 * and a hidden chat that must not show), empty, loading (the skeleton),
 * the signed-out screen (its Log in button), a search that finds and one
 * that doesn't, and a press for the Archived row, a chat and the button.
 */

const load = () => require("../MessagesScreen")

const row = (
  id: number,
  proName: string,
  overrides: Partial<ChatPreviewType["chat"]> = {},
  preview: Partial<ChatPreviewType> = {}
): ChatPreviewType => ({
  ...CHAT_PREVIEW,
  notReadMessages: 0,
  ...preview,
  chat: {
    ...CHAT,
    id,
    pro: {
      id: 2000 + id,
      registeredName: proName,
      proType: "individual",
      accountStatus: "active",
    },
    ...overrides,
  },
})

const AT_LEAST_ONE_OF_EACH: ChatPreviewType[] = [
  // The fixture's chat: a photo avatar, one unread message from the pro.
  CHAT_PREVIEW,
  // No photo, so the initial; a business name wins over the registered name.
  row(
    6002,
    "Nabil Ahmed",
    {
      pro: {
        id: 2002,
        registeredName: "Nabil Ahmed",
        businessName: "Nabil Electrical",
        proType: "company",
        accountStatus: "active",
      },
      serviceCategory: { id: 5, nameEn: "Electrical", nameAr: "كهرباء" },
    },
    {
      notReadMessages: 12,
      lastMessage: {
        id: 8001,
        chatId: 6002,
        ownerType: "pro",
        text: "I can be there on Thursday at ten with everything the job needs and a second pair of hands if you would like one.",
        createdAt: HOURS_AGO(0.5),
      },
    }
  ),
  // Sent a few days ago by the customer, so the date and not the time.
  row(
    6003,
    "Hassan Home Services",
    {
      pro: { ...PRO_COMPANY, id: 2003 } as never,
    },
    {
      lastMessage: {
        id: 8002,
        chatId: 6003,
        ownerType: "customer",
        text: "Thank you",
        createdAt: DAYS_AGO(4),
      },
    }
  ),
  // Yesterday.
  row(
    6004,
    "Mona Said",
    {},
    {
      notReadMessages: 1,
      lastMessage: {
        id: 8003,
        chatId: 6004,
        ownerType: "pro",
        text: "See you then",
        createdAt: HOURS_AGO(26),
      },
    }
  ),
  // Archived twice over: counted in the Archived row, never listed.
  row(6005, "Archived One", { status: "archived" }),
  row(6006, "Archived Two", { status: "archived" }),
  // A job chat nobody acted on: the engagement gate hides it.
  row(
    6007,
    "Hidden Pitch",
    {
      job: some<NonNullable<ChatPreviewType["chat"]["job"]>>({
        id: 9100,
        pros: [{ proId: 2007, selectionStatus: "opportunity" }],
      }),
      proId: 2007,
    },
    { hasCustomerMessages: false }
  ),
]

const chats = (data: ChatPreviewType[]) => ({
  ...DATA,
  getChats: { data: { data } },
})

type Case = {
  name: string
  state: ReturnType<typeof screenState>
  api: object
}
const signedIn = screenState("data")
const CASES: Case[] = [
  { name: "chats", state: signedIn, api: chats(AT_LEAST_ONE_OF_EACH) },
  { name: "empty", state: signedIn, api: chats([]) },
  { name: "loading", state: signedIn, api: {} },
  { name: "signed out", state: guestState("data"), api: DATA },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("MessagesScreen, captured from the unconverted code", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (c) => {
    const { env } = c
    const tree = await renderScreen(load, {
      ...c.state,
      api: c.api,
      lang: env.language,
      platform: env.platform,
    })
    expectParity(parityName(c.name, env), tree)
  })
})

const envs = rowsByPlatform([{}], PARITY_MATRIX)

const open = (env: (typeof PARITY_MATRIX)[number], c: Case) =>
  openScreen(load, {
    ...c.state,
    api: c.api,
    lang: env.language,
    platform: env.platform,
  })

const WITH_CHATS = CASES[0]

describe("MessagesScreen, search and presses", () => {
  it.each(envs)(
    "a search that finds one chat [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env, WITH_CHATS)
      try {
        await session.act(() => {
          typeInto(session.root, 0, "electrical")
        }, 600)
        expectParity(parityName("search finds", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a search that finds nothing [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env, WITH_CHATS)
      try {
        await session.act(() => {
          typeInto(session.root, 0, "zzzz")
        }, 600)
        expectParity(parityName("search finds nothing", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the Archived row opens the archive [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env, WITH_CHATS)
      try {
        await session.act(() => {
          pressContaining(session.root, copy(env, "archived"))
        })
        expect(session.navigation.actions).toMatchObject([
          { type: "NAVIGATE", payload: { name: "ArchivedMessagesScreen" } },
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a chat opens its conversation [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env, WITH_CHATS)
      try {
        await session.act(() => {
          pressContaining(session.root, "Nabil Electrical")
        })
        expect(session.navigation.actions).toMatchObject([
          {
            type: "NAVIGATE",
            payload: {
              name: "MessagesDetailsScreen",
              params: { chatPreview: { chat: { id: 6002 } } },
            },
          },
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "Log in, signed out, opens the sign-in [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env, CASES[3])
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "log_In"))
        })
        expect(session.navigation.actions).toMatchObject([
          { type: "NAVIGATE", payload: { name: "SignInEmailScreen" } },
        ])
      } finally {
        session.unmount()
      }
    }
  )
})
