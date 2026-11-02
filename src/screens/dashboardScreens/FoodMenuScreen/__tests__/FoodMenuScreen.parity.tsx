 
import { describe, expect, it, jest } from "@jest/globals"
import { StyleSheet } from "react-native"
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
 *
 * #523 pass 2 put the kitchen's collapsing header over the list (the pro's
 * profile photo as the cover, the name, rating and delivery terms, then the
 * pills with a sections button and a sliding highlight). Every state is
 * drawn again under ", hero a11y" names (", hero" before the
 * review: the folded bar now takes taps and the screen reader skips the
 * text it hides) beside the frozen ones, plus the header's
 * own states: no photo and no reviews, pickup only, the profile still
 * loading, and the sections sheet open. The fold, the highlight's slide and
 * the stretch run on the UI thread and draw nothing here; the header's
 * layout reaching the spy (a tapped section lands under the folded header)
 * and the sheet's rows are behaviour tests below.
 *
 * Shared 18bbeaa drew the pills as white chips with a soft shadow under the
 * sliding red shape, the selected title turning white on it (the white copy
 * of the titles inside the shape went). Every state that draws the pills is
 * drawn again under ", white chips" names beside the frozen ", hero a11y"
 * ones; loading and unavailable draw no pills and kept their names.
 */

