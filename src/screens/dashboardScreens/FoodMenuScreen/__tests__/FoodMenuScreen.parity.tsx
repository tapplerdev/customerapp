/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"
import type { ReactTestInstance } from "react-test-renderer"

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
 * options opens the item), a section pill and the basket bar. Entering the
 * menu sweeps abandoned carts: an hour-old draft goes, another kitchen's
 * fresh one stays.
 *
 * #523 swapped the underline tabs for the shared section pills: the states
 * that draw the menu are captured under ", capped pills" names (a pill's
 * width capped at 70% of the window, so a long title truncates) beside the
 * frozen ones, the uncapped pills (", pills") and the underline tabs
 * (loading and unavailable draw no pills and are unchanged). The pills
 * following the scroll, and a pill's scroll holding them, are behaviour
 * tests: the test renderer lays nothing out, so they hand the list its
 * measurements first.
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
  { name: "menu, no basket, capped pills", base: NO_CART, api: menu() },
  { name: "menu, basket, capped pills", base: withCart(DRAFT_RICH), api: menu() },
  {
    name: "basket, no bottom inset, capped pills",
    base: withCart(DRAFT_RICH),
    api: menu(),
    insets: { bottom: 0 },
  },
  {
    name: "basket, bottom inset 48, capped pills",
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
    name: "no kitchen name, capped pills",
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
        expectParity(parityName("quick add, capped pills", env), session.tree())
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
        expectParity(parityName("trash twice, capped pills", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )

  // The sections laid out as a device would: Mains, Sides and Desserts 700
  // apart under the list's 24-pt top, in a 1900-pt list seen 600 at a time
  // (so it scrolls 1300 at most).
  const TOPS = [24, 724, 1524]
  const measured = async (session: Awaited<ReturnType<typeof open>>) => {
    const list = session.root.find(
      (node) =>
        typeof node.type !== "string" &&
        typeof node.instance?.scrollTo === "function" &&
        !node.props.horizontal
    )
    // The sections' outermost views are the only hosts in it that report
    // their layout (the scroll view's own host aside).
    const sections = list.findAll(
      (node) =>
        typeof node.type === "string" &&
        !!node.props.onLayout &&
        !node.props.onScroll
    )
    expect(sections).toHaveLength(TOPS.length)
    await session.act(
      () => {
        sections.forEach((node, index) => {
          node.props.onLayout({
            nativeEvent: { layout: { x: 0, y: TOPS[index], width: 402, height: 500 } },
          })
        })
        list.props.onLayout({
          nativeEvent: { layout: { x: 0, y: 0, width: 402, height: 600 } },
        })
        list.props.onContentSizeChange(402, 1900)
      },
      0,
      "measure the list"
    )
    return list
  }
  const scrollList = (list: ReactTestInstance, y: number) =>
    list.props.onScroll({ nativeEvent: { contentOffset: { x: 0, y } } })
  const activePill = (root: ReactTestInstance) =>
    root
      .findAll(
        (node) =>
          typeof node.type === "string" &&
          node.props.accessibilityRole === "tab" &&
          node.props.accessibilityState?.selected
      )
      .map((node) =>
        node
          .findAll((n) => String(n.type) === "Text")
          .map((n) => n.children.join(""))
          .join("")
      )

  it.each(envs)(
    "the pill follows the section in view [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      try {
        const list = await measured(session)
        expect(activePill(session.root)).toEqual(["Mains"])
        await session.act(() => scrollList(list, 720), 0, "scroll to Sides")
        expect(activePill(session.root)).toEqual(["Sides"])
        // Desserts can't reach the top: the list's end lights it.
        await session.act(() => scrollList(list, 1300), 0, "scroll to the end")
        expect(activePill(session.root)).toEqual(["Desserts"])
        await session.act(() => scrollList(list, 0), 0, "scroll back up")
        expect(activePill(session.root)).toEqual(["Mains"])
      } finally {
        session.unmount()
      }
    }
  )

  // The list has 24 pt over Mains: its pill goes to the very top, and at the
  // top it doesn't nudge the list.
  it.each(envs)(
    "the first pill scrolls to the list's top, and does nothing there [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      try {
        const list = await measured(session)
        const scrollTo = list.instance.scrollTo as ReturnType<typeof jest.fn>
        scrollTo.mockClear()
        await session.act(() => {
          pressText(session.root, "Mains")
        }, 0, "press Mains at the top")
        expect(scrollTo).not.toHaveBeenCalled()
        await session.act(() => scrollList(list, 900), 0, "scroll down")
        await session.act(() => {
          pressText(session.root, "Mains")
        }, 0, "press Mains")
        expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: true })
        expect(activePill(session.root)).toEqual(["Mains"])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a section pill scrolls the list to its section and holds through the scroll [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      try {
        const list = await measured(session)
        const scrollTo = list.instance.scrollTo as ReturnType<typeof jest.fn>
        scrollTo.mockClear()
        await session.act(() => {
          pressText(session.root, "Desserts")
        }, 0, "press Desserts")
        // As far as the list goes: Desserts' top less what it can't scroll.
        expect(scrollTo).toHaveBeenCalledTimes(1)
        expect(scrollTo).toHaveBeenCalledWith({ y: 1300, animated: true })
        expect(activePill(session.root)).toEqual(["Desserts"])
        // The scroll passes Sides on its way: the pill stays on Desserts.
        await session.act(() => scrollList(list, 800), 0, "the scroll, passing")
        expect(activePill(session.root)).toEqual(["Desserts"])
        // It arrives, and the reader's own scroll is followed again.
        await session.act(() => scrollList(list, 1300), 0, "the scroll, arriving")
        await session.act(() => scrollList(list, 750), 0, "the reader scrolls")
        expect(activePill(session.root)).toEqual(["Sides"])
      } finally {
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
