/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
  renderScreen,
  rowsByPlatform,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA, urlOf } from "testing/screenKit/fixtures/api"
import {
  DAYS_AGO,
  HOURS_AGO,
  NOTIFICATION_READ,
  NOTIFICATION_UNREAD,
} from "testing/screenKit/fixtures/entities"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"
import { pressContaining } from "testing/pressContaining"

/*
 * NotificationsScreen (the bell's list), captured before its conversion:
 * the list with unread and read rows (today's time, an older date, long
 * lines the rows cut to one), the all-read header, empty, loading (the
 * skeleton), the end-of-list spinner, and a press for each
 * control: the back chevron, "mark all read" (it dims while it works), a row.
 */

const load = () => require("../NotificationsScreen")
const route = { name: "NotificationsScreen" }

const OLDER_UNREAD = {
  ...NOTIFICATION_UNREAD,
  id: 5003,
  title: "Your request was updated",
  body: "Laila's Kitchen accepted your order and a very long second line follows, so that the row has to cut it to one line.",
  createdAt: DAYS_AGO(5),
}
const YESTERDAY_READ = {
  ...NOTIFICATION_READ,
  id: 5004,
  title: "A reminder about your review for the last job you booked with us",
  body: "Tell other customers how it went.",
  createdAt: HOURS_AGO(30),
  readAt: HOURS_AGO(29),
}
const MIXED = [
  NOTIFICATION_UNREAD,
  NOTIFICATION_READ,
  OLDER_UNREAD,
  YESTERDAY_READ,
]
const ALL_READ = [NOTIFICATION_READ, YESTERDAY_READ]

const pageOf = (rows: object[], total = rows.length) => ({
  data: rows,
  page: 1,
  perPage: 20,
  total,
})
const answer = (rows: object[], total?: number) => ({
  ...DATA,
  getNotifications: { data: pageOf(rows, total) },
})

type Case = { name: string; api: ReturnType<typeof answer> | object }
const CASES: Case[] = [
  { name: "unread and read rows", api: answer(MIXED) },
  { name: "all read", api: answer(ALL_READ) },
  { name: "empty", api: answer([]) },
  { name: "loading", api: {} },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("NotificationsScreen, captured from the unconverted code", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (row) => {
    const { env } = row
    const tree = await renderScreen(load, {
      ...screenState("data"),
      api: row.api,
      lang: env.language,
      platform: env.platform,
      route,
    })
    expectParity(parityName(row.name, env), tree)
  })
})

const envs = rowsByPlatform([{}], PARITY_MATRIX)

const open = (env: (typeof PARITY_MATRIX)[number], api: object) =>
  openScreen(load, {
    ...screenState("data"),
    api,
    lang: env.language,
    platform: env.platform,
    route,
  })

describe("NotificationsScreen, the controls", () => {
  it.each(envs)(
    "mark all read dims while it works, and sends the request once [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env, answer(MIXED))
      try {
        await session.act(() => {
          pressText(session.root, copy(env, "mark_all_read"))
        })
        expectParity(parityName("mark all read pressed", env), session.tree())
        const sent = session
          .requests()
          .filter(
            (request) => request.endpoint === "markAllNotificationsAsRead"
          )
        expect(sent).toHaveLength(1)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "an unread row marks itself read and opens its details [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env, answer(MIXED))
      try {
        await session.act(() => {
          pressContaining(session.root, NOTIFICATION_UNREAD.title)
        })
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
        expect(session.navigation.actions).toMatchObject([
          {
            type: "NAVIGATE",
            payload: {
              name: "NotificationDetailsScreen",
              params: { notification: { id: NOTIFICATION_UNREAD.id } },
            },
          },
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a read row opens its details without marking anything [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env, answer(MIXED))
      try {
        await session.act(() => {
          pressContaining(session.root, NOTIFICATION_READ.title)
        })
        expect(
          session
            .requests()
            .filter((request) => request.endpoint === "markNotificationAsRead")
        ).toHaveLength(0)
        expect(session.navigation.actions).toMatchObject([
          {
            type: "NAVIGATE",
            payload: {
              name: "NotificationDetailsScreen",
              params: { notification: { id: NOTIFICATION_READ.id } },
            },
          },
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the back chevron goes back [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env, answer(MIXED))
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
    "reaching the end of a long list shows the spinner while the next page loads [$env.language $env.platform]",
    async ({ env }) => {
      // 40 in all: page 2 never answers, so the footer's spinner stays.
      const session = await open(env, {
        ...DATA,
        getNotifications: (args: unknown) =>
          /[?&]page=2/.test(urlOf(args)) ||
          (args as { page?: number })?.page === 2
            ? "loading"
            : { data: pageOf(MIXED, 40) },
      })
      try {
        const list = session.root.findAll(
          (node) =>
            typeof node.props.onEndReached === "function" &&
            typeof node.type !== "string",
          { deep: false }
        )[0]
        await session.act(() => {
          list.props.onEndReached()
        })
        expectParity(parityName("loading more", env), session.tree())
        expect(
          session
            .requests()
            .filter((request) => request.endpoint === "getNotifications")
        ).toHaveLength(2)
      } finally {
        session.unmount()
      }
    }
  )
})
