import { describe, expect, it } from "@jest/globals"

import { dateOptionsFor } from "utils/dateOptions"

/*
 * The date step's rows come from category.dateTypes, which the backend derives
 * (urgent: none, food: asap + date, scheduled: date, standard: all four).
 */
describe("dateOptionsFor", () => {
  it("standard: all four, in the fixed order whatever order they arrive in", () => {
    const expected = ["asap", "week", "date", "notDecided"]
    expect(dateOptionsFor(["asap", "week", "date", "notDecided"])).toEqual(
      expected
    )
    expect(dateOptionsFor(["notDecided", "date", "week", "asap"])).toEqual(
      expected
    )
  })

  it("scheduled: a specific date only", () => {
    expect(dateOptionsFor(["date"])).toEqual(["date"])
  })

  it("food: as soon as possible and a date", () => {
    expect(dateOptionsFor(["date", "asap"])).toEqual(["asap", "date"])
  })

  it("urgent or not loaded yet: no rows", () => {
    expect(dateOptionsFor([])).toEqual([])
    expect(dateOptionsFor(undefined)).toEqual([])
  })

  it("never offers hours48 (old jobs only) or an unknown type", () => {
    expect(dateOptionsFor(["hours48", "week", "later"])).toEqual(["week"])
  })
})
