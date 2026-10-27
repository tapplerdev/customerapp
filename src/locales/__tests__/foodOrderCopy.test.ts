import { describe, expect, it, jest } from "@jest/globals"

import i18n from "locales/i18n"

/*
 * The order screen's and the chat's food wording (#512 phase 4). i18next
 * answers a missing key with the key itself, silently, so each one is read in
 * both languages and checked not to echo.
 */
jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

const en = i18n.getFixedT("en")
const ar = i18n.getFixedT("ar")

const KEYS = [
  "food_order_picked_up",
  "food_order_expired",
  "food_order_expired_descr",
  "food_order_closed_descr",
  "food_order_closed_descr_pickup",
  "food_order_cancelled_by_place_descr",
  "food_order_cancelled_by_tappler_descr",
  "food_order_no_longer_active",
  // reworded
  "food_order_accepted",
]

describe("food order copy", () => {
  it.each(KEYS)(
    "%s resolves in English and Arabic without echoing the key",
    (key) => {
      for (const t of [en, ar]) {
        const text = t(key)
        expect(text).not.toBe(key)
        expect(text.trim().length).toBeGreaterThan(0)
      }
      expect(ar(key)).toMatch(/[؀-ۿ]/)
      expect(en(key)).not.toMatch(/[؀-ۿ]/)
    }
  )

  it("keeps the reasons the restaurant can give, in both languages", () => {
    for (const reason of [
      "customerNotAnswering",
      "missingIngredients",
      "deliveryNotPossible",
      "tooBusy",
    ]) {
      expect(i18n.exists(`food_cancel_${reason}`)).toBe(true)
    }
  })

  it("has no `food_cancel_other`: the server hides it from customers, and the screen falls back to the plain line", () => {
    expect(i18n.exists("food_cancel_other")).toBe(false)
  })

  it("no longer says the place is preparing when it only accepted", () => {
    expect(en("food_order_accepted")).toBe("The place accepted your order.")
    expect(ar("food_order_accepted")).toBe("المكان قبل طلبك.")
  })

  it("says the money in the unanswered, cancelled and moderated lines, and not in the closed ones", () => {
    expect(en("food_order_expired_descr")).toContain(
      "You have not been charged"
    )
    expect(en("food_order_cancelled_by_place_descr")).toContain(
      "You have not been charged"
    )
    expect(en("food_order_cancelled_by_tappler_descr")).toContain(
      "You have not been charged"
    )
    // A closed order was accepted: the restaurant may have made the food.
    expect(en("food_order_closed_descr")).not.toContain("charged")
    expect(en("food_order_closed_descr_pickup")).not.toContain("charged")
  })

  it("says Tappler, not 'request', for a moderated order", () => {
    expect(en("food_order_cancelled_by_tappler_descr")).not.toMatch(/request/i)
    expect(en("food_order_cancelled_by_tappler_descr")).toContain("Tappler")
  })
})
