/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"
import type { ReactTestInstance } from "react-test-renderer"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
  pressTitled,
  renderScreen,
  rowsByPlatform,
  typeInto,
  type BackendFixtures,
  type RenderScreenOptions,
} from "testing/screenKit"
import { guestState, screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import { ADDRESS, ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import {
  CATEGORY_FOOD,
  PRO_FOOD,
  SERVICE_FOOD,
} from "testing/screenKit/fixtures/entities"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
} from "testing/hostTreeParity"
import { pressContaining } from "testing/pressContaining"

import {
  DRAFT_ONE_LINE,
  DRAFT_PICKUP,
  DRAFT_RICH,
  RICH_MENU,
  cartState,
} from "../../FoodMenuScreen/__fixtures__/food"

/*
 * FoodCheckoutScreen, captured before its conversion: delivery and pickup
 * (the mode selector only when the kitchen offers both), with and without an
 * address, out of the delivery zone (both exits, or only one), out of
 * pickup range, a category that schedules, a basket that needs notice
 * (steering to scheduling, or the pro confirming), one payment method or
 * two, the kitchen's hours, everything still loading, an empty basket, two
 * insets. Presses: back, the mode buttons, the address card (opens the
 * address sheet), the payment rows, Schedule (opens the calendar sheet),
 * typing the order notes, the zone banner's two buttons, and Review order
 * (a Button: dead until the order can be sent, then it hands the review
 * screen its payload, or sends a guest to sign in).
 */

// Review order was an ActionBtn: Button's listed deltas, per state. Where the
// order can't be sent yet (no address, out of range, not scheduled, an empty
// basket) the button is dead and shows the disabled view flag instead of the
// accessibility props.
const ENABLED: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]
const DISABLED: ParityAllowance[] = ["buttonHeight", "buttonDisabledView"]

const load = () => require("../FoodCheckoutScreen")
const PARAMS = ROUTE_PARAMS.FoodCheckoutScreen
const auth = screenState("data").state.auth!
const guestAuth = guestState("data").state.auth!

const MONDAY_TO_SUNDAY_TUESDAY = [
  { id: 3, dayOfWeek: "tuesday", openingTime: "09:00", closingTime: "22:00" },
]
const CASH_ONLY = {
  ...PRO_FOOD,
  paymentMethods: ["cash"],
  hours: MONDAY_TO_SUNDAY_TUESDAY,
}
const service = (dateTypes: string[]) => ({
  ...SERVICE_FOOD,
  categories: [{ ...CATEGORY_FOOD, dateTypes }],
})
const check = (deliverable: boolean, pickupReachable: boolean) => ({
  data: {
    deliverable,
    deliveryRadius: 10,
    pickupReachable,
    pickupRadius: null,
  },
})
// The draft's own pro and category: the screen asks for these exact arguments.
const KITCHEN = { proId: PRO_FOOD.id, serviceCategoryId: CATEGORY_FOOD.id }
const WARM = [
  { endpoint: "getProMenu", args: KITCHEN, data: RICH_MENU },
  { endpoint: "getProProfile", args: KITCHEN, data: PRO_FOOD },
]
const api = (over: BackendFixtures = {}): BackendFixtures => ({
  ...DATA,
  getProMenu: { data: RICH_MENU },
  getProProfile: { data: PRO_FOOD },
  getServiceById: { data: service([]) },
  ...over,
})

