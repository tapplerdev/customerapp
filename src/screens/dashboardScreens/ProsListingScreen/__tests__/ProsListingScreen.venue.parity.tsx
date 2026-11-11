import { describe, expect, it } from "@jest/globals"

import { copy, openScreen, pressText } from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA, urlOf } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import {
  CATEGORY,
  PRO_COMPANY,
  PRO_INDIVIDUAL,
  SERVICE,
} from "testing/screenKit/fixtures/entities"
import { PARITY_MATRIX, type ParityEnv } from "testing/hostTreeParity"
import type { ProType } from "types/pro"

/*
 * The listing of a fixed-location request (venue-on-job). Airport Pickup's
 * shape: fixedLocations is the only place, with two airports here. Once a
 * venue is picked the list asks for the pros who picked it
 * (placeOfService=fixedLocations&fixedLocationId=…, never the address), a
 * new venue from the question flow asks again, a venue the server refused is
 * cleared, and Continue hands the venue to the request details.
 */
const load = () => require("../ProsListingScreen")
const PARAMS = ROUTE_PARAMS.ProsListingScreen as Record<string, unknown>

const CAIRO = {
  id: 72,
  nameEn: "Cairo International Airport",
  nameAr: "مطار القاهرة الدولي",
}
const SPHINX = {
  id: 74,
  nameEn: "Sphinx International Airport",
  nameAr: "مطار سفنكس الدولي",
}
const AIRPORTS = {
  ...CATEGORY,
  placeOfService: ["fixedLocations"],
  fixedLocations: [CAIRO, SPHINX],
}

const page = (rows: ProType[]) => ({
  data: rows,
  page: 1,
  perPage: 20,
  total: rows.length,
})

const open = (
  env: ParityEnv,
  params: Record<string, unknown>,
  category: () => Record<string, unknown> = () => AIRPORTS
) =>
  openScreen(load, {
    ...screenState("data"),
    api: {
      ...DATA,
      getServiceById: () => ({
        data: { ...SERVICE, categories: [category()] },
      }),
      getProsForCategory: { data: page([PRO_INDIVIDUAL, PRO_COMPANY]) },
    },
    lang: env.language,
    platform: env.platform,
    route: { name: "ProsListingScreen", params: { ...PARAMS, ...params } },
  })

type Session = Awaited<ReturnType<typeof open>>

const lists = (session: Session) =>
  session
    .requests()
    .filter((request) => request.endpoint === "getProsForCategory")
    .map((request) => decodeURIComponent(urlOf(request.args)))

const emit = (session: Session, event: string, payload: unknown) =>
  session.act(() => {
    const { questionFlowEventBus } = require("events/questionFlowEventBus")
    questionFlowEventBus.emit(event, payload)
  }, 1000)

describe("ProsListingScreen at a venue", () => {
  it.each(PARITY_MATRIX)(
    "asks for the venue's pros with its place and without the address [$language $platform]",
    async (env) => {
      const session = await open(env, {
        placeOfService: "fixedLocations",
        fixedLocationId: CAIRO.id,
      })
      try {
        const [first] = lists(session)
        expect(first).toContain("placeOfService=fixedLocations")
        expect(first).toContain(`fixedLocationId=${CAIRO.id}`)
        expect(first).not.toContain("customerAddress")
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a venue from the question flow asks again with it [$language $platform]",
    async (env) => {
      const session = await open(env, {
        placeOfService: "fixedLocations",
        fixedLocationId: CAIRO.id,
      })
      try {
        const before = lists(session).length
        await emit(session, "questions:done", {
          placeOfService: undefined,
          fixedLocationId: SPHINX.id,
          filterOptionIds: [],
          dataAnswers: [],
          allAnswers: [],
          filtersChanged: true,
        })
        const after = lists(session).slice(before)
        expect(after).toHaveLength(1)
        expect(after[0]).toContain("placeOfService=fixedLocations")
        expect(after[0]).toContain(`fixedLocationId=${SPHINX.id}`)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a venue the server refused is cleared: the place goes out only with a venue [$language $platform]",
    async (env) => {
      const session = await open(env, {
        placeOfService: "fixedLocations",
        fixedLocationId: CAIRO.id,
      })
      try {
        const before = lists(session).length
        await emit(session, "request:refused", {
          clearPlaceOfService: false,
          clearFixedLocation: true,
        })
        const after = lists(session).slice(before)
        expect(after).toHaveLength(1)
        expect(after[0]).not.toContain("fixedLocationId")
        expect(after[0]).not.toContain("placeOfService")
        expect(after[0]).toContain("customerAddress")
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "Continue hands the venue to the request details [$language $platform]",
    async (env) => {
      const session = await open(env, {
        placeOfService: "fixedLocations",
        fixedLocationId: SPHINX.id,
      })
      try {
        await session.act(() => {
          pressText(session.root, copy(env, "select_me"), { nth: 0 })
        }, 500)
        await session.act(() => {
          pressText(session.root, copy(env, "continue"))
        }, 500)
        const pushed = session.navigation.actions.find(
          (action) =>
            (action as { payload?: { name?: string } }).payload?.name ===
            "ServiceRequestDetailsScreen"
        ) as { payload: { params: Record<string, unknown> } }
        expect(pushed.payload.params).toMatchObject({
          placeOfService: "fixedLocations",
          fixedLocationId: SPHINX.id,
        })
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a refused single venue is not picked again: the service is asked for again first [$language $platform]",
    async (env) => {
      let venues = [CAIRO]
      const session = await open(
        env,
        { placeOfService: "fixedLocations", fixedLocationId: CAIRO.id },
        () => ({ ...AIRPORTS, fixedLocations: venues })
      )
      try {
        const services = () =>
          session
            .requests()
            .filter((request) => request.endpoint === "getServiceById").length
        const servicesBefore = services()
        const before = lists(session).length
        // Staff took Cairo off the category while the customer was sending.
        venues = []
        await emit(session, "request:refused", {
          clearPlaceOfService: false,
          clearFixedLocation: true,
        })
        expect(services()).toBeGreaterThan(servicesBefore)
        const after = lists(session).slice(before)
        expect(after.length).toBeGreaterThan(0)
        expect(after.at(-1)).not.toContain("fixedLocationId")
        expect(after.at(-1)).not.toContain("placeOfService")
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a category with venues and no questions still opens the flow to ask the venue [$language $platform]",
    async (env) => {
      const session = await open(env, { placeOfService: undefined }, () => ({
        ...AIRPORTS,
        customerQuestions: [],
      }))
      try {
        await session.settle(1500)
        expect(JSON.stringify(session.tree())).toContain(
          copy(env, "where_do_you_need_service")
        )
      } finally {
        session.unmount()
      }
    }
  )
})
