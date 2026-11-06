import { describe, expect, it } from "@jest/globals"

import { offeredPlaceOfService } from "utils/placeOfService"

/*
 * Repost and Find other pros seed the old job's place of service. Staff may
 * have taken it off the category since (Car service: proToCustomer gone,
 * customerToPro left), and a seed the category no longer offers lists nobody
 * and is never asked again, so it is cleared before the listing opens.
 */
describe("offeredPlaceOfService", () => {
  const car = { placeOfService: ["customerToPro"], hasMenu: false }
  const multi = {
    placeOfService: ["proToCustomer", "customerToPro"],
    hasMenu: false,
  }
  const food = { placeOfService: ["delivery"], hasMenu: true }

  it("keeps a seed the category still offers", () => {
    expect(offeredPlaceOfService("customerToPro", car)).toBe("customerToPro")
    expect(offeredPlaceOfService("proToCustomer", multi)).toBe("proToCustomer")
  })

  it("clears one it no longer offers", () => {
    expect(offeredPlaceOfService("proToCustomer", car)).toBeUndefined()
    expect(offeredPlaceOfService("remoteOrOnline", multi)).toBeUndefined()
    expect(
      offeredPlaceOfService("customerToPro", {
        placeOfService: [],
        hasMenu: false,
      })
    ).toBeUndefined()
  })

  it("food: pickup and delivery stay while the category offers delivery", () => {
    expect(offeredPlaceOfService("pickup", food)).toBe("pickup")
    expect(offeredPlaceOfService("delivery", food)).toBe("delivery")
    expect(
      offeredPlaceOfService("pickup", { placeOfService: [], hasMenu: true })
    ).toBeUndefined()
  })

  it("pickup outside food is cleared", () => {
    expect(
      offeredPlaceOfService("pickup", {
        placeOfService: ["delivery"],
        hasMenu: false,
      })
    ).toBeUndefined()
  })

  it("keeps the seed when the category is unknown, and no seed stays none", () => {
    expect(offeredPlaceOfService("proToCustomer", undefined)).toBe(
      "proToCustomer"
    )
    expect(offeredPlaceOfService("proToCustomer", { hasMenu: false })).toBe(
      "proToCustomer"
    )
    expect(offeredPlaceOfService(undefined, car)).toBeUndefined()
  })
})
