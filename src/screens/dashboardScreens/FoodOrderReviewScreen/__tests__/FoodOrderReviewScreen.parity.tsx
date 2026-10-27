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
import { ADDRESS, ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { JOB_FOOD, PRO_FOOD } from "testing/screenKit/fixtures/entities"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
} from "testing/hostTreeParity"

import {
  DRAFT_ONE_LINE,
  DRAFT_PICKUP,
  DRAFT_RICH,
  DRAFT_RICH_REPRICED,
  DRAFT_RICH_WITHOUT_BASBOUSA,
  MENU_LARGE_DEARER,
  MENU_WITHOUT_BASBOUSA,
  RICH_MENU,
  cartState,
} from "../../FoodMenuScreen/__fixtures__/food"

/*
 * FoodOrderReviewScreen (the last look), captured before its conversion:
 * delivery and pickup, a long basket with options and an order discount, notes,
 * a destination the checkout left blank (the fallback copy), no map
 * position, the menu still loading, an empty basket (Submit is dead), two
 * insets. Presses: back, and Submit Order (a Button): in flight it shows its
 * spinner, on success it clears the basket and goes to the success screen,
 * and a refusal opens the error sheet with the server's words.
 */

// Submit Order was an ActionBtn: Button's listed deltas on every row that draws it
// (in flight, refused, and the empty basket draw them as the others do).
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const load = () => require("../FoodOrderReviewScreen")
const PARAMS = ROUTE_PARAMS.FoodOrderReviewScreen!
const auth = screenState("data").state.auth!
const base: BackendFixtures = { ...DATA, getProMenu: { data: RICH_MENU } }

type Case = {
  name: string
  drafts: (typeof DRAFT_ONE_LINE)[]
  params?: object
  api?: BackendFixtures
  insets?: { bottom: number }
}
const PICKUP = {
  ...PARAMS,
  isPickup: true,
  whereLabel: "Pickup from",
  whereValue: "Dokki, Giza",
  whenValue: "Pick up now",
  paymentLabel: "Cash on pickup",
}
const CASES: Case[] = [
  { name: "delivery", drafts: [DRAFT_ONE_LINE] },
  { name: "pickup", drafts: [DRAFT_PICKUP], params: PICKUP },
  { name: "long basket, order discount, notes", drafts: [DRAFT_RICH] },
  {
    name: "destination left blank",
    drafts: [DRAFT_ONE_LINE],
    params: { ...PARAMS, whereValue: "" },
  },
  {
    name: "pickup, no area",
    drafts: [DRAFT_PICKUP],
    params: { ...PICKUP, whereValue: "", mapCoords: null },
  },
  {
    name: "no map position",
    drafts: [DRAFT_ONE_LINE],
    params: { ...PARAMS, mapCoords: null },
  },
  {
    name: "menu still loading",
    drafts: [DRAFT_ONE_LINE],
    api: { ...DATA, getProMenu: "loading" },
  },
  { name: "empty basket", drafts: [] },
  { name: "no bottom inset", drafts: [DRAFT_ONE_LINE], insets: { bottom: 0 } },
  { name: "bottom inset 48", drafts: [DRAFT_ONE_LINE], insets: { bottom: 48 } },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

type Env = (typeof PARITY_MATRIX)[number]
const options = (
  c: Case,
  env: Env,
  extra: BackendFixtures = {}
): RenderScreenOptions => ({
  state: cartState(auth, c.drafts, ADDRESS),
  api: { ...(c.api ?? base), ...extra },
  lang: env.language,
  platform: env.platform,
  route: { name: "FoodOrderReviewScreen", params: c.params ?? PARAMS },
  ...(c.insets ? { insets: c.insets } : {}),
})

describe("FoodOrderReviewScreen, captured from the unconverted code", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (c) => {
    expectParity(
      parityName(c.name, c.env),
      await renderScreen(load, options(c, c.env)),
      { allow: BUTTON }
    )
  })
})

