/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
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
import { pressContaining } from "testing/pressContaining"

import {
  DRAFT_OTHER_PRO,
  DRAFT_RICH,
  DRAFT_STALE,
  RICH_MENU,
} from "../__fixtures__/food"

/*
 * FoodMenuScreen (a kitchen's menu), captured before its conversion: the
 * menu with and without a basket (the bar rides the bottom, at three bottom
 * insets), loading, unavailable (a failed query draws the same), no kitchen name, the quantity strips on the
 * thumbnails, and a press for each control: back, a row, the thumbnail's
 * + and trash (a quick add that needs no choices adds at once, one with
 * options opens the item), a section tab and the basket bar. Entering the
 * menu sweeps abandoned carts: an hour-old draft goes, another kitchen's
 * fresh one stays.
 */

const load = () => require("../FoodMenuScreen")
const PARAMS = ROUTE_PARAMS.FoodMenuScreen!
const route = { name: "FoodMenuScreen", params: PARAMS }

const menu = (answer: BackendFixtures[string] = { data: RICH_MENU }) => ({
  ...DATA,
  getProMenu: answer,
})
const withCart = (...drafts: (typeof DRAFT_RICH)[]) => ({
  ...screenState("data"),
  state: {
    auth: screenState("data").state.auth,
    cart: {
      carts: Object.fromEntries(drafts.map((draft) => [draft.proId, draft])),
      address: null,
    },
  },
})

type Case = {
  name: string
  base: ReturnType<typeof screenState>
  api: BackendFixtures
  params?: object
  insets?: { bottom: number }
}
const NO_CART = screenState("data")
const CASES: Case[] = [
  { name: "menu, no basket", base: NO_CART, api: menu() },
  { name: "menu, basket", base: withCart(DRAFT_RICH), api: menu() },
  {
    name: "basket, no bottom inset",
    base: withCart(DRAFT_RICH),
    api: menu(),
    insets: { bottom: 0 },
  },
  {
    name: "basket, bottom inset 48",
    base: withCart(DRAFT_RICH),
    api: menu(),
    insets: { bottom: 48 },
  },
  { name: "loading", base: NO_CART, api: {} },
  {
    name: "menu unavailable",
    base: NO_CART,
    api: menu({ data: { ...RICH_MENU, menuSections: [] } }),
  },
  {
    name: "no kitchen name",
    base: NO_CART,
    api: menu(),
    params: { ...PARAMS, proName: "" },
  },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

const options = (c: Case, env: (typeof PARITY_MATRIX)[number]) =>
  ({
    ...c.base,
    api: c.api,
    lang: env.language,
    platform: env.platform,
    route: { name: "FoodMenuScreen", params: c.params ?? PARAMS },
    ...(c.insets ? { insets: c.insets } : {}),
  } satisfies RenderScreenOptions)

describe("FoodMenuScreen, captured from the unconverted code", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (c) => {
    expectParity(
      parityName(c.name, c.env),
      await renderScreen(load, options(c, c.env))
    )
  })
})

const envs = rowsByPlatform([{}], PARITY_MATRIX)
const WITH_BASKET = CASES[1]

const open = (c: Case, env: (typeof PARITY_MATRIX)[number]) =>
  openScreen(load, options(c, env))

const cartLines = (store: { getState: () => unknown }, proId: number) =>
  (
    store.getState() as {
      cart: {
        carts: Record<
          number,
          { items: { menuItemId: number; quantity: number }[] }
        >
      }
    }
  ).cart.carts[proId]?.items.map(({ menuItemId, quantity }) => [
    menuItemId,
    quantity,
  ])

describe("FoodMenuScreen, the sweep and the controls", () => {
  it.each(envs)(
    "entering sweeps an hour-old draft and leaves another kitchen's [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(
        {
          name: "sweep",
          base: withCart(DRAFT_STALE, DRAFT_OTHER_PRO),
          api: menu(),
        },
        env
      )
      try {
        expect(cartLines(session.store, PRO_FOOD.id)).toBeUndefined()
        expect(cartLines(session.store, DRAFT_OTHER_PRO.proId)).toEqual([
          [411, 1],
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "back goes back [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
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
    "a row opens the item [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      try {
        await session.act(() => {
          pressContaining(session.root, "Grilled chicken")
        })
        expect(session.navigation.actions).toMatchObject([
          {
            type: "NAVIGATE",
            payload: {
              name: "FoodItemScreen",
              params: { menuItemId: 412, proId: PARAMS.proId },
            },
          },
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a + on an item with options opens the item instead of adding [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      try {
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:plus", nth: 0 })
        })
        expect(session.navigation.actions).toMatchObject([
          {
            type: "NAVIGATE",
            payload: { name: "FoodItemScreen", params: { menuItemId: 411 } },
          },
        ])
        expect(cartLines(session.store, PRO_FOOD.id)).toBeUndefined()
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a + on an item with no choices adds it, and the basket bar appears [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      try {
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:plus", nth: 1 })
        })
        expect(cartLines(session.store, PRO_FOOD.id)).toEqual([[412, 1]])
        expectParity(parityName("quick add", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the trash takes one off the last line of an item [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(WITH_BASKET, env)
      try {
        // Molokhia 2, chicken 1, basbousa 30: the strips come in menu order.
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:trash-red", nth: 0 })
        })
        expect(cartLines(session.store, PRO_FOOD.id)).toEqual([
          [411, 1],
          [412, 1],
          [431, 30],
        ])
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:trash-red", nth: 1 })
        })
        expect(cartLines(session.store, PRO_FOOD.id)).toEqual([
          [411, 1],
          [431, 30],
        ])
        expectParity(parityName("trash twice", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a section tab scrolls the list to its section [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      // The tab's own underline moves in an animation the tree doesn't hold, so
      // the press shows in the list's scrollToIndex.
      const { FlatList } = require("react-native")
      const scrollToIndex = jest
        .spyOn(FlatList.prototype, "scrollToIndex")
        .mockImplementation(() => {})
      try {
        await session.act(() => {
          pressText(session.root, "Sides")
        })
        expect(scrollToIndex).toHaveBeenCalledTimes(1)
        expect(scrollToIndex).toHaveBeenCalledWith({ index: 1, animated: true })
      } finally {
        scrollToIndex.mockRestore()
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the basket bar opens the cart [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(WITH_BASKET, env)
      try {
        await session.act(() => {
          pressContaining(session.root, copy(env, "view_basket"))
        })
        expect(session.navigation.actions).toMatchObject([
          {
            type: "NAVIGATE",
            payload: {
              name: "FoodCartScreen",
              params: { proId: PARAMS.proId },
            },
          },
        ])
      } finally {
        session.unmount()
      }
    }
  )
})
