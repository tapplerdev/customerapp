import { describe, expect, it } from "@jest/globals"

import { openScreen } from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA, SERVER_ERROR, urlOf } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { CATEGORY, SERVICE } from "testing/screenKit/fixtures/entities"
import { PARITY_MATRIX } from "testing/hostTreeParity"
import type { BackendFixtures } from "testing/screenKit"

/*
 * Repost and Find other pros arrive here with the old job's place of service
 * (useRepostRequest). One staff have since taken off the category is cleared
 * before the pros are asked for, and the listing opens without it: seeded,
 * it listed nobody and the question was never asked again
 * (mode-mismatch PR 3). The kit's category offers "customerPlace" only.
 */
const load = () => require("../SearchAnimationScreen")

const PARAMS = ROUTE_PARAMS.SearchAnimationScreen as {
  nextParams: Record<string, unknown>
}

const open = (
  env: (typeof PARITY_MATRIX)[number],
  placeOfService: string | undefined,
  api: BackendFixtures = {}
) =>
  openScreen(load, {
    ...screenState("data"),
    api: { ...DATA, ...api },
    lang: env.language,
    platform: env.platform,
    route: {
      name: "SearchAnimationScreen",
      params: {
        nextParams: {
          ...PARAMS.nextParams,
          placeOfService,
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

describe("SearchAnimationScreen: a seeded place of service", () => {
  it.each(PARITY_MATRIX)(
    "one the category no longer offers is cleared before the pros are asked for [$language $platform]",
    async (env) => {
      const session = await open(env, "proToCustomer")
      try {
        await session.settle(4000)
        const lists = prosAskedFor(session)
        expect(lists).toHaveLength(1)
        expect(lists[0]).not.toContain("placeOfService")
        // The address rides along, as on any search with no place yet.
        expect(lists[0]).toContain("customerAddress")
        const params = listingParams(session)
        expect(params.placeOfService).toBeUndefined()
        expect(params.categoryId).toBe(CATEGORY.id)
        expect(params.forceQuestionFlow).toBe(true)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "one it still offers is kept [$language $platform]",
    async (env) => {
      const session = await open(env, "customerPlace")
      try {
        await session.settle(4000)
        const lists = prosAskedFor(session)
        expect(lists).toHaveLength(1)
        expect(lists[0]).toContain("placeOfService=customerPlace")
        expect(listingParams(session).placeOfService).toBe("customerPlace")
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "kept when the service doesn't load: nothing says it is gone [$language $platform]",
    async (env) => {
      const session = await open(env, "proToCustomer", {
        getServiceById: SERVER_ERROR,
      })
      try {
        await session.settle(4000)
        expect(prosAskedFor(session)[0]).toContain(
          "placeOfService=proToCustomer"
        )
        expect(listingParams(session).placeOfService).toBe("proToCustomer")
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a fresh search with no seed is unchanged [$language $platform]",
    async (env) => {
      const session = await open(env, undefined)
      try {
        await session.settle(4000)
        expect(prosAskedFor(session)).toHaveLength(1)
        expect(prosAskedFor(session)[0]).not.toContain("placeOfService")
        expect(listingParams(session).placeOfService).toBeUndefined()
        expect(SERVICE.categories?.[0]?.id).toBe(CATEGORY.id)
      } finally {
        session.unmount()
      }
    }
  )
})
