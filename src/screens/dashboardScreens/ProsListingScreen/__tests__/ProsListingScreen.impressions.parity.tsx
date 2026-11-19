/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  fireHost,
  openScreen,
  pressIcon,
  pressText,
  pressTitled,
  typeInto,
  wait,
  type BackendFixtures,
  type RenderScreenOptions,
  type Step,
} from "testing/screenKit"
import { guestState, screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import {
  PRO_COMPANY,
  PRO_INDIVIDUAL,
} from "testing/screenKit/fixtures/entities"
import { pressContaining } from "testing/pressContaining"
import { PARITY_MATRIX, type ParityEnv } from "testing/hostTreeParity"
import type { ProType } from "types/pro"

import { SERVICE_PLAIN, SERVICE_RICH } from "../__fixtures__/discover"

/*
 * Search impressions (My Performance, P11): a pro's card counts once it has
 * been on screen for 1 s while the list is really on screen, once per
 * (searchId, pro), and goes out in a POST every 5 s. The kit's FlashList
 * stand-in never reports viewability by itself, so each row reports the
 * viewable cards the way the list does (its onViewableItemsChanged, already
 * 200 ms late), including after a refetch, where the screen asks the list to
 * report again (recomputeViewableItems). These rows read the request log
 * only: nothing drawn changes and no frozen tree is involved.
 */
const load = () => require("../ProsListingScreen")

const PROS = [PRO_INDIVIDUAL, PRO_COMPANY]
const SEARCH_1 = "5ea4c401-0000-4000-8000-000000000001"
const SEARCH_2 = "5ea4c401-0000-4000-8000-000000000002"

/** Each listing request a new search: SEARCH_1, then SEARCH_2. */
const searches = () => {
  let asked = 0
  return () => {
    asked += 1
    return {
      data: {
        data: PROS,
        page: 1,
        perPage: 100,
        total: PROS.length,
        searchId: asked === 1 ? SEARCH_1 : SEARCH_2,
      },
    }
  }
}

const listing = ({
  who = screenState("data"),
  api = {},
  params = {},
}: {
  who?: ReturnType<typeof screenState>
  api?: BackendFixtures
  params?: object
} = {}): Omit<RenderScreenOptions, "lang" | "platform"> => ({
  ...who,
  api: { ...DATA, getProsForCategory: searches(), ...api },
  route: {
    name: "ProsListingScreen",
    params: { ...(ROUTE_PARAMS.ProsListingScreen as object), ...params },
  },
})
const NO_PLACE = { placeOfService: undefined }

/**
 * What the list reports: these pros' cards are viewable now. It runs no
 * clock of its own (a step settles 500 ms by default), so each row says how
 * long the cards stay.
 */
const viewable = (pros: ProType[]): Step =>
  Object.assign(
    (root: Parameters<Step>[0]) =>
      fireHost(root, "FlashList", "onViewableItemsChanged", [
        {
          viewableItems: pros.map((item, index) => ({
            item,
            index,
            key: String(item.id),
            isViewable: true,
          })),
          changed: [],
        },
      ]),
    { settleMs: 0 }
  )

// The question flow (SERVICE_RICH) to its Done, as ProsListingScreen.parity.
const place =
  (key: string): Step =>
  (root, env) =>
    pressContaining(root, copy(env, key))
const option =
  (label: string, ar: string): Step =>
  (root, env) =>
    pressContaining(root, env.language === "ar" ? ar : label)
const next =
  (nth: number): Step =>
  (root, env) =>
    pressText(root, copy(env, "next"), { nth })
const FLOW_TO_DONE: Step[] = [
  place("at_my_location"),
  next(0),
  option("Repair", "إصلاح"),
  next(1),
  option("The tap", "الصنبور"),
  next(2),
  (root) => typeInto(root, 0, "Under the sink."),
  wait(600),
  (root, env) => pressText(root, copy(env, "done"), { nth: 0 }),
  wait(1000),
]
const FILTER_INDIVIDUALS: Step[] = [
  (root) => pressIcon(root, { icon: "svg:filter-sliders" }),
  (root, env) => pressText(root, copy(env, "individual")),
  (root, env) => pressTitled(root, copy(env, "show_results")),
]

describe.each(PARITY_MATRIX)(
  "ProsListingScreen, search impressions [$language $platform]",
  (env: ParityEnv) => {
    const open = (options: Omit<RenderScreenOptions, "lang" | "platform">) =>
      openScreen(load, {
        ...options,
        lang: env.language,
        platform: env.platform,
      } as RenderScreenOptions)
    type Session = Awaited<ReturnType<typeof open>>
    const run = async (session: Session, steps: Step[]) => {
      for (const step of steps) {
        // eslint-disable-next-line no-await-in-loop
        await session.act(() => {
          step(session.root, env)
        }, step.settleMs)
      }
    }
    const impressions = (session: Session) =>
      session
        .requests()
        .filter((request) => request.endpoint === "recordSearchImpressions")
        .map((request) => request.args)
    const sent = (searchId: string, pros: ProType[]) => ({
      url: `/customers/service-search/${searchId}/impressions`,
      method: "POST",
      body: { proIds: pros.map((pro) => pro.id) },
    })

    it("signed in: the cards on screen for 1 s go out in one POST under the search", async () => {
      const session = await open(listing())
      try {
        await run(session, [viewable(PROS)])
        await session.settle(800 + 5000)
        expect(impressions(session)).toEqual([sent(SEARCH_1, PROS)])
        await session.settle(30000)
        expect(impressions(session)).toHaveLength(1)
      } finally {
        session.unmount()
      }
    })

    it("cards scrolled past within the second count nothing", async () => {
      const session = await open(listing())
      try {
        await run(session, [viewable(PROS), wait(500), viewable([])])
        await session.settle(30000)
        expect(impressions(session)).toEqual([])
      } finally {
        session.unmount()
      }
    })

    it("a guest sends none, even with a search id in the answer", async () => {
      const session = await open(listing({ who: guestState("data") }))
      try {
        await run(session, [viewable(PROS)])
        await session.settle(30000)
        expect(impressions(session)).toEqual([])
      } finally {
        session.unmount()
      }
    })

    it("none while the question sheet covers the list", async () => {
      const session = await open(
        listing({
          api: { getServiceById: { data: SERVICE_PLAIN } },
          params: NO_PLACE,
        })
      )
      try {
        await run(session, [viewable(PROS)])
        await session.settle(30000)
        expect(impressions(session)).toEqual([])
      } finally {
        session.unmount()
      }
    })

    it("none while the filters sheet covers the list", async () => {
      const session = await open(listing())
      try {
        await run(session, [
          (root) => pressIcon(root, { icon: "svg:filter-sliders" }),
          viewable(PROS),
        ])
        await session.settle(30000)
        expect(impressions(session)).toEqual([])
      } finally {
        session.unmount()
      }
    })

    it("cards behind the question sheet count nothing; after Done they count under the narrowed search", async () => {
      const session = await open(
        listing({
          api: { getServiceById: { data: SERVICE_RICH } },
          params: NO_PLACE,
        })
      )
      try {
        // Reported behind the sheet, under the first search.
        await run(session, [viewable(PROS)])
        await session.settle(3000)
        await run(session, FLOW_TO_DONE)
        // The narrowed search's results, reported again by the list.
        await run(session, [viewable(PROS)])
        await session.settle(800 + 5000)
        expect(impressions(session)).toEqual([sent(SEARCH_2, PROS)])
      } finally {
        session.unmount()
      }
    })

    it("a refetch with new filters sends the old search's queue under its own id at once, and the new one under the new id", async () => {
      const session = await open(
        listing({ api: { getServiceById: { data: SERVICE_RICH } } })
      )
      try {
        await run(session, [viewable(PROS)])
        await session.settle(1000)
        // Counted, not sent yet (the 5 s window runs to 5.8 s).
        expect(impressions(session)).toEqual([])
        await run(session, FILTER_INDIVIDUALS)
        expect(impressions(session)).toEqual([sent(SEARCH_1, PROS)])

        await run(session, [viewable([PRO_INDIVIDUAL])])
        await session.settle(800 + 5000)
        expect(impressions(session)).toEqual([
          sent(SEARCH_1, PROS),
          sent(SEARCH_2, [PRO_INDIVIDUAL]),
        ])
      } finally {
        session.unmount()
      }
    })
  }
)
