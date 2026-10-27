import { describe, expect, it } from "@jest/globals"

import {
  buildFoodOrderItems,
  cartLineUid,
  repairCart,
} from "utils/foodCartRepair"
import {
  DRAFT_RICH,
  DRAFT_RICH_REPRICED,
  DRAFT_RICH_WITHOUT_BASBOUSA,
  MENU_LARGE_DEARER,
  MENU_WITHOUT_BASBOUSA,
} from "../../screens/dashboardScreens/FoodMenuScreen/__fixtures__/food"
import type {
  CartItemType,
  FoodMenuItemType,
  FoodMenuType,
  FoodOptionType,
} from "types/food"

// The menu the customer shopped, then the menus the pro leaves behind. Ids and
// prices are made up; the shapes are the customer menu route's.

const SIZE: FoodOptionType = {
  id: 1,
  name: "Size",
  isRequired: true,
  minQty: 1,
  maxQty: 1,
  choices: [
    { id: 11, name: "Regular", price: 0, discountPrice: 0 },
    { id: 12, name: "Large", price: 30, discountPrice: 25 },
  ],
}
const EXTRAS: FoodOptionType = {
  id: 2,
  name: "Extras",
  isRequired: false,
  minQty: 0,
  maxQty: 3,
  choices: [
    { id: 21, name: "Extra bread", price: 10, discountPrice: 0 },
    { id: 22, name: "Pickles", price: 5, discountPrice: 0 },
  ],
}

const dish = (over: Partial<FoodMenuItemType>): FoodMenuItemType => ({
  id: 411,
  name: "Molokhia",
  description: "",
  price: 185,
  discountPrice: 0,
  isExpressDeliveryAvailable: true,
  isPreOrderOnly: false,
  leadTimeHours: null,
  photo: "https://example.com/molokhia.jpg",
  inStock: true,
  options: [SIZE, EXTRAS],
  ...over,
})

const menuOf = (...dishes: FoodMenuItemType[]): FoodMenuType => ({
  deliveryCharge: 25,
  freeDeliveryThreshold: null,
  totalOrderValueDiscountRate: null,
  totalOrderValueDiscountThreshold: null,
  menuSections: [{ id: 1, title: "Mains", order: 1, menuItems: dishes }],
})

// What FoodItemScreen puts in the basket for Molokhia, Large, with bread.
const molokhiaLine = (over: Partial<CartItemType> = {}): CartItemType => {
  const selectedOptions = [
    { optionName: "Size", choices: [{ name: "Large", price: 25, originalPrice: 30 }] },
    {
      optionName: "Extras",
      choices: [{ name: "Extra bread", price: 10, originalPrice: 10 }],
    },
  ]
  return {
    uid: cartLineUid(411, selectedOptions),
    menuItemId: 411,
    name: "Molokhia",
    price: 185,
    originalPrice: 185,
    quantity: 2,
    selectedOptions,
    photo: "https://example.com/molokhia.jpg",
    isPreOrderOnly: false,
    leadTimeHours: null,
    ...over,
  }
}

const plainLine = (over: Partial<CartItemType> = {}): CartItemType => ({
  uid: "412:",
  menuItemId: 412,
  name: "Grilled chicken",
  price: 120,
  originalPrice: 150,
  quantity: 1,
  photo: "https://example.com/chicken.jpg",
  isPreOrderOnly: false,
  leadTimeHours: null,
  ...over,
})
const chicken = (over: Partial<FoodMenuItemType> = {}) =>
  dish({
    id: 412,
    name: "Grilled chicken",
    price: 150,
    discountPrice: 120,
    photo: "https://example.com/chicken.jpg",
    options: undefined,
    ...over,
  })