type Case = {
  name: string
  drafts: (typeof DRAFT_ONE_LINE)[]
  api?: BackendFixtures
  address?: typeof ADDRESS | null
  insets?: { bottom: number }
  /** The kitchen's menu and profile already in the cache, as a visit from its menu leaves them. */
  warm?: boolean
  allow: ParityAllowance[]
}
const CASES: Case[] = [
  {
    name: "delivery, address, both modes",
    drafts: [DRAFT_ONE_LINE],
    api: api(),
    allow: ENABLED,
  },
  {
    name: "no address",
    drafts: [DRAFT_ONE_LINE],
    api: api(),
    address: null,
    allow: DISABLED,
  },
  {
    name: "pickup",
    drafts: [DRAFT_PICKUP],
    api: api(),
    warm: true,
    allow: ENABLED,
  },
  {
    name: "out of the delivery zone, pickup reachable",
    drafts: [DRAFT_ONE_LINE],
    api: api({ checkDelivery: check(false, true) }),
    allow: DISABLED,
  },
  {
    name: "out of the zone and out of pickup range",
    drafts: [DRAFT_ONE_LINE],
    api: api({ checkDelivery: check(false, false) }),
    allow: DISABLED,
  },
  {
    name: "pickup out of range, delivery reachable",
    drafts: [DRAFT_PICKUP],
    api: api({ checkDelivery: check(true, false) }),
    warm: true,
    allow: DISABLED,
  },
  {
    name: "a category that schedules",
    drafts: [DRAFT_ONE_LINE],
    api: api({ getServiceById: { data: service(["asap", "date"]) } }),
    allow: ENABLED,
  },
  {
    name: "needs notice, scheduling offered",
    drafts: [DRAFT_RICH],
    api: api({ getServiceById: { data: service(["asap", "date"]) } }),
    allow: DISABLED,
  },
  {
    name: "needs notice, the pro confirms",
    drafts: [DRAFT_RICH],
    api: api(),
    allow: ENABLED,
  },
  {
    name: "cash only, kitchen hours",
    drafts: [DRAFT_ONE_LINE],
    api: api({ getProProfile: { data: CASH_ONLY } }),
    allow: ENABLED,
  },
  {
    name: "delivery only kitchen",
    drafts: [DRAFT_ONE_LINE],
    api: api({
      getProMenu: { data: { ...RICH_MENU, isPickupEnabled: false } },
    }),
    allow: ENABLED,
  },
  {
    name: "everything loading",
    drafts: [DRAFT_ONE_LINE],
    api: {},
    allow: ENABLED,
  },
  { name: "empty basket", drafts: [], api: api(), allow: DISABLED },
  {
    name: "no bottom inset",
    drafts: [DRAFT_ONE_LINE],
    api: api(),
    insets: { bottom: 0 },
    allow: ENABLED,
  },
  {
    name: "bottom inset 48",
    drafts: [DRAFT_ONE_LINE],
    api: api(),
    insets: { bottom: 48 },
    allow: ENABLED,
  },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

const options = (
  c: Case,
  env: (typeof PARITY_MATRIX)[number],
  authState: object = auth
): RenderScreenOptions => ({
  state: cartState(
    authState,
    c.drafts,
    c.address === undefined ? ADDRESS : c.address
  ),
  api: c.api,
  lang: env.language,
  platform: env.platform,
  route: { name: "FoodCheckoutScreen", params: PARAMS },
  ...(c.insets ? { insets: c.insets } : {}),
  ...(c.warm ? { cache: WARM } : {}),
})

describe("FoodCheckoutScreen, captured from the unconverted code", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (c) => {
    expectParity(
      parityName(c.name, c.env),
      await renderScreen(load, options(c, c.env)),
      { allow: c.allow }
    )
  })
})

const envs = rowsByPlatform([{}], PARITY_MATRIX)
type Env = (typeof PARITY_MATRIX)[number]
const open = (c: Case, env: Env, authState?: object) =>
  openScreen(load, options(c, env, authState))
const reviewButton = (root: ReactTestInstance, env: Env) => {
  const found = root.findAll(
    (node) => node.props.title === copy(env, "review_order"),
    { deep: false }
  )
  expect(found).toHaveLength(1)
  return found[0]
}
const byName = (name: string) => CASES.find((c) => c.name === name)!

