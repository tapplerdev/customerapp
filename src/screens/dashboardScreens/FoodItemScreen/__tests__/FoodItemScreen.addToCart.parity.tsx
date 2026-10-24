/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  rowsByPlatform,
  type RenderScreenOptions,
  type Step,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { FOOD_MENU } from "testing/screenKit/fixtures/entities"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
} from "testing/hostTreeParity"
import type { FoodMenuType } from "types/food"

import {
  RICH_MENU,
  pressCheckbox,
} from "../../FoodMenuScreen/__fixtures__/food"

/*
 * FoodItemScreen's Add to cart, which is not on screen until every required
 * option group has its choices (snags #506, C1; the button used to be there,
 * dimmed). FoodItemScreen.parity.tsx keeps every state that draws the button;
 * the states where it is missing live here, captured from the code that hides
 * it (the three rows they replace are retired there, their frozen fixtures
 * untouched). The dish with a required single choice, with the two insets
 * those rows covered; a dish with a required group that wants two picks
 * (one pick is still not enough, two is); a dish whose groups are all
 * optional, and one with none, which show it from the start. Each row also
 * says what was drawn: the button's title carries the price, so it is looked
 * up by the words before it.
 */

const ENABLED: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const MIN_TWO = {
  id: 5111,
  name: "Sides",
  isRequired: true,
  minQty: 2,
  maxQty: 3,
  choices: [
    { id: 51111, name: "Rice", price: 0, discountPrice: 0 },
    { id: 51112, name: "Salad", price: 10, discountPrice: 0 },
    { id: 51113, name: "Fries", price: 15, discountPrice: 0 },
  ],
}
const OPTIONAL_ONLY = {
  id: 5121,
  name: "Extras",
  isRequired: false,
  minQty: 0,
  maxQty: 2,
  choices: [
    { id: 51211, name: "Extra bread", price: 10, discountPrice: 0 },
    { id: 51212, name: "Pickles", price: 5, discountPrice: 0 },
  ],
}
const dish = (id: number, name: string, options?: unknown[]) => ({
  id,
  name,
  description: "",
  price: 90,
  discountPrice: 0,
  isExpressDeliveryAvailable: true,
  isPreOrderOnly: false,
  leadTimeHours: null,
  photo: "",
  inStock: true,
  ...(options ? { options } : {}),
})
const MENU: FoodMenuType = {
  ...FOOD_MENU,
  menuSections: [
    ...RICH_MENU.menuSections,
    {
      id: 51,
      title: "Platters",
      order: 4,
      menuItems: [
        dish(511, "Mixed platter", [MIN_TWO]),
        dish(512, "Plain platter", [OPTIONAL_ONLY]),
      ],
    },
  ] as FoodMenuType["menuSections"],
}

const load = () => require("../FoodItemScreen")
const BASE = ROUTE_PARAMS.FoodItemScreen!
const api = { ...DATA, getProMenu: { data: MENU } }

type Env = (typeof PARITY_MATRIX)[number]
const options = (
  menuItemId: number,
  env: Env,
  insets?: { top?: number; bottom?: number }
): RenderScreenOptions => ({
  ...screenState("data"),
  api,
  lang: env.language,
  platform: env.platform,
  route: { name: "FoodItemScreen", params: { ...BASE, menuItemId } },
  ...(insets ? { insets } : {}),
})

// Boxes in screen order: Size (Regular, Large), then Extras on the Molokhia
// dish; Rice, Salad, Fries on the platter.
const choose = (...boxes: number[]): Step => (root) => {
  boxes.forEach((box) => pressCheckbox(root, box))
}

type Case = {
  name: string
  menuItemId: number
  insets?: { top?: number; bottom?: number }
  steps?: Step[]
  hidden: boolean
}
const CASES: Case[] = [
  { name: "required choice missing", menuItemId: 411, hidden: true },
  {
    name: "required choice missing, bottom inset 48",
    menuItemId: 411,
    insets: { bottom: 48 },
    hidden: true,
  },
  {
    name: "required choice missing, no top inset",
    menuItemId: 411,
    insets: { top: 0 },
    hidden: true,
  },
  // An optional pick alone doesn't satisfy a required group.
  {
    name: "only an optional extra chosen",
    menuItemId: 411,
    steps: [choose(2)],
    hidden: true,
  },
  { name: "needs two picks, none made", menuItemId: 511, hidden: true },
  {
    name: "needs two picks, one made",
    menuItemId: 511,
    steps: [choose(0)],
    hidden: true,
  },
  {
    name: "needs two picks, two made",
    menuItemId: 511,
    steps: [choose(0, 2)],
    hidden: false,
  },
  {
    name: "needs two picks, one taken back",
    menuItemId: 511,
    steps: [choose(0, 2), choose(2)],
    hidden: true,
  },
  { name: "optional groups only", menuItemId: 512, hidden: false },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

const addButtons = (
  root: Parameters<Step>[0],
  env: Env
) => {
  const prefix = copy(env, "add_to_cart_for_egp_count").split("{{")[0]
  return root.findAll(
    (node) =>
      typeof node.props.title === "string" &&
      node.props.title.startsWith(prefix),
    { deep: false }
  )
}

describe("FoodItemScreen, Add to cart hidden until the required options are chosen", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (c) => {
    const session = await openScreen(load, options(c.menuItemId, c.env, c.insets))
    try {
      for (const [index, step] of (c.steps ?? []).entries()) {
        // eslint-disable-next-line no-await-in-loop
        await session.act(() => step(session.root, c.env), 500, `step ${index + 1}`)
      }
      // The rule itself, beside the tree: gone while a required group is short.
      expect(addButtons(session.root, c.env)).toHaveLength(c.hidden ? 0 : 1)
      expectParity(parityName(c.name, c.env), session.tree(), {
        allow: c.hidden ? [] : ENABLED,
      })
    } finally {
      session.unmount()
    }
  })
})
