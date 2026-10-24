/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen is passed as a loader. */
import { describe, expect, it } from "@jest/globals"
import type { ReactTestInstance } from "react-test-renderer"

import { copy, openScreen, pressTitled, rowsByPlatform } from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import {
  CATEGORY_FOOD,
  PRO_COMPANY,
  PRO_FOOD,
  PRO_INDIVIDUAL,
  SERVICE_FOOD,
} from "testing/screenKit/fixtures/entities"
import { PARITY_MATRIX } from "testing/hostTreeParity"

import { SERVICE_FOOD_FILTERS, SERVICE_PLAIN } from "../__fixtures__/discover"

/*
 * The "best deal" tip (a CoachMark over the first card), which rn-tourguide's
 * tour was before it. These rows keep its trigger rule: it opens half a second
 * after a non-food listing has pros, unless the customer ticked "don't show
 * again" (the store's dontShowBestDealTooltip); never for food. And its
 * lifetime: Got it and Android back close it (what ticking the box then
 * remembers is TooltipComponent's own test).
 *
 * jest never lays a view out, so the card is never measured and the mark
 * stays closed on its own; the rows hand its target a measureInWindow that
 * answers, as a laid-out card would.
 */

const load = () => require("../ProsListingScreen")
const page = (rows: unknown[]) => ({ data: rows, page: 1, perPage: 20, total: rows.length })

const options = (
  env: (typeof PARITY_MATRIX)[number],
  { food = false, dontShow = false }: { food?: boolean; dontShow?: boolean } = {}
) => {
  const base = screenState("data")
  return {
    ...base,
    state: { auth: { ...base.state.auth, dontShowBestDealTooltip: dontShow } },
    api: {
      ...DATA,
      getServiceById: { data: food ? SERVICE_FOOD_FILTERS : SERVICE_PLAIN },
      getProsForCategory: {
        data: page(food ? [PRO_FOOD] : [PRO_INDIVIDUAL, PRO_COMPANY]),
      },
    },
    lang: env.language,
    platform: env.platform,
    route: {
      name: "ProsListingScreen",
      params: food
        ? {
            ...(ROUTE_PARAMS.ProsListingScreen as object),
            categoryId: CATEGORY_FOOD.id,
            categoryName: CATEGORY_FOOD.nameEn,
            serviceId: SERVICE_FOOD.id,
            placeOfService: undefined,
          }
        : ROUTE_PARAMS.ProsListingScreen,
    },
  }
}

/** The CoachMark element: the only one that takes a `target` and a `visible`. */
const mark = (root: ReactTestInstance) => {
  const found = root.findAll(
    (node) =>
      typeof node.type === "function" &&
      node.props.target?.subscribe !== undefined &&
      "visible" in node.props,
    { deep: false }
  )
  expect(found).toHaveLength(1)
  return found[0]
}

const envs = rowsByPlatform([{}], PARITY_MATRIX)

describe("ProsListingScreen, the best-deal tip", () => {
  it.each(envs)(
    "opens for a listing with pros, over the first card [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(load, options(env))
      try {
        expect(mark(session.root).props.visible).toBe(true)
        expect(mark(session.root).props.target.ref.current).not.toBeNull()
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "stays closed once the customer asked not to see it again [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(load, options(env, { dontShow: true }))
      try {
        expect(mark(session.root).props.visible).toBe(false)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "never opens for a food listing [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(load, options(env, { food: true }))
      try {
        expect(mark(session.root).props.visible).toBe(false)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "Android back closes it and remembers nothing [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(load, options(env))
      try {
        const { target } = mark(session.root).props
        // A laid-out card.
        target.ref.current.measureInWindow = (
          cb: (x: number, y: number, w: number, h: number) => void
        ) => cb(16, 200, 358, 400)
        await session.act(() => {
          target.onLayout()
        })
        // The mark is up: its tooltip is the tip's own.
        expect(
          session.root.findAll((n) => n.props.title === copy(env, "got_it")).length
        ).toBeGreaterThan(0)

        await session.act(() => {
          mark(session.root).props.onDismiss()
        })
        expect(mark(session.root).props.visible).toBe(false)
        expect(session.store.getState().auth.dontShowBestDealTooltip).toBe(false)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "Got it closes it, remembering nothing while the box is unticked [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(load, options(env))
      try {
        const { target } = mark(session.root).props
        target.ref.current.measureInWindow = (
          cb: (x: number, y: number, w: number, h: number) => void
        ) => cb(16, 200, 358, 400)
        await session.act(() => {
          target.onLayout()
        })
        await session.act(() => {
          pressTitled(session.root, copy(env, "got_it"))
        })
        expect(mark(session.root).props.visible).toBe(false)
        expect(session.store.getState().auth.dontShowBestDealTooltip).toBe(false)
      } finally {
        session.unmount()
      }
    }
  )
})
