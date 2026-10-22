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
  type RenderScreenOptions,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { PRO_FOOD } from "testing/screenKit/fixtures/entities"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
} from "testing/hostTreeParity"

import {
  RICH_MENU,
  checkedBoxes,
  pressCheckbox,
} from "../../FoodMenuScreen/__fixtures__/food"

/*
 * FoodItemScreen (one dish), captured before its conversion: a dish with a
 * required single choice and optional extras, a discounted one with no
 * choices, a pre-order one (its badge), one with no price, photo or
 * description, loading, unavailable (a dish the menu doesn't hold), two
 * insets (the gap under the footer is 45 whatever the inset up to 45, so a
 * zero bottom inset would draw what the default does: only 48 is a row, and
 * a zero top inset), and a customer who has chosen. Presses: close, the
 * choices, the stepper (minus is dead at one), Add to cart (dead until the
 * required choice is made; it adds the line and goes back) and Back.
 */

// The Add to cart, pre-order badge and Back buttons were ActionBtns: Button's
// listed deltas, per state. A disabled Add to cart (the required choice is
// not made yet) shows the disabled view flag instead of the accessibility
// props; the loading row draws none.
const ENABLED: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]
const DISABLED: ParityAllowance[] = ["buttonHeight", "buttonDisabledView"]

const load = () => require("../FoodItemScreen")
const BASE = ROUTE_PARAMS.FoodItemScreen!
const api = { ...DATA, getProMenu: { data: RICH_MENU } }

type Case = {
  name: string
  menuItemId: number
  api?: typeof api | Record<string, never>
  insets?: { top?: number; bottom?: number }
  allow?: ParityAllowance[]
}
const CASES: Case[] = [
  { name: "options", menuItemId: 411, allow: DISABLED },
  { name: "discount, no options", menuItemId: 412, allow: ENABLED },
  { name: "pre-order", menuItemId: 431, allow: ENABLED },
  { name: "no price, photo or description", menuItemId: 421, allow: ENABLED },
  { name: "loading", menuItemId: 411, api: {} },
  { name: "unavailable", menuItemId: 999, allow: ENABLED },
  {
    name: "options, bottom inset 48",
    menuItemId: 411,
    insets: { bottom: 48 },
    allow: DISABLED,
  },
  {
    name: "options, no top inset",
    menuItemId: 411,
    insets: { top: 0 },
    allow: DISABLED,
  },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

const options = (
  c: Case,
  env: (typeof PARITY_MATRIX)[number]
): RenderScreenOptions => ({
  ...screenState("data"),
  api: c.api ?? api,
  lang: env.language,
  platform: env.platform,
  route: {
    name: "FoodItemScreen",
    params: { ...BASE, menuItemId: c.menuItemId },
  },
  ...(c.insets ? { insets: c.insets } : {}),
})

describe("FoodItemScreen, captured from the unconverted code", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (c) => {
    expectParity(
      parityName(c.name, c.env),
      await renderScreen(load, options(c, c.env)),
      { allow: c.allow }
    )
  })
})

const envs = rowsByPlatform([{}], PARITY_MATRIX)
const open = (env: (typeof PARITY_MATRIX)[number], c: Case = CASES[0]) =>
  openScreen(load, options(c, env))

const lines = (store: { getState: () => unknown }) =>
  (
    store.getState() as {
      cart: { carts: Record<number, { items: unknown[] }> }
    }
  ).cart.carts[PRO_FOOD.id]?.items

describe("FoodItemScreen, choosing and adding", () => {
  it.each(envs)(
    "the required choice, extras and the stepper change what is drawn [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env)
      try {
        // Boxes in screen order: Regular, Large, Extra bread, Pickles, Garlic sauce.
        expect(checkedBoxes(session.root)).toEqual([
          false,
          false,
          false,
          false,
          false,
        ])
        await session.act(() => {
          pressCheckbox(session.root, 1)
        })
        expect(checkedBoxes(session.root)).toEqual([
          false,
          true,
          false,
          false,
          false,
        ])
        expectParity(parityName("Large chosen", env), session.tree(), {
          allow: ENABLED,
        })

        // A single-choice group swaps its pick.
        await session.act(() => {
          pressCheckbox(session.root, 0)
        })
        expect(checkedBoxes(session.root)).toEqual([
          true,
          false,
          false,
          false,
          false,
        ])

        await session.act(() => {
          pressCheckbox(session.root, 2)
          pressCheckbox(session.root, 4)
        })
        expect(checkedBoxes(session.root)).toEqual([
          true,
          false,
          true,
          false,
          true,
        ])
        // Chosen again, an extra goes.
        await session.act(() => {
          pressCheckbox(session.root, 2)
        })
        expect(checkedBoxes(session.root)).toEqual([
          true,
          false,
          false,
          false,
          true,
        ])
        expectParity(
          parityName("Regular and garlic sauce", env),
          session.tree(),
          { allow: ENABLED }
        )

        // Minus does nothing at one; plus counts up, minus counts down.
        expect(() => pressIcon(session.root, { icon: "svg:minus" })).toThrow()
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:plus" })
        })
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:plus" })
        })
        expectParity(parityName("count three", env), session.tree(), {
          allow: ENABLED,
        })
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:minus" })
        })
        expectParity(parityName("count two", env), session.tree(), {
          allow: ENABLED,
        })
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "Add to cart is dead until the required choice is made, then adds the line and goes back [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env)
      // The button's title carries the price, so find it by the words before it.
      const prefix = copy(env, "add_to_cart_for_egp_count").split("{{")[0]
      const addButton = () => {
        const found = session.root.findAll(
          (node) =>
            typeof node.props.title === "string" &&
            node.props.title.startsWith(prefix),
          { deep: false }
        )
        expect(found).toHaveLength(1)
        return found[0]
      }
      try {
        expect(addButton().props.onPress).toBeUndefined()
        await session.act(() => {
          pressCheckbox(session.root, 1)
          pressIcon(session.root, { icon: "svg:plus" })
        })
        expect(typeof addButton().props.onPress).toBe("function")
        await session.act(() => {
          addButton().props.onPress()
        })
        expect(lines(session.store)).toMatchObject([
          {
            menuItemId: 411,
            quantity: 2,
            price: 185,
            selectedOptions: [
              { optionName: "Size", choices: [{ name: "Large" }] },
            ],
          },
        ])
        expect(session.navigation.actions).toMatchObject([{ type: "GO_BACK" }])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "close goes back [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env)
      try {
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:close" })
        })
        expect(session.navigation.actions).toMatchObject([{ type: "GO_BACK" }])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "Back on the unavailable screen goes back [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(env, CASES[5])
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