const envs = rowsByPlatform([{}], PARITY_MATRIX)
const submitButton = (
  root: import("react-test-renderer").ReactTestInstance,
  env: Env
) => {
  const found = root.findAll(
    (node) => node.props.title === copy(env, "submit_order"),
    { deep: false }
  )
  expect(found).toHaveLength(1)
  return found[0]
}

describe("FoodOrderReviewScreen, the controls", () => {
  it.each(envs)(
    "back goes back [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(load, options(CASES[0], env))
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
    "Submit Order shows its spinner while the order is sent [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(
        load,
        options(CASES[0], env, { createJob: "loading" })
      )
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "submit_order"))
        })
        expectParity(parityName("submitting", env), session.tree(), {
          allow: BUTTON,
        })
        const sent = session
          .requests()
          .filter((r) => r.endpoint === "createJob")
        expect(sent).toHaveLength(1)
        expect(sent[0].args).toMatchObject({
          method: "POST",
          body: { prosIds: [PRO_FOOD.id], paymentMethod: "cash" },
        })
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a sent order clears the basket and opens the success screen [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(
        load,
        options(CASES[0], env, { createJob: { data: JOB_FOOD } })
      )
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "submit_order"))
        })
        expect(
          (session.store.getState() as { cart: { carts: object } }).cart.carts
        ).toEqual({})
        expect(session.navigation.actions).toMatchObject([
          {
            type: "NAVIGATE",
            payload: {
              name: "RequestSuccessScreen",
              params: { address: { address: ADDRESS.address } },
            },
          },
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a refused order opens the error sheet with the server's words [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(
        load,
        options(CASES[0], env, {
          createJob: {
            error: {
              status: 400,
              data: {
                validationErrors: { items: ["Grilled chicken is sold out"] },
              },
            },
          },
        })
      )
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "submit_order"))
        })
        expectParity(parityName("refused", env), session.tree(), {
          allow: BUTTON,
        })
        expect(JSON.stringify(session.tree())).toContain(
          "Grilled chicken is sold out"
        )
        // The basket is still there for another try.
        expect(
          Object.keys(
            (session.store.getState() as { cart: { carts: object } }).cart.carts
          )
        ).toEqual([String(PRO_FOOD.id)])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "Submit Order is dead with an empty basket [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(load, options(CASES[7], env))
      try {
        const button = submitButton(session.root, env)
        // Disabled: a tap does nothing, whatever handler is set.
        const { disable, disabled, accessibilityState } = button.props as {
          disable?: boolean
          disabled?: boolean
          accessibilityState?: { disabled?: boolean }
        }
        expect(
          disable === true ||
            disabled === true ||
            accessibilityState?.disabled === true
        ).toBe(true)
        expect(() =>
          pressTitled(session.root, copy(env, "submit_order"))
        ).toThrow(/disabled/)
      } finally {
        session.unmount()
      }
    }
  )
})

/*
 * A menu that moved under the basket (Trello #513, Phase 3c). The order check
 * refuses; the screen refetches the menu, repairs the basket, and says so in
 * the error pop-up. It never sends the order again on its own.
 */
const MENU_CHANGED = {
  status: 400,
  data: {
    code: "FOOD_ORDER_MENU_CHANGED",
    validationErrors: {
      foodOrderItems: ["order items don't match the pro's current menu"],
    },
  },
}
// A backend from before the code: only the field's name says it.
const MENU_CHANGED_OLD_BACKEND = {
  status: 400,
  data: { validationErrors: MENU_CHANGED.data.validationErrors },
}

/** The menu as the screen first loads it, then as the pro left it. */
const menuThenMenu = (later: unknown) => {
  let asked = 0
  return () => ({ data: (asked++ === 0 ? RICH_MENU : later) as object })
}

type CartShape = {
  cart: {
    carts: Record<
      number,
      { items: { menuItemId: number; price: number; quantity: number }[] }
    >
  }
}
const basket = (store: { getState: () => unknown }) =>
  (store.getState() as CartShape).cart.carts[PRO_FOOD.id]?.items

