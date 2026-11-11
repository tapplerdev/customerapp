import { describe, expect, it } from "@jest/globals"

import {
  asksVenue,
  categoryVenues,
  isAtFixedLocation,
  listingPlace,
  pickedVenue,
  requestPlace,
  venueName,
  venuePoint,
} from "utils/fixedLocation"

/*
 * The venue of a fixed-location request (venue-on-job). Airport Pickup's
 * shape: fixedLocations is its only place, with four airports. The server
 * refuses placeOfService=fixedLocations on the listing without a venue (400),
 * and a venue that is not the category's on POST /jobs, so these decide when
 * a venue is asked, kept and sent.
 */
const venue = (id: number, nameEn: string, nameAr = "") => ({
  id,
  nameEn,
  nameAr,
  location: { type: "Point", coordinates: [31.4, 30.1] },
})
const CAIRO = venue(72, "Cairo International Airport", "مطار القاهرة الدولي")
const SPHINX = venue(74, "Sphinx International Airport", "مطار سفنكس الدولي")
const ALEX = venue(75, "Alexandria International Airport", "مطار الإسكندرية")

const airports = {
  placeOfService: ["fixedLocations"],
  hasMenu: false,
  fixedLocations: [SPHINX, CAIRO, ALEX],
}
const oneVenue = { ...airports, fixedLocations: [CAIRO] }
const noVenue = { ...airports, fixedLocations: [] }
const mixed = {
  placeOfService: ["proToCustomer", "fixedLocations"],
  hasMenu: false,
  fixedLocations: [CAIRO, SPHINX],
}
const car = { placeOfService: ["customerToPro"], hasMenu: false }
const food = { placeOfService: ["fixedLocations"], hasMenu: true }

describe("requestPlace / isAtFixedLocation", () => {
  it("is the chosen place, else the category's only place", () => {
    expect(requestPlace(undefined, airports)).toBe("fixedLocations")
    expect(requestPlace("proToCustomer", mixed)).toBe("proToCustomer")
    expect(requestPlace(undefined, mixed)).toBeUndefined()
    expect(isAtFixedLocation(undefined, airports)).toBe(true)
    expect(isAtFixedLocation("fixedLocations", mixed)).toBe(true)
    expect(isAtFixedLocation(undefined, mixed)).toBe(false)
    expect(isAtFixedLocation(undefined, car)).toBe(false)
  })

  it("never implies a food category's place, or one with no category", () => {
    expect(requestPlace(undefined, food)).toBeUndefined()
    expect(requestPlace(undefined, undefined)).toBeUndefined()
  })
})

describe("asksVenue", () => {
  it("asks when the request is at a fixed location with several venues", () => {
    expect(asksVenue(undefined, airports)).toBe(true)
    expect(asksVenue("fixedLocations", mixed)).toBe(true)
  })

  it("does not ask for one venue, none, another place, or before a place is chosen", () => {
    expect(asksVenue(undefined, oneVenue)).toBe(false)
    expect(asksVenue(undefined, noVenue)).toBe(false)
    expect(asksVenue("proToCustomer", mixed)).toBe(false)
    expect(asksVenue(undefined, mixed)).toBe(false)
    expect(asksVenue(undefined, undefined)).toBe(false)
  })
})

describe("pickedVenue", () => {
  it("keeps a venue the category lists", () => {
    expect(pickedVenue(74, undefined, airports)).toBe(74)
    expect(pickedVenue(72, "fixedLocations", mixed)).toBe(72)
  })

  it("drops one it no longer lists, and none picked stays none", () => {
    expect(pickedVenue(73, undefined, airports)).toBeUndefined()
    expect(pickedVenue(undefined, undefined, airports)).toBeUndefined()
  })

  it("is the only venue when the category has one, picked or not", () => {
    expect(pickedVenue(undefined, undefined, oneVenue)).toBe(72)
    expect(pickedVenue(74, undefined, oneVenue)).toBe(72)
  })

  it("never outlives a change of place", () => {
    expect(pickedVenue(72, "proToCustomer", mixed)).toBeUndefined()
    expect(pickedVenue(72, undefined, mixed)).toBeUndefined()
    expect(pickedVenue(72, undefined, car)).toBeUndefined()
  })
})

describe("listingPlace", () => {
  const coords = { lat: 30.04, lon: 31.23 }
  const customerAddress = { latitude: 30.04, longitude: 31.23 }

  it("a venue goes out with its place and never with the address", () => {
    expect(
      listingPlace({ placeOfService: undefined, fixedLocationId: 72, coords })
    ).toEqual({ placeOfService: "fixedLocations", fixedLocationId: 72 })
    expect(
      listingPlace({
        placeOfService: "fixedLocations",
        fixedLocationId: 74,
        coords,
      })
    ).toEqual({ placeOfService: "fixedLocations", fixedLocationId: 74 })
  })

  it("a fixed location without a venue leaves the place out and keeps the address (the server refuses it alone)", () => {
    expect(
      listingPlace({
        placeOfService: "fixedLocations",
        fixedLocationId: undefined,
        coords,
      })
    ).toEqual({ customerAddress })
  })

  it("online goes without the address, every other place with it, as before", () => {
    expect(
      listingPlace({
        placeOfService: "remoteOrOnline",
        fixedLocationId: undefined,
        coords,
      })
    ).toEqual({ placeOfService: "remoteOrOnline" })
    expect(
      listingPlace({
        placeOfService: "proToCustomer",
        fixedLocationId: undefined,
        coords,
      })
    ).toEqual({ placeOfService: "proToCustomer", customerAddress })
    expect(
      listingPlace({
        placeOfService: undefined,
        fixedLocationId: undefined,
        coords,
      })
    ).toEqual({ placeOfService: undefined, customerAddress })
    expect(
      listingPlace({
        placeOfService: "pickup",
        fixedLocationId: undefined,
        coords: undefined,
      })
    ).toEqual({ placeOfService: "pickup", customerAddress: undefined })
  })
})

describe("categoryVenues, venueName, venuePoint", () => {
  it("lists the venues by name in the app's language", () => {
    expect(categoryVenues(airports).map((v) => v.id)).toEqual([75, 72, 74])
    expect(categoryVenues(airports, true).map((v) => v.id)).toEqual([
      75, 72, 74,
    ])
    expect(categoryVenues(undefined)).toEqual([])
  })

  it("names a venue in Arabic when it has an Arabic name, else in English", () => {
    expect(venueName(CAIRO, true)).toBe("مطار القاهرة الدولي")
    expect(venueName(CAIRO, false)).toBe("Cairo International Airport")
    expect(venueName({ nameEn: "Gate 3", nameAr: "" }, true)).toBe("Gate 3")
    expect(venueName(undefined, false)).toBe("")
  })

  it("reads the GeoJSON point as latitude and longitude, and none without one", () => {
    expect(venuePoint(CAIRO)).toEqual({ latitude: 30.1, longitude: 31.4 })
    expect(venuePoint({ location: null })).toBeUndefined()
    expect(venuePoint({ location: { coordinates: [] } })).toBeUndefined()
    expect(venuePoint(undefined)).toBeUndefined()
  })
})
