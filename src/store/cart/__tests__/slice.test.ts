import { describe, expect, it, jest } from "@jest/globals"
import { formatMoney as sharedFormatMoney } from "@tappler/shared/src/helpers/money"

import reducer, {
  CART_STALE_MS,
  addCartItem,
  clearCart,
  formatMoney,
  markSubmitKeyRefused,
  removeCartItem,
  replaceCartLines,
  setCartItemQuantity,
  setOrderNotes,
  selectDraft,
  setSubmitKey,
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

describe("formatMoney", () => {
  it("is tappler-shared's, so the food flow groups thousands as proapp does (#532)", () => {
    expect(formatMoney).toBe(sharedFormatMoney)
    expect(formatMoney(185)).toBe("185")
    expect(formatMoney(2370)).toBe("2,370")
    expect(formatMoney(1822.5)).toBe("1,822.50")
  })
})

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
    const after = reducer(
      withBasket(),
      replaceCartLines({ proId: 7, lines: [] })
    )
    expect(after.carts).toEqual({})
  })

  it("ignores a pro with no draft, and leaves other pros' drafts alone", () => {
    const before = withBasket()
    expect(
      reducer(before, replaceCartLines({ proId: 99, lines: [line(5)] })).carts
    ).toEqual(before.carts)
  })
})

describe("the order's Idempotency-Key on the draft", () => {
  const KEY = "0b7f2d9e-5c1a-4e8b-9f3d-2a6c8e1b4d7f"
  const keyed = () =>
    reducer(withBasket(), setSubmitKey({ proId: 7, key: KEY }))
  const refused = () => reducer(keyed(), markSubmitKeyRefused(7))

  it("stores the key on that pro's draft only", () => {
    const after = keyed()
    expect(after.carts[7].submitKey).toBe(KEY)
    expect(reducer(after, setSubmitKey({ proId: 99, key: "x" })).carts).toEqual(
      after.carts
    )
  })

  it("keeps the key through basket changes while no attempt was refused (one may have landed)", () => {
    let state = keyed()
    state = reducer(
      state,
      setCartItemQuantity({ proId: 7, uid: "1:", quantity: 3 })
    )
    state = reducer(state, addCartItem({ context, item: line(3) }))
    state = reducer(state, removeCartItem({ proId: 7, uid: "2:" }))
    state = reducer(state, setOrderNotes({ proId: 7, notes: "Ring twice" }))
    state = reducer(state, replaceCartLines({ proId: 7, lines: [line(4)] }))
    expect(state.carts[7].submitKey).toBe(KEY)
  })

  it("a refusal alone keeps the key, marked spent", () => {
    expect(refused().carts[7]).toMatchObject({
      submitKey: KEY,
      submitKeyRefused: true,
    })
  })

  it.each([
    [
      "a quantity change",
      setCartItemQuantity({ proId: 7, uid: "1:", quantity: 2 }),
    ],
    ["an added dish", addCartItem({ context, item: line(3) })],
    ["a removed dish", removeCartItem({ proId: 7, uid: "2:" })],
    ["new notes", setOrderNotes({ proId: 7, notes: "Ring twice" })],
    ["a menu repair", replaceCartLines({ proId: 7, lines: [line(4)] })],
  ])("after a refusal, %s drops the key", (_name, action) => {
    const draft = reducer(refused(), action).carts[7]
    expect(draft.submitKey).toBeUndefined()
    expect(draft.submitKeyRefused).toBeUndefined()
  })

  it("marking a draft with no key does nothing", () => {
    const before = withBasket()
    expect(reducer(before, markSubmitKeyRefused(7)).carts).toEqual(before.carts)
  })

  it("a new key clears the refusal mark", () => {
    const after = reducer(refused(), setSubmitKey({ proId: 7, key: "new" }))
    expect(after.carts[7].submitKey).toBe("new")
    expect(after.carts[7].submitKeyRefused).toBeUndefined()
  })

  it("counts as activity, so a draft holding a pending key doesn't expire right after", () => {
    const now = jest.spyOn(Date, "now")
    try {
      now.mockReturnValue(1_000)
      const basket = withBasket()
      now.mockReturnValue(1_000 + CART_STALE_MS - 1)
      const submitted = reducer(basket, setSubmitKey({ proId: 7, key: KEY }))
      expect(submitted.carts[7].lastUpdatedAt).toBe(1_000 + CART_STALE_MS - 1)
      expect(
        selectDraft(submitted, 7, 1_000 + CART_STALE_MS + 60_000)?.submitKey
      ).toBe(KEY)
    } finally {
      now.mockRestore()
    }
  })

  it("goes with the draft on clearCart", () => {
    expect(reducer(keyed(), clearCart(7)).carts).toEqual({})
  })
})