const sentOrders = (session: { requests: () => { endpoint: string }[] }) =>
  session.requests().filter((r) => r.endpoint === "createJob")

describe("FoodOrderReviewScreen, a menu that moved under the basket", () => {
  it.each(envs)(
    "menu changed: repriced [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(
        load,
        options({ ...CASES[2] }, env, {
          createJob: { error: MENU_CHANGED },
          getProMenu: menuThenMenu(MENU_LARGE_DEARER),
        })
      )
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "submit_order"))
        })
        expectParity(parityName("menu changed: repriced", env), session.tree(), {
          allow: BUTTON,
        })
        expect(JSON.stringify(session.tree())).toContain(
          copy(env, "food_menu_changed_repriced")
        )
        // The pop-up says the menu changed, not "Error", and draws a warning.
        expect(JSON.stringify(session.tree())).toContain(
          copy(env, "food_menu_changed_title")
        )
        expect(JSON.stringify(session.tree())).toContain("svg:warning-triangle")
        expect(basket(session.store)).toEqual(DRAFT_RICH_REPRICED.items)
        // One send, the refused one. The repair never sends another.
        expect(sentOrders(session)).toHaveLength(1)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "menu changed: items removed [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(
        load,
        options({ ...CASES[2] }, env, {
          createJob: { error: MENU_CHANGED },
          getProMenu: menuThenMenu(MENU_WITHOUT_BASBOUSA),
        })
      )
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "submit_order"))
        })
        expectParity(
          parityName("menu changed: items removed", env),
          session.tree(),
          { allow: BUTTON }
        )
        expect(JSON.stringify(session.tree())).toContain(
          copy(env, "food_menu_changed_removed")
        )
        expect(basket(session.store)).toEqual(DRAFT_RICH_WITHOUT_BASBOUSA.items)
        expect(sentOrders(session)).toHaveLength(1)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a backend without the code is repaired the same way [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(
        load,
        options({ ...CASES[2] }, env, {
          createJob: { error: MENU_CHANGED_OLD_BACKEND },
          getProMenu: menuThenMenu(MENU_LARGE_DEARER),
        })
      )
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "submit_order"))
        })
        expect(JSON.stringify(session.tree())).toContain(
          copy(env, "food_menu_changed_repriced")
        )
        expect(basket(session.store)).toEqual(DRAFT_RICH_REPRICED.items)
        expect(sentOrders(session)).toHaveLength(1)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a menu that agrees with the basket leaves the server's words [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(
        load,
        options({ ...CASES[2] }, env, {
          createJob: { error: MENU_CHANGED },
          getProMenu: { data: RICH_MENU },
        })
      )
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "submit_order"))
        })
        expect(JSON.stringify(session.tree())).toContain(
          "order items don't match the pro's current menu"
        )
        // Not the repair's pop-up: the usual Error title, no warning.
        expect(JSON.stringify(session.tree())).not.toContain(
          copy(env, "food_menu_changed_title")
        )
        expect(JSON.stringify(session.tree())).not.toContain(
          "svg:warning-triangle"
        )
        expect(basket(session.store)).toEqual(DRAFT_RICH.items)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a menu that will not load leaves the server's words [$env.language $env.platform]",
    async ({ env }) => {
      let asked = 0
      const session = await openScreen(
        load,
        options({ ...CASES[2] }, env, {
          createJob: { error: MENU_CHANGED },
          getProMenu: () =>
            asked++ === 0
              ? { data: RICH_MENU }
              : { error: { status: 500, data: {} } },
        })
      )
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "submit_order"))
        })
        expect(JSON.stringify(session.tree())).toContain(
          "order items don't match the pro's current menu"
        )
        expect(basket(session.store)).toEqual(DRAFT_RICH.items)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the second Submit sends the repaired lines [$env.language $env.platform]",
    async ({ env }) => {
      let sent = 0
      const session = await openScreen(
        load,
        options({ ...CASES[2] }, env, {
          createJob: () =>
            sent++ === 0 ? { error: MENU_CHANGED } : { data: JOB_FOOD },
          getProMenu: menuThenMenu(MENU_LARGE_DEARER),
        })
      )
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "submit_order"))
        })
        await session.act(() => {
          pressTitled(session.root, copy(env, "OK"))
        })
        await session.act(() => {
          pressTitled(session.root, copy(env, "submit_order"))
        })
        const orders = sentOrders(session) as unknown as {
          args: { body: { foodOrderItems: { name: string; selectedOptions?: { choices: { price: number }[] }[] }[] } }
        }[]
        expect(orders).toHaveLength(2)
        // First the lines the customer built, then the repaired ones.
        expect(
          orders[0].args.body.foodOrderItems[0].selectedOptions![0].choices[0].price
        ).toBe(25)
        expect(
          orders[1].args.body.foodOrderItems[0].selectedOptions![0].choices[0].price
        ).toBe(35)
        expect(session.navigation.actions).toMatchObject([
          { type: "NAVIGATE", payload: { name: "RequestSuccessScreen" } },
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a dish given a new id by an approval is repaired, and the pop-up says the menu was updated [$env.language $env.platform]",
    async ({ env }) => {
      const reIded = {
        ...RICH_MENU,
        menuSections: RICH_MENU.menuSections.map((section) => ({
          ...section,
          menuItems: section.menuItems.map((item) => ({
            ...item,
            id: item.id + 1000,
          })),
        })),
      }
      const session = await openScreen(
        load,
        options({ ...CASES[2] }, env, {
          createJob: { error: MENU_CHANGED },
          getProMenu: menuThenMenu(reIded),
        })
      )
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "submit_order"))
        })
        expect(JSON.stringify(session.tree())).toContain(
          copy(env, "food_menu_changed_updated")
        )
        expect(basket(session.store)?.map((l) => l.menuItemId)).toEqual([
          1411, 1412, 1431,
        ])
        expect(sentOrders(session)).toHaveLength(1)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "nothing left in the basket: its own message, then back to the restaurant's menu [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(
        load,
        options({ ...CASES[2] }, env, {
          createJob: { error: MENU_CHANGED },
          getProMenu: menuThenMenu({ ...RICH_MENU, menuSections: [] }),
        })
      )
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "submit_order"))
        })
        expect(JSON.stringify(session.tree())).toContain(
          copy(env, "food_menu_changed_emptied")
        )
        expect(basket(session.store)).toBeUndefined()
        expect(sentOrders(session)).toHaveLength(1)
        // Still here while the pop-up is up.
        expect(session.navigation.actions).toEqual([])

        // iOS ends a present on a 2 s backstop under jest, and a close waits
        // for it (the kit's Step.settleMs says so).
        await session.act(() => {
          pressTitled(session.root, copy(env, "OK"))
        }, 2500)
        expect(session.navigation.actions).toMatchObject([
          {
            type: "POP_TO",
            payload: {
              name: "FoodMenuScreen",
              params: {
                proId: PRO_FOOD.id,
                serviceCategoryId: DRAFT_RICH.serviceCategoryId,
                serviceId: DRAFT_RICH.serviceId,
                proName: DRAFT_RICH.proName,
                categoryName: DRAFT_RICH.categoryName,
                fulfillmentMode: "delivery",
              },
            },
          },
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a basket that was only repriced stays on Order Review when the pop-up closes [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(
        load,
        options({ ...CASES[2] }, env, {
          createJob: { error: MENU_CHANGED },
          getProMenu: menuThenMenu(MENU_LARGE_DEARER),
        })
      )
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "submit_order"))
        })
        await session.act(() => {
          pressTitled(session.root, copy(env, "OK"))
        }, 2500)
        expect(session.navigation.actions).toEqual([])
      } finally {
        session.unmount()
      }
    }
  )
})