const load = () => require("../FoodMenuScreen")
const PARAMS = ROUTE_PARAMS.FoodMenuScreen!

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
  { name: "menu, no basket, hero a11y, white chips", base: NO_CART, api: menu() },
  { name: "menu, basket, hero a11y, white chips", base: withCart(DRAFT_RICH), api: menu() },
  {
    name: "basket, no bottom inset, hero a11y, white chips",
    base: withCart(DRAFT_RICH),
    api: menu(),
    insets: { bottom: 0 },
  },
  {
    name: "basket, bottom inset 48, hero a11y, white chips",
    base: withCart(DRAFT_RICH),
    api: menu(),
    insets: { bottom: 48 },
  },
  { name: "loading, hero a11y", base: NO_CART, api: {} },
  {
    name: "menu unavailable, hero a11y",
    base: NO_CART,
    api: menu({ data: { ...RICH_MENU, menuSections: [] } }),
  },
  {
    name: "no kitchen name, hero a11y, white chips",
    base: NO_CART,
    api: menu(),
    params: { ...PARAMS, proName: "" },
  },
  {
    name: "no photo, no reviews, hero a11y, white chips",
    base: NO_CART,
    api: {
      ...menu(),
      getProProfile: {
        data: { ...PRO_FOOD, profilePhoto: undefined, reviewScore: undefined },
      },
    },
  },
  {
    name: "pickup only, hero a11y, white chips",
    base: NO_CART,
    api: menu({
      data: { ...RICH_MENU, isDeliveryEnabled: false, isPickupEnabled: true },
    }),
  },
  {
    // The cover can't stay grey: the kitchen's initial instead.
    name: "profile failed, hero a11y, white chips",
    base: NO_CART,
    api: {
      ...menu(),
      getProProfile: { error: { status: 500, data: {} } },
    },
  },
  {
    name: "profile still loading, hero a11y, white chips",
    base: NO_CART,
    // No answer for the profile: it stays loading.
    api: (() => {
      const api: BackendFixtures = { ...menu() }
      delete api.getProProfile
      return api
    })(),
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
        expectParity(parityName("quick add, hero a11y, white chips", env), session.tree())
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
        expectParity(parityName("trash twice, hero a11y, white chips", env), session.tree())
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

  // #523 pass 2: the header measured as a device would (a 360-pt hero with a
  // 96-pt info block over a 52-pt pill bar). The list moves down under it,
  // and a tapped section lands under the folded header (the status bar, the
  // 48-pt compact bar and the pills), not under the screen's top.
  const HERO = 360
  const INFO = 96
  const PILLS = 52
  const measureHeader = async (session: Awaited<ReturnType<typeof open>>) => {
    const hosts = (node: ReactTestInstance) => typeof node.type === "string"
    // The hero lets touches through: the one host with a layout and no touches.
    const hero = session.root.find(
      (node) =>
        hosts(node) && !!node.props.onLayout && node.props.pointerEvents === "none"
    )
    const info = hero.findAll(
      (node) => node !== hero && hosts(node) && !!node.props.onLayout
    )
    expect(info).toHaveLength(1)
    // The pill bar's wrapper: the first host above the pills' row with a layout.
    const row = session.root.find(
      (node) =>
        !hosts(node) &&
        typeof node.instance?.scrollTo === "function" &&
        !!node.props.horizontal
    )
    let pills = row.parent
    while (pills && !(hosts(pills) && pills.props.onLayout)) pills = pills.parent
    expect(pills).toBeTruthy()
    const layout = (height: number) => ({
      nativeEvent: { layout: { x: 0, y: 0, width: 402, height } },
    })
    await session.act(
      () => {
        hero.props.onLayout(layout(HERO))
        info[0].props.onLayout(layout(INFO))
        pills!.props.onLayout(layout(PILLS))
      },
      0,
      "measure the header"
    )
  }
  const topInset = (env: (typeof PARITY_MATRIX)[number]) =>
    env.platform === "ios" ? 62 : 24

  it.each(envs)(
    "the list sits under the header, and a pill lands its section under the folded header [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      try {
        await measureHeader(session)
        const list = await measured(session)
        expect(StyleSheet.flatten(list.props.contentContainerStyle).paddingTop).toBe(HERO + PILLS + 24)
        // Taller than its 600-pt view, so it can always scroll a whole fold.
        expect(StyleSheet.flatten(list.props.contentContainerStyle).minHeight).toBe(
          600 + HERO - (topInset(env) + 48)
        )
        const scrollTo = list.instance.scrollTo as ReturnType<typeof jest.fn>
        scrollTo.mockClear()
        await session.act(() => {
          pressText(session.root, "Sides")
        }, 0, "press Sides")
        const sticky = topInset(env) + 48 + PILLS
        expect(scrollTo).toHaveBeenCalledWith({ y: TOPS[1] - sticky, animated: true })
        expect(activePill(session.root)).toEqual(["Sides"])
        // And the reader's scroll counts a section reached under the header.
        await session.act(() => scrollList(list, TOPS[1] - sticky), 0, "arrive")
        await session.act(() => list.props.onScrollBeginDrag(), 0, "grab")
        await session.act(
          () => scrollList(list, TOPS[1] - sticky - 30),
          0,
          "Sides back under the anchor line"
        )
        expect(activePill(session.root)).toEqual(["Mains"])
      } finally {
        session.unmount()
      }
    }
  )

  // The sections button: a sheet with every section; a row is a pill tap.
  const sheetRows = (root: ReactTestInstance) =>
    root.findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props.accessibilityRole === "button" &&
        node.props.accessibilityState?.selected !== undefined
    )
  const sheetOf = (root: ReactTestInstance) =>
    root.find(
      (node) =>
        typeof node.type !== "string" &&
        (node.type as { name?: string }).name === "NativeActionSheet"
    )

  it.each(envs)(
    "the sections button lists every section, and a row jumps there and closes the sheet [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      try {
        const list = await measured(session)
        expect(sheetRows(session.root)).toHaveLength(0)
        expect(sheetOf(session.root).props.isVisible).toBe(false)
        const button = session.root.findAll(
          (node) =>
            node.props.accessibilityLabel === copy(env, "menu_sections") &&
            typeof node.props.onPress === "function"
        )
        expect(button.length).toBeGreaterThan(0)
        await session.act(() => {
          button[0].props.onPress()
        }, 0, "open the sheet")
        expect(sheetOf(session.root).props.isVisible).toBe(true)
        expect(
          sheetRows(session.root).map((row) =>
            row
              .findAll((n) => String(n.type) === "Text")
              .map((n) => n.children.join(""))
              .join("")
          )
        ).toEqual(["Mains", "Sides", "Desserts"])
        expectParity(parityName("sections sheet, hero a11y, white chips", env), session.tree())
        const scrollTo = list.instance.scrollTo as ReturnType<typeof jest.fn>
        scrollTo.mockClear()
        // The row's own control (the pill shows the same title).
        const dessertsRow = session.root.findAll(
          (node) =>
            typeof node.type !== "string" &&
            typeof node.props.onPress === "function" &&
            node.props.accessibilityRole === "button" &&
            node.props.accessibilityState?.selected !== undefined &&
            node
              .findAll((n) => String(n.type) === "Text")
              .some((n) => n.children.join("") === "Desserts")
        )
        expect(dessertsRow.length).toBeGreaterThan(0)
        await session.act(() => dessertsRow[0].props.onPress(), 0, "pick Desserts")
        expect(scrollTo).toHaveBeenCalledWith({ y: 1300, animated: true })
        expect(activePill(session.root)).toEqual(["Desserts"])
        expect(sheetOf(session.root).props.isVisible).toBe(false)
      } finally {
        session.unmount()
      }
    }
  )

  // Folded, the white compact bar takes the taps over it, so a press there
  // can't reach a menu row (an item, or its "+") scrolled under it. The test
  // renderer has no hit-testing: what it can see is the bar's fill turning
  // from see-through (pointerEvents none) to a touch target (auto), over the
  // list. And the screen reader moves from the hero's info to the bar.
  const barFill = (root: ReactTestInstance) =>
    root.find((node) => {
      if (typeof node.type !== "string") return false
      const style = StyleSheet.flatten(node.props.style) ?? {}
      return (
        style.position === "absolute" &&
        style.top === 0 &&
        style.bottom === 0 &&
        style.backgroundColor === "#FFFFFF" &&
        (node.props.pointerEvents === "auto" || node.props.pointerEvents === "none")
      )
    })
  // Every text the screen reader skips.
  const hiddenTexts = (root: ReactTestInstance) =>
    root
      .findAll(
        (node) =>
          typeof node.type === "string" &&
          node.props.importantForAccessibility === "no-hide-descendants"
      )
      .flatMap((node) =>
        node
          .findAll((n) => String(n.type) === "Text")
          .map((n) => n.children.join(""))
      )

  it.each(envs)(
    "the folded bar takes the taps over it, and the screen reader moves to it [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      try {
        await measureHeader(session)
        const list = await measured(session)
        const collapse = HERO - (topInset(env) + 48)
        expect(barFill(session.root).props.pointerEvents).toBe("none")
        // Open: only the bar's (invisible) title is skipped.
        expect(hiddenTexts(session.root)).toEqual(["Laila's Kitchen"])
        await session.act(() => scrollList(list, collapse + 100), 0, "fold")
        expect(barFill(session.root).props.pointerEvents).toBe("auto")
        // The bar's title speaks now; the hero's name, faded under it, doesn't.
        const names = session.root
          .findAll((n) => String(n.type) === "Text" && n.children.join("") === "Laila's Kitchen")
        expect(names.length).toBe(2)
        expect(hiddenTexts(session.root)).toContain("Laila's Kitchen")
        expect(hiddenTexts(session.root).length).toBeGreaterThan(1)
        await session.act(() => scrollList(list, 0), 0, "open")
        expect(barFill(session.root).props.pointerEvents).toBe("none")
      } finally {
        session.unmount()
      }
    }
  )
})