describe("repairCart", () => {
  it("leaves a basket alone when the menu agrees with it", () => {
    const lines = [molokhiaLine(), plainLine()]
    const result = repairCart(lines, menuOf(dish({}), chicken()))
    expect(result).toEqual({
      lines,
      repriced: [],
      removed: [],
      changed: false,
    })
  })

  it("reprices a line when a chosen choice's price moved", () => {
    const large = { id: 12, name: "Large", price: 40, discountPrice: 0 }
    const menu = menuOf(
      dish({ options: [{ ...SIZE, choices: [SIZE.choices[0], large] }, EXTRAS] })
    )
    const result = repairCart([molokhiaLine()], menu)

    expect(result.removed).toEqual([])
    expect(result.changed).toBe(true)
    expect(result.repriced).toHaveLength(1)
    const [line] = result.lines
    expect(line.selectedOptions?.[0].choices[0]).toEqual({
      name: "Large",
      price: 40,
      originalPrice: 40,
    })
    // The same uid: it is still the same dish and the same picks.
    expect(line.uid).toBe(molokhiaLine().uid)
  })

  it("reprices a line when the dish's price moved, and reads a discount as the server does", () => {
    const result = repairCart([plainLine()], menuOf(chicken({ discountPrice: 100 })))
    expect(result.lines[0].price).toBe(100)
    expect(result.lines[0].originalPrice).toBe(150)
    expect(result.repriced).toHaveLength(1)

    // 0 is "no discount", not a price of zero.
    const noDiscount = repairCart([plainLine()], menuOf(chicken({ discountPrice: 0 })))
    expect(noDiscount.lines[0].price).toBe(150)
  })

  it("finds a dish an approval gave a new id, by its exact name", () => {
    const menu = menuOf(dish({ id: 911 }), chicken({ id: 912 }))
    const result = repairCart([molokhiaLine(), plainLine()], menu)

    expect(result.removed).toEqual([])
    expect(result.repriced).toEqual([])
    expect(result.changed).toBe(true)
    expect(result.lines.map((l) => l.menuItemId)).toEqual([911, 912])
    expect(result.lines[0].uid).toBe(cartLineUid(911, result.lines[0].selectedOptions!))
    expect(result.lines[1].uid).toBe("912:")
    // The order check would now accept these lines.
    expect(buildFoodOrderItems(result.lines)[0]).toMatchObject({
      menuItemId: 911,
      name: "Molokhia",
      price: 185,
    })
  })

  it("removes a line whose dish is gone", () => {
    const result = repairCart([molokhiaLine(), plainLine()], menuOf(chicken()))
    expect(result.removed).toEqual([
      { line: molokhiaLine(), reason: "dishGone" },
    ])
    expect(result.lines.map((l) => l.menuItemId)).toEqual([412])
    expect(result.changed).toBe(true)
  })

  it("removes a line whose dish is out of stock", () => {
    const result = repairCart([plainLine()], menuOf(chicken({ inStock: false })))
    expect(result.removed.map((r) => r.reason)).toEqual(["outOfStock"])
    expect(result.lines).toEqual([])
  })

  it("removes, rather than guesses, when the id is gone and the name is on two dishes", () => {
    const menu = menuOf(
      chicken({ id: 801 }),
      chicken({ id: 802, price: 99, discountPrice: 0 })
    )
    const result = repairCart([plainLine()], menu)
    expect(result.removed.map((r) => r.reason)).toEqual(["dishAmbiguous"])
    expect(result.lines).toEqual([])
  })

  it("trusts the id when it is still there, even if the name is shared", () => {
    const menu = menuOf(chicken(), chicken({ id: 802, price: 99, discountPrice: 0 }))
    const result = repairCart([plainLine()], menu)
    expect(result.removed).toEqual([])
    expect(result.lines[0].menuItemId).toBe(412)
    expect(result.changed).toBe(false)
  })

  it("only matches a name exactly", () => {
    const result = repairCart(
      [plainLine()],
      menuOf(chicken({ id: 900, name: "Grilled Chicken" }))
    )
    expect(result.removed.map((r) => r.reason)).toEqual(["dishGone"])
  })

  it("removes a line whose chosen choice no longer exists", () => {
    const menu = menuOf(
      dish({ options: [{ ...SIZE, choices: [SIZE.choices[0]] }, EXTRAS] })
    )
    const result = repairCart([molokhiaLine()], menu)
    expect(result.removed.map((r) => r.reason)).toEqual(["optionGone"])
  })

  it("removes a line whose chosen option no longer exists", () => {
    const menu = menuOf(dish({ options: [SIZE] }))
    const result = repairCart([molokhiaLine()], menu)
    expect(result.removed.map((r) => r.reason)).toEqual(["optionGone"])
  })

  it("removes, rather than guesses, when two choices or two options share the picked name", () => {
    const twoChoices = menuOf(
      dish({
        options: [
          {
            ...SIZE,
            choices: [
              ...SIZE.choices,
              { id: 13, name: "Large", price: 99, discountPrice: 0 },
            ],
          },
          EXTRAS,
        ],
      })
    )
    expect(
      repairCart([molokhiaLine()], twoChoices).removed.map((r) => r.reason)
    ).toEqual(["optionAmbiguous"])

    const twoOptions = menuOf(
      dish({ options: [SIZE, { ...SIZE, id: 3 }, EXTRAS] })
    )
    expect(
      repairCart([molokhiaLine()], twoOptions).removed.map((r) => r.reason)
    ).toEqual(["optionAmbiguous"])
  })

  it("removes a line the chosen choices no longer satisfy", () => {
    // Size now wants two picks; the basket has one.
    const needsTwo = menuOf(
      dish({ options: [{ ...SIZE, minQty: 2, maxQty: 2 }, EXTRAS] })
    )
    expect(
      repairCart([molokhiaLine()], needsTwo).removed.map((r) => r.reason)
    ).toEqual(["rulesBroken"])

    // Extras now allows none of the three the basket would need; here, max 1 with two picked.
    const twoBreads = molokhiaLine()
    twoBreads.selectedOptions![1].choices = [
      { name: "Extra bread", price: 10, originalPrice: 10 },
      { name: "Pickles", price: 5, originalPrice: 5 },
    ]
    const capped = menuOf(dish({ options: [SIZE, { ...EXTRAS, maxQty: 1 }] }))
    expect(repairCart([twoBreads], capped).removed.map((r) => r.reason)).toEqual([
      "rulesBroken",
    ])
  })

  it("removes a line when an option became required and the basket never answered it", () => {
    const line = plainLine({ menuItemId: 412 })
    const menu = menuOf(chicken({ options: [SIZE] }))
    expect(repairCart([line], menu).removed.map((r) => r.reason)).toEqual([
      "rulesBroken",
    ])
  })

  it("treats minQty as the server does: only a required group, and at least one pick", () => {
    // required with minQty 0 still needs one pick (the basket has one: fine)
    const zero = menuOf(dish({ options: [{ ...SIZE, minQty: 0 }, EXTRAS] }))
    expect(repairCart([molokhiaLine()], zero).removed).toEqual([])
    // optional with minQty 2 binds nothing
    const optional = menuOf(
      dish({ options: [SIZE, { ...EXTRAS, minQty: 2, isRequired: false }] })
    )
    expect(repairCart([molokhiaLine()], optional).removed).toEqual([])
  })

  it("merges two lines that now point at the same dish and picks", () => {
    // One added before an approval, one after; the approval re-ided the dish.
    const before = molokhiaLine({ quantity: 1 })
    const afterSelected = before.selectedOptions
    const after = molokhiaLine({
      menuItemId: 700,
      uid: cartLineUid(700, afterSelected!),
      quantity: 3,
    })
    const result = repairCart([before, after], menuOf(dish({ id: 911 })))
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].quantity).toBe(4)
    expect(result.changed).toBe(true)
  })

  it("does not call a changed strikethrough price a change", () => {
    // The list price moved but what the customer pays didn't.
    const result = repairCart(
      [plainLine()],
      menuOf(chicken({ price: 160, discountPrice: 120 }))
    )
    expect(result.changed).toBe(false)
    expect(result.repriced).toEqual([])
    expect(result.lines[0].originalPrice).toBe(160)
  })

  it("does not change its input", () => {
    const lines = [molokhiaLine()]
    const copy = JSON.parse(JSON.stringify(lines))
    repairCart(lines, menuOf(dish({ id: 911 })))
    expect(lines).toEqual(copy)
  })
})

