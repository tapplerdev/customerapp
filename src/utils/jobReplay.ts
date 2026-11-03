import type { JobType } from "types/job"

/*
 * A job post or food order sent again with the Idempotency-Key of one that
 * already went through is answered with THAT job (be#416), 201 like a new
 * one. The key is kept on purpose after a timeout or a 5xx (the first attempt
 * may have landed), so when the customer changed something before trying
 * again, the answer is the earlier job, without the change. This tells the
 * two apart: what the answer holds against what was just sent.
 *
 * The backend's JobReplayGuard (differingFromJob, job-replay.guard.ts) logs
 * the same comparison: the category, the pros, and each dish with its
 * quantity. The payment method, the place of service and the address's point
 * are compared here too, since the checkout can change them before a retry
 * and the server stores them as sent. A field the answer doesn't carry is not
 * compared, so a slimmer answer can only miss a change, never invent one.
 */

// What a CreateJobRequest carries that the comparison reads.
type Sent = {
  serviceCategoryId?: number
  prosIds?: number[]
  foodOrderItems?: { menuItemId: number; quantity: number }[]
  placeOfService?: string
  paymentMethod?: string
  address?: { location?: { lat: number; lng: number } }
}

const sortedIds = (values: unknown[]): string =>
  values
    .map(Number)
    .sort((a, b) => a - b)
    .join(",")

const dishes = (items: { menuItemId?: unknown; quantity?: unknown }[]): string =>
  items
    .map((item) => `${Number(item?.menuItemId)}x${Number(item?.quantity)}`)
    .sort()
    .join(",")

// The server keeps the point as sent; anything closer than about 10 cm is the
// same place, whatever a float round trip did to it.
const SAME_POINT = 1e-6

const pointOf = (job: JobType): { lat: number; lng: number } | undefined => {
  const location = job.address?.address?.location ?? job.address?.location
  const lat = location?.lat ?? (location as { latitude?: number })?.latitude
  const lng = location?.lng ?? (location as { longitude?: number })?.longitude
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : undefined
}

/** The fields where the job answered differs from what was sent; [] when it's the same job. */
export const replayedChanges = (sent: Sent, job: JobType | undefined | null): string[] => {
  if (!job) return []
  const changed: string[] = []

  if (
    typeof job.serviceCategoryId === "number" &&
    Number(sent.serviceCategoryId) !== job.serviceCategoryId
  ) {
    changed.push("serviceCategoryId")
  }
  if (
    Array.isArray(job.pros) &&
    sortedIds(sent.prosIds ?? []) !== sortedIds(job.pros.map(({ proId }) => proId))
  ) {
    changed.push("prosIds")
  }
  if (
    Array.isArray(job.foodOrderItems) &&
    dishes(sent.foodOrderItems ?? []) !== dishes(job.foodOrderItems)
  ) {
    changed.push("foodOrderItems")
  }
  if (
    sent.paymentMethod !== undefined &&
    job.paymentMethod !== undefined &&
    job.paymentMethod !== null &&
    sent.paymentMethod !== job.paymentMethod
  ) {
    changed.push("paymentMethod")
  }
  if (
    sent.placeOfService !== undefined &&
    job.placeOfService !== undefined &&
    job.placeOfService !== null &&
    sent.placeOfService !== job.placeOfService
  ) {
    changed.push("placeOfService")
  }
  const point = pointOf(job)
  const sentPoint = sent.address?.location
  if (
    point &&
    sentPoint &&
    (Math.abs(point.lat - sentPoint.lat) > SAME_POINT ||
      Math.abs(point.lng - sentPoint.lng) > SAME_POINT)
  ) {
    changed.push("address")
  }

  return changed
}
