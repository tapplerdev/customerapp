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
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"

import {
  DRAFT_ONE_LINE,
  DRAFT_PICKUP,
  DRAFT_RICH,
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
      await renderScreen(load, options(c, c.env))
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
        expectParity(parityName("submitting", env), session.tree())
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
        expectParity(parityName("refused", env), session.tree())
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