describe("the parity fixtures", () => {
  // The screens' parity cases draw baskets written out by hand; the repair
  // has to produce exactly those.
  it("are what the repair makes of DRAFT_RICH", () => {
    const repriced = repairCart(DRAFT_RICH.items, MENU_LARGE_DEARER)
    expect(repriced.lines).toEqual(DRAFT_RICH_REPRICED.items)
    expect(repriced.repriced).toHaveLength(1)
    expect(repriced.removed).toEqual([])

    const removed = repairCart(DRAFT_RICH.items, MENU_WITHOUT_BASBOUSA)
    expect(removed.lines).toEqual(DRAFT_RICH_WITHOUT_BASBOUSA.items)
    expect(removed.removed.map((r) => r.reason)).toEqual(["dishGone"])
  })
})

describe("buildFoodOrderItems", () => {
  it("sends only what the backend validates, and no selectedOptions for a plain dish", () => {
    expect(buildFoodOrderItems([plainLine(), molokhiaLine()])).toEqual([
      { menuItemId: 412, name: "Grilled chicken", price: 120, quantity: 1 },
      {
        menuItemId: 411,
        name: "Molokhia",
        price: 185,
        quantity: 2,
        selectedOptions: [
          { optionName: "Size", choices: [{ name: "Large", price: 25 }] },
          { optionName: "Extras", choices: [{ name: "Extra bread", price: 10 }] },
        ],
      },
    ])
  })
})

describe("cartLineUid", () => {
  it("is the id plus the sorted picks, whatever order they were made in", () => {
    expect(
      cartLineUid(411, [
        { optionName: "Size", choices: [{ name: "Large", price: 25 }] },
        {
          optionName: "Extras",
          choices: [
            { name: "Pickles", price: 5 },
            { name: "Extra bread", price: 10 },
          ],
        },
      ])
    ).toBe("411:Extras=Extra bread+Pickles|Size=Large")
    expect(cartLineUid(412, [])).toBe("412:")
  })
})
