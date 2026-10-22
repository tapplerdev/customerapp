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
import {
  NOTIFICATION_READ,
  NOTIFICATION_UNREAD,
} from "testing/screenKit/fixtures/entities"
import { signedIn } from "testing/screenKit/fixtures/users"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"
import type { NotificationsItemType } from "types/notification"

/*
 * NotificationDetailsScreen, captured before its conversion: an unread
 * notification (the screen marks it read as it opens), a read one with a
 * long body, one with no title or body at all, and a customer with no first
 * name (the greeting loses it). The back chevron is pressed.
 */

const load = () => require("../NotificationDetailsScreen")

const LONG: NotificationsItemType = {
  ...NOTIFICATION_READ,
  title:
    "Welcome to Tappler, where finding a pro for anything around the house takes minutes",
  body: "Find a pro for anything around the house. Post a request and compare the offers you get, or message a pro you like and agree the details in the chat. Everything stays in one place.",
}
const BARE: NotificationsItemType = {
  ...NOTIFICATION_READ,
  title: "",
  body: "",
}

const nameless = {
  ...screenState("data"),
  state: {
    auth: { ...signedIn(), user: { ...signedIn().user!, firstName: "" } },
  },
}

type Case = {
  name: string
  notification: NotificationsItemType
  state?: ReturnType<typeof screenState>
}
const CASES: Case[] = [
  { name: "unread", notification: NOTIFICATION_UNREAD },
  { name: "read, long text", notification: LONG },
  { name: "no title or body", notification: BARE },
  { name: "no first name", notification: LONG, state: nameless },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("NotificationDetailsScreen, captured from the unconverted code", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (c) => {
    const { env } = c
    const tree = await renderScreen(load, {
      ...(c.state ?? screenState("data")),
      lang: env.language,
      platform: env.platform,
      route: {
        name: "NotificationDetailsScreen",
        params: { notification: c.notification },
      },
    })
    expectParity(parityName(c.name, env), tree)
  })
})

const envs = rowsByPlatform([{}], PARITY_MATRIX)
const open = (
  env: (typeof PARITY_MATRIX)[number],
  notification: NotificationsItemType
) =>
  openScreen(load, {
    ...screenState("data"),
    lang: env.language,
    platform: env.platform,
    route: { name: "NotificationDetailsScreen", params: { notification } },
  })

describe("NotificationDetailsScreen, the controls", () => {
  it.each(envs)(
    "an unread notification is marked read once as it opens [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env, NOTIFICATION_UNREAD)
      try {
        expect(
          session
            .requests()
            .filter((request) => request.endpoint === "markNotificationAsRead")
            .map((request) => request.args)
        ).toEqual([
          {
            method: "PATCH",
            url: `/notifications/${NOTIFICATION_UNREAD.id}/mark-as-read`,
          },
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a read one sends nothing, and the back chevron goes back [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env, NOTIFICATION_READ)
      try {
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:chevron-left" })
        })
        expect(session.navigation.actions).toMatchObject([{ type: "GO_BACK" }])
        expect(
          session
            .requests()
            .filter((request) => request.endpoint === "markNotificationAsRead")
        ).toHaveLength(0)
      } finally {
        session.unmount()
      }
    }
  )
})
