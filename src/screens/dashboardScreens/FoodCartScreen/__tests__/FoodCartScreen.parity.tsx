/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressTitled,
  renderScreen,
  rowsByPlatform,
  type BackendFixtures,
  type RenderScreenOptions,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { PRO_FOOD } from "testing/screenKit/fixtures/entities"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"

import {
  DRAFT_ONE_LINE,
  DRAFT_PICKUP,
  DRAFT_RICH,
  RICH_MENU,
  cartState,
} from "../../FoodMenuScreen/__fixtures__/food"

/*
 * FoodCartScreen (the basket), captured before its conversion: one line (the
 * delivery fee shows), three lines with options, discounts and a pre-order at
 * the thirty cap (the fee is free, the order discount shows), a pickup
 * basket (no fee row), the menu still loading (no fee, no discount), an
 * empty basket (its Back button), two bottom insets. Presses: back, the
 * trash and plus on a line (plus is dead at thirty), Continue (a Button)
 * and Back.
 */

const load = () => require("../FoodCartScreen")
const route = { name: "FoodCartScreen", params: ROUTE_PARAMS.FoodCartScreen }
const auth = screenState("data").state.auth!
const menu: BackendFixtures = { ...DATA, getProMenu: { data: RICH_MENU } }
const loadingMenu: BackendFixtures = { ...DATA, getProMenu: "loading" }

type Case = {
  name: string
  drafts: (typeof DRAFT_RICH)[]
  api?: BackendFixtures
  insets?: { bottom: number }
}
const CASES: Case[] = [
  { name: "one line, delivery fee", drafts: [DRAFT_ONE_LINE] },
  {
    name: "three lines, free delivery and an order discount",
    drafts: [DRAFT_RICH],
  },
  { name: "pickup", drafts: [DRAFT_PICKUP] },
  { name: "menu still loading", drafts: [DRAFT_ONE_LINE], api: loadingMenu },
  { name: "empty basket", drafts: [] },
  { name: "no bottom inset", drafts: [DRAFT_ONE_LINE], insets: { bottom: 0 } },
  { name: "bottom inset 48", drafts: [DRAFT_ONE_LINE], insets: { bottom: 48 } },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

const options = (
  c: Case,
  env: (typeof PARITY_MATRIX)[number]
): RenderScreenOptions => ({
  state: cartState(auth, c.drafts),
  api: c.api ?? menu,
  lang: env.language,
  platform: env.platform,
  route,
  ...(c.insets ? { insets: c.insets } : {}),
})

describe("FoodCartScreen, captured from the unconverted code", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (c) => {
    expectParity(
      parityName(c.name, c.env),
      await renderScreen(load, options(c, c.env))
    )
  })
})

const envs = rowsByPlatform([{}], PARITY_MATRIX)
const open = (c: Case, env: (typeof PARITY_MATRIX)[number]) =>
  openScreen(load, options(c, env))

const quantities = (store: { getState: () => unknown }) =>
  (
    store.getState() as {
      cart: {
        carts: Record<
          number,
          { items: { menuItemId: number; quantity: number }[] }
        >
      }
    }
  ).cart.carts[PRO_FOOD.id]?.items.map(({ menuItemId, quantity }) => [
    menuItemId,
    quantity,
  ])

describe("FoodCartScreen, the controls", () => {
  it.each(envs)(
    "back and Continue navigate [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      try {
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:chevron-left" })
        })
        await session.act(() => {
          pressTitled(session.root, copy(env, "continue"))
        })
        expect(session.navigation.actions).toMatchObject([
          { type: "GO_BACK" },
          {
            type: "NAVIGATE",
            payload: {
              name: "FoodCheckoutScreen",
              params: { proId: PRO_FOOD.id },
            },
          },
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the trash and plus change a line, and plus is dead at thirty [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[1], env)
      try {
        expect(quantities(session.store)).toEqual([
          [411, 2],
          [412, 1],
          [431, 30],
        ])
        // Steppers in screen order: molokhia, chicken, basbousa.
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:plus", nth: 0 })
        })
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:trash-red", nth: 0 })
        })
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:trash-red", nth: 0 })
        })
        expect(quantities(session.store)).toEqual([
          [411, 1],
          [412, 1],
          [431, 30],
        ])
        expectParity(parityName("molokhia down to one", env), session.tree())
        // A last trash removes the line; at thirty the plus has no handler.
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:trash-red", nth: 1 })
        })
        expect(quantities(session.store)).toEqual([
          [411, 1],
          [431, 30],
        ])
        expect(() =>
          pressIcon(session.root, { icon: "svg:plus", nth: 1 })
        ).toThrow()
        expectParity(parityName("chicken removed", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "Back on an empty basket goes back [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[4], env)
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "back"))
        })
        expect(session.navigation.actions).toMatchObject([{ type: "GO_BACK" }])
      } finally {
        session.unmount()
      }
    }
  )
})
