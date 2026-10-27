import { describe, expect, it } from "@jest/globals"

import reducer, {
  addCartItem,
  replaceCartLines,
  type CartState,
} from "store/cart/slice"
import type { CartItemType } from "types/food"

const context = {
  proId: 7,
  serviceCategoryId: 3,
  serviceId: 9,
  proName: "Kitchen",
  categoryName: "Food",
  fulfillmentMode: "delivery" as const,
}
const line = (id: number, quantity = 1): CartItemType => ({
  uid: `${id}:`,
  menuItemId: id,
  name: `Dish ${id}`,
  price: 10,
  quantity,
})

const withBasket = (): CartState =>
  reducer(
    reducer(undefined, addCartItem({ context, item: line(1) })),
    addCartItem({ context, item: line(2) })
  )

describe("replaceCartLines", () => {
  it("stores the repaired lines and keeps the rest of the draft", () => {
    const before = withBasket()
    const after = reducer(
      before,
      replaceCartLines({ proId: 7, lines: [line(91, 2)] })
    )
    expect(after.carts[7].items).toEqual([line(91, 2)])
    expect(after.carts[7].proName).toBe("Kitchen")
    expect(after.carts[7].serviceCategoryId).toBe(3)
  })

  it("drops the draft when nothing is left", () => {
    const after = reducer(withBasket(), replaceCartLines({ proId: 7, lines: [] }))
    expect(after.carts).toEqual({})
  })

  it("ignores a pro with no draft, and leaves other pros' drafts alone", () => {
    const before = withBasket()
    expect(
      reducer(before, replaceCartLines({ proId: 99, lines: [line(5)] })).carts
    ).toEqual(before.carts)
  })
})
