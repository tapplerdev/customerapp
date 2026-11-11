import { describe, expect, it } from "@jest/globals"

import { openScreen } from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA, urlOf } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { CATEGORY, SERVICE } from "testing/screenKit/fixtures/entities"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * A repost of a fixed-location request (venue-on-job) arrives with the old
 * job's place and venue (useRepostRequest). The venue is kept only while the
 * category still lists it, and goes to the pros listing with its place and
 * without the address. Before, a repost of an Airport Pickup job sent
 * placeOfService=fixedLocations alone, which the server refuses (400): with
 * no venue now, the place is left out and the listing shows everyone who can
 * serve the address, until the question flow asks the venue again.
 */
const load = () => require("../SearchAnimationScreen")

const PARAMS = ROUTE_PARAMS.SearchAnimationScreen as {
  nextParams: Record<string, unknown>
}

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

const open = (
  env: (typeof PARITY_MATRIX)[number],
  fixedLocationId: number | undefined
) =>
  openScreen(load, {
    ...screenState("data"),
    api: {
      ...DATA,
      getServiceById: { data: { ...SERVICE, categories: [AIRPORTS] } },
    },
    lang: env.language,
    platform: env.platform,
    route: {
      name: "SearchAnimationScreen",
      params: {
        nextParams: {
          ...PARAMS.nextParams,
          placeOfService: "fixedLocations",
          ...(fixedLocationId !== undefined && { fixedLocationId }),
          forceQuestionFlow: true,
        },
      },
    },
  })

type Session = Awaited<ReturnType<typeof open>>

const prosAskedFor = (session: Session) =>
  session
    .requests()
    .filter((request) => request.endpoint === "getProsForCategory")
    .map((request) => decodeURIComponent(urlOf(request.args)))

const listingParams = (session: Session) => {
  const replaced = session.navigation.actions.find(
    (action) => action.type === "REPLACE"
  ) as { payload?: { name?: string; params?: Record<string, unknown> } }
  expect(replaced?.payload?.name).toBe("ProsListingScreen")
  return replaced.payload!.params!
}

describe("SearchAnimationScreen: a seeded venue", () => {
  it.each(PARITY_MATRIX)(
    "one the category still lists goes out with its place and without the address [$language $platform]",
    async (env) => {
      const session = await open(env, SPHINX.id)
      try {
        await session.settle(4000)
        const lists = prosAskedFor(session)
        expect(lists).toHaveLength(1)
        expect(lists[0]).toContain("placeOfService=fixedLocations")
        expect(lists[0]).toContain(`fixedLocationId=${SPHINX.id}`)
        expect(lists[0]).not.toContain("customerAddress")
        expect(listingParams(session)).toMatchObject({
          placeOfService: "fixedLocations",
          fixedLocationId: SPHINX.id,
        })
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "one it no longer lists is dropped, and the place goes out only with a venue [$language $platform]",
    async (env) => {
      const session = await open(env, 73)
      try {
        await session.settle(4000)
        const [list] = prosAskedFor(session)
        expect(list).not.toContain("placeOfService")
        expect(list).not.toContain("fixedLocationId")
        expect(list).toContain("customerAddress")
        expect(listingParams(session).fixedLocationId).toBeUndefined()
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "an old job with no venue no longer sends fixedLocations alone [$language $platform]",
    async (env) => {
      const session = await open(env, undefined)
      try {
        await session.settle(4000)
        const [list] = prosAskedFor(session)
        expect(list).not.toContain("placeOfService")
        expect(list).toContain("customerAddress")
        expect(listingParams(session)).toMatchObject({
          placeOfService: "fixedLocations",
          fixedLocationId: undefined,
        })
      } finally {
        session.unmount()
      }
    }
  )
})
