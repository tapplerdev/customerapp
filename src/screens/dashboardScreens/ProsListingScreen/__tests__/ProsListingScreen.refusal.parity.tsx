import { describe, expect, it } from "@jest/globals"

import { copy, openScreen, pressText } from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA, urlOf } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import {
  PRO_COMPANY,
  PRO_INDIVIDUAL,
} from "testing/screenKit/fixtures/entities"
import { PARITY_MATRIX, type ParityEnv } from "testing/hostTreeParity"
import type { ProType } from "types/pro"

import { SERVICE_RICH } from "../__fixtures__/discover"

/*
 * Back from a refused request (RequestSummaryScreen.refusal.parity.tsx): the
 * listing fetches its list again from the NETWORK, never the cache (RTK's
 * preferCacheValue, which every other fetch here sets, would hand back the
 * list that still holds the refused pro when the arguments match a cached
 * one), and the prune drops the refused pro with the shortlist notice. A
 * refused place of service is cleared first. The server stopped serving
 * PRO_INDIVIDUAL between the first list and the second.
 */
const load = () => require("../ProsListingScreen")
const PARAMS = ROUTE_PARAMS.ProsListingScreen as Record<string, unknown>

const page = (rows: ProType[]) => ({
  data: rows,
  page: 1,
  perPage: 20,
  total: rows.length,
})

const open = (env: ParityEnv) => {
  let refused = false
  const session = openScreen(load, {
    ...screenState("data"),
    api: {
      ...DATA,
      getServiceById: { data: SERVICE_RICH },
      getProsForCategory: () => ({
        data: page(refused ? [PRO_COMPANY] : [PRO_INDIVIDUAL, PRO_COMPANY]),
      }),
    },
    lang: env.language,
    platform: env.platform,
    route: { name: "ProsListingScreen", params: PARAMS },
  })
  return { session, refuse: () => (refused = true) }
}

type Session = Awaited<ReturnType<typeof openScreen>>

const lists = (session: Session) =>
  session
    .requests()
    .filter((request) => request.endpoint === "getProsForCategory")
    .map((request) => decodeURIComponent(urlOf(request.args)))

const emitRefused = (session: Session, clearPlaceOfService: boolean) =>
  session.act(() => {
    const { questionFlowEventBus } = require("events/questionFlowEventBus")
    questionFlowEventBus.emit("request:refused", { clearPlaceOfService })
  }, 1000)

describe("ProsListingScreen: back from a refused request", () => {
  it.each(PARITY_MATRIX)(
    "refetches from the network each time, and drops the refused pro with the notice [$language $platform]",
    async (env) => {
      const { session: opening, refuse } = open(env)
      const session = await opening
      try {
        await session.act(() => {
          pressText(session.root, copy(env, "select_me"), { nth: 0 })
        }, 500)
        expect(JSON.stringify(session.tree())).toContain(copy(env, "continue"))
        const before = lists(session).length

        refuse()
        await emitRefused(session, false)
        // Twice with the same arguments: a cache-first fetch would send the
        // second one nowhere.
        await emitRefused(session, false)

        const after = lists(session).slice(before)
        expect(after).toHaveLength(2)
        expect(after[0]).toEqual(after[1])
        expect(after[0]).toContain(`placeOfService=${PARAMS.placeOfService}`)
        const tree = JSON.stringify(session.tree())
        expect(tree).toContain(copy(env, "shortlist_updated_notice"))
        expect(tree).not.toContain(copy(env, "continue"))
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a refused place of service is cleared before the list is fetched [$language $platform]",
    async (env) => {
      const { session: opening, refuse } = open(env)
      const session = await opening
      try {
        const before = lists(session).length
        refuse()
        await emitRefused(session, true)
        const after = lists(session).slice(before)
        expect(after).toHaveLength(1)
        expect(after[0]).not.toContain("placeOfService")
        // With no place, the address rides along (the any-mode list).
        expect(after[0]).toContain("customerAddress")
      } finally {
        session.unmount()
      }
    }
  )
})
