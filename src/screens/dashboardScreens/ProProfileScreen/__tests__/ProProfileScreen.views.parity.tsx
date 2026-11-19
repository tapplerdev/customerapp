/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import {
  fireHost,
  openScreen,
  type RenderScreenOptions,
} from "testing/screenKit"
import { guestState, screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { CATEGORY, PRO_INDIVIDUAL } from "testing/screenKit/fixtures/entities"
import { PARITY_MATRIX, type ParityEnv } from "testing/hostTreeParity"
import type { ProType, ProfileViewSource } from "types/pro"

/*
 * The profile view (My Performance, P10): POST /pros/profile-views/:proId,
 * once per open, the first time the profile has loaded, with where it was
 * opened from. Signed-in customers only. The service goes out only when it's
 * a real id (chat opens the profile with 0). These rows read the request log
 * only, so nothing drawn changes and no frozen tree is involved.
 */
const load = () => require("../ProProfileScreen")

const PRO: ProType = {
  ...PRO_INDIVIDUAL,
  workPhotos: [],
  documents: [],
}

const SOURCES: ProfileViewSource[] = [
  "listing",
  "jobDetail",
  "chat",
  "requestSummary",
]

const opened = (
  params: object,
  {
    who = screenState("data"),
    profile = { data: PRO },
  }: {
    who?: ReturnType<typeof screenState>
    profile?: { data: ProType } | "loading"
  } = {}
): Omit<RenderScreenOptions, "lang" | "platform"> => ({
  ...who,
  api: { ...DATA, getProProfile: profile },
  http: () => ({ text: "<svg xmlns='http://www.w3.org/2000/svg'/>" }),
  route: {
    name: "ProProfileScreen",
    params: { ...ROUTE_PARAMS.ProProfileScreen, ...params },
  },
})

describe.each(PARITY_MATRIX)(
  "ProProfileScreen, the profile view [$language $platform]",
  (env: ParityEnv) => {
    const open = (options: Omit<RenderScreenOptions, "lang" | "platform">) =>
      openScreen(load, {
        ...options,
        lang: env.language,
        platform: env.platform,
      } as RenderScreenOptions)
    type Session = Awaited<ReturnType<typeof open>>
    const views = (session: Session) =>
      session
        .requests()
        .filter((request) => request.endpoint === "recordProfileView")
        .map((request) => request.args)

    it.each(SOURCES)(
      "opened from %s: one POST once it has loaded, with that source and the service",
      async (source) => {
        const session = await open(
          opened({ source, serviceCategoryId: CATEGORY.id })
        )
        try {
          expect(views(session)).toEqual([
            {
              url: `/pros/profile-views/${PRO_INDIVIDUAL.id}`,
              method: "POST",
              body: { source, serviceCategoryId: CATEGORY.id },
            },
          ])
        } finally {
          session.unmount()
        }
      }
    )

    it("chat's service of 0 is left out of the body", async () => {
      const session = await open(
        opened({ source: "chat", serviceCategoryId: 0 })
      )
      try {
        expect(views(session)).toEqual([
          {
            url: `/pros/profile-views/${PRO_INDIVIDUAL.id}`,
            method: "POST",
            body: { source: "chat" },
          },
        ])
      } finally {
        session.unmount()
      }
    })

    it("a job with no service id leaves it out too", async () => {
      const session = await open(
        opened({ source: "jobDetail", serviceCategoryId: undefined })
      )
      try {
        expect(
          views(session).map((args) => (args as { body: unknown }).body)
        ).toEqual([{ source: "jobDetail" }])
      } finally {
        session.unmount()
      }
    })

    it("only one, however long it stays open and whatever it redraws", async () => {
      const session = await open(opened({ source: "listing" }))
      try {
        await session.act(() => {
          fireHost(
            session.root,
            "RCTScrollView",
            "onScroll",
            [{ nativeEvent: { contentOffset: { y: 300 } } }],
            { nth: 0 }
          )
        })
        await session.settle(10000)
        expect(views(session)).toHaveLength(1)
      } finally {
        session.unmount()
      }
    })

    it("a guest sends none", async () => {
      const session = await open(
        opened({ source: "listing" }, { who: guestState("data") })
      )
      try {
        expect(views(session)).toEqual([])
      } finally {
        session.unmount()
      }
    })

    it("none while the profile is still loading (or failed)", async () => {
      const session = await open(
        opened({ source: "listing" }, { profile: "loading" })
      )
      try {
        await session.settle(5000)
        expect(views(session)).toEqual([])
      } finally {
        session.unmount()
      }
    })
  }
)
