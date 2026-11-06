import type { ServiceCategoryType } from "types/cms"

/**
 * A seeded place of service (Repost and Find other pros start from the old
 * job's) if its category still offers it, else undefined.
 *
 * Staff can take a place off a category after the job was made. Seeded
 * anyway, the listing asks the server for that mode, which lists nobody,
 * and a single-place category never asks the question again (a multi-place
 * one counts the seed as answered), so the customer had no way out but
 * Reset all. Cleared here, the listing opens on every pro who can serve the
 * address and the question flow asks again where there is a choice.
 *
 * Food's pickup and delivery are both served from a delivery place, so
 * either stays while the category offers delivery. With no category (the
 * service didn't load) the seed is kept: nothing says it is gone.
 */
export const offeredPlaceOfService = (
  placeOfService: string | undefined,
  category: Pick<ServiceCategoryType, "placeOfService" | "hasMenu"> | undefined
): string | undefined => {
  const places = category?.placeOfService
  if (!placeOfService || !places) return placeOfService
  const place =
    category?.hasMenu && placeOfService === "pickup"
      ? "delivery"
      : placeOfService
  return places.includes(place) ? placeOfService : undefined
}