describe("FoodCheckoutScreen, the controls", () => {
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
    "the mode buttons swap delivery and pickup [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      try {
        await session.act(() => {
          pressText(session.root, copy(env, "pickup"))
        })
        expectParity(parityName("pickup chosen", env), session.tree(), {
          allow: ENABLED,
        })
        await session.act(() => {
          pressText(session.root, copy(env, "delivery"))
        })
        expectParity(parityName("delivery chosen again", env), session.tree(), {
          allow: ENABLED,
        })
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the second payment row picks the card [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      try {
        await session.act(() => {
          pressContaining(session.root, copy(env, "card_on_delivery"))
        })
        expectParity(parityName("card chosen", env), session.tree(), {
          allow: ENABLED,
        })
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the address card opens the address sheet [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      try {
        await session.act(() => {
          pressContaining(session.root, copy(env, "change"))
        })
        expectParity(parityName("address sheet open", env), session.tree(), {
          allow: ENABLED,
        })
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "Schedule for later opens the calendar sheet [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(byName("a category that schedules"), env)
      try {
        await session.act(() => {
          pressContaining(session.root, copy(env, "schedule_delivery"))
        })
        expectParity(parityName("calendar sheet open", env), session.tree(), {
          allow: ENABLED,
        })
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "typing the order notes lands in the basket's draft [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env)
      try {
        await session.act(() => {
          typeInto(session.root, 0, "Leave it with the doorman")
        })
        expect(
          (
            session.store.getState() as {
              cart: { carts: Record<number, { orderNotes: string }> }
            }
          ).cart.carts[PRO_FOOD.id].orderNotes
        ).toBe("Leave it with the doorman")
        expectParity(parityName("notes typed", env), session.tree(), {
          allow: ENABLED,
        })
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the zone banner's Switch to pickup changes the mode, and the banner goes [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(
        byName("out of the delivery zone, pickup reachable"),
        env
      )
      try {
        await session.act(() => {
          pressContaining(session.root, copy(env, "switch_to_pickup"))
        })
        expectParity(parityName("switched to pickup", env), session.tree(), {
          allow: ENABLED,
        })
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the zone banner's Find other pros pops back to the listing [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(
        byName("out of the zone and out of pickup range"),
        env
      )
      try {
        await session.act(() => {
          pressContaining(session.root, copy(env, "find_other_pros"))
        })
        expect(session.navigation.actions).toMatchObject([
          {
            type: "POP_TO",
            payload: {
              name: "ProsListingScreen",
              params: {
                categoryId: CATEGORY_FOOD.id,
                serviceId: SERVICE_FOOD.id,
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
    "Review order is dead with no address, and hands over the payload when it can [$env.language $env.platform]",
    async ({ env }) => {
      const noAddress = await open(byName("no address"), env)
      try {
        expect(reviewButton(noAddress.root, env).props.onPress).toBeUndefined()
      } finally {
        noAddress.unmount()
      }
      const session = await open(CASES[0], env)
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "review_order"))
        })
        expect(session.navigation.actions).toMatchObject([
          {
            type: "NAVIGATE",
            payload: {
              name: "FoodOrderReviewScreen",
              params: {
                proId: PRO_FOOD.id,
                isPickup: false,
                whereLabel: copy(env, "deliver_to"),
                whereValue: ADDRESS.address,
                whenValue: copy(env, "deliver_now"),
                paymentLabel: copy(env, "cash_on_delivery"),
                payload: {
                  serviceCategoryId: CATEGORY_FOOD.id,
                  prosIds: [PRO_FOOD.id],
                  placeOfService: "delivery",
                  paymentMethod: "cash",
                  foodOrderItems: [{ menuItemId: 411, quantity: 1 }],
                },
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
    "a guest's Review order goes to sign in [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(CASES[0], env, guestAuth)
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "review_order"))
        })
        expect(session.navigation.actions).toMatchObject([
          { type: "NAVIGATE", payload: { name: "AuthGateScreen" } },
        ])
      } finally {
        session.unmount()
      }
    }
  )
})
