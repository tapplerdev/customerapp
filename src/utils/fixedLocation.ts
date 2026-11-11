import type { FixedLocationType, ServiceCategoryType } from "types/cms"

/*
 * The venue a fixed-location request is at (venue-on-job, backend be PR 1).
 *
 * A category whose place is fixedLocations (Airport Pickup) lists its venues
 * on the service payload (category.fixedLocations). The customer picks one
 * in the question flow; the listing then asks only for the pros who picked
 * that venue (GET /pros/category/:id?placeOfService=fixedLocations
 * &fixedLocationId=…), and POST /jobs records it, so the pro's Job Details
 * shows that venue's pin.
 *
 * The server refuses placeOfService=fixedLocations on the listing without a
 * venue (400), and refuses a venue that is not the category's
 * (JOB_FIXED_LOCATION_NOT_OFFERED), so a venue is sent only with its place
 * and only while the category still lists it.
 */

export const FIXED_LOCATIONS = "fixedLocations"

type VenueCategory = Pick<ServiceCategoryType, "placeOfService" | "hasMenu"> & {
  fixedLocations?: FixedLocationType[]
}

/** The category's venues, by name, so the list reads the same every time. */
export const categoryVenues = (
  category: VenueCategory | undefined,
  isAr = false
): FixedLocationType[] =>
  [...(category?.fixedLocations ?? [])].sort((a, b) =>
    (isAr ? a.nameAr || a.nameEn : a.nameEn).localeCompare(
      isAr ? b.nameAr || b.nameEn : b.nameEn
    )
  )

/**
 * The place the request is at: the one chosen, else the category's only
 * place (the app never asks the place when there is one, and the server
 * fills it in). A food category's place is never implied.
 */
export const requestPlace = (
  placeOfService: string | undefined,
  category: VenueCategory | undefined
): string | undefined => {
  if (placeOfService) return placeOfService
  const places = category?.placeOfService ?? []
  return !category?.hasMenu && places.length === 1 ? places[0] : undefined
}

/** Whether the request is at a fixed location of this category. */
export const isAtFixedLocation = (
  placeOfService: string | undefined,
  category: VenueCategory | undefined
): boolean => requestPlace(placeOfService, category) === FIXED_LOCATIONS

/**
 * Whether the customer is asked the venue: the request is at a fixed
 * location and there is more than one to choose from. One venue is picked
 * without asking (pickedVenue); none leaves the request without one.
 */
export const asksVenue = (
  placeOfService: string | undefined,
  category: VenueCategory | undefined
): boolean =>
  isAtFixedLocation(placeOfService, category) &&
  (category?.fixedLocations?.length ?? 0) > 1

/**
 * The venue the request is at: the one chosen while the category still
 * lists it, or the category's only venue. Undefined when the request is not
 * at a fixed location, so a venue never outlives a change of place.
 */
export const pickedVenue = (
  fixedLocationId: number | undefined,
  placeOfService: string | undefined,
  category: VenueCategory | undefined
): number | undefined => {
  if (!isAtFixedLocation(placeOfService, category)) return undefined
  const venues = category?.fixedLocations ?? []
  if (venues.length === 1) return venues[0].id
  return fixedLocationId != null && venues.some((v) => v.id === fixedLocationId)
    ? fixedLocationId
    : undefined
}

/**
 * What the pros listing is asked for the place: a fixed location goes out
 * only with its venue (and never with the customer's address, which the
 * server refuses there); without one the place is left out and the listing
 * shows every pro who can serve the address, as before the venue step.
 * Online goes out without the address; everything else with it.
 */
export const listingPlace = ({
  placeOfService,
  fixedLocationId,
  coords,
}: {
  placeOfService: string | undefined
  fixedLocationId: number | undefined
  coords: { lat: number; lon: number } | undefined
}): {
  placeOfService?: string
  fixedLocationId?: number
  customerAddress?: { latitude: number; longitude: number }
} => {
  const customerAddress = coords
    ? { latitude: coords.lat, longitude: coords.lon }
    : undefined

  if (fixedLocationId != null) {
    return { placeOfService: FIXED_LOCATIONS, fixedLocationId }
  }
  if (placeOfService === FIXED_LOCATIONS) {
    return { customerAddress }
  }
  if (placeOfService === "remoteOrOnline") {
    return { placeOfService }
  }
  return { placeOfService, customerAddress }
}

/** A venue's name in the app's language, falling back to English. */
export const venueName = (
  venue: Pick<FixedLocationType, "nameEn" | "nameAr"> | undefined | null,
  isAr: boolean
): string => (venue ? (isAr && venue.nameAr) || venue.nameEn : "")

/** A venue's point as the maps take it, or undefined when it has none. */
export const venuePoint = (
  venue: Pick<FixedLocationType, "location"> | undefined | null
): { latitude: number; longitude: number } | undefined => {
  const [lng, lat] = venue?.location?.coordinates ?? []
  return typeof lat === "number" && typeof lng === "number"
    ? { latitude: lat, longitude: lng }
    : undefined
}
