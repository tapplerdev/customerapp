import type { JobProType, JobType } from "types/job"

/**
 * How a food order ended, in the words the customer needs. One place for it,
 * so the order screen and the Talabati list say the same thing about the same
 * order (they drifted before: the list read "Active" for an order the screen
 * called Cancelled).
 *
 * A food order is one job and one restaurant row, and the end can be written on
 * either: the customer's cancel on the job, the restaurant's on the row (and,
 * since the job settles after it, on the job as `cancelledByPro`), moderation
 * on both as `cancelledByTappler`, the clock as `ended` on both. Checked
 * through both axes, because each can lag the other.
 *
 * - cancelledByCustomer  the customer pulled it. `job.status` is the only
 *   signal that is always there: the restaurant's reason is written solely by
 *   the restaurant, so a cancel with none is the customer's.
 * - cancelledByPlace     the restaurant pulled an order it had accepted.
 * - cancelledByTappler   moderation took it down.
 * - declined             the restaurant refused it (selectionStatus, a
 *   different axis from the kitchen status).
 * - expired              the clock ended an order the restaurant never
 *   accepted.
 * - closed               the clock ended an order the restaurant had accepted
 *   and never marked finished.
 */
export type FoodOrderEnd =
  | "cancelledByCustomer"
  | "cancelledByPlace"
  | "cancelledByTappler"
  | "declined"
  | "expired"
  | "closed"

export const foodOrderEnd = (job: JobType): FoodOrderEnd | null => {
  const jobPro = job.pros?.[0]
  const status = jobPro?.status

  if (job.status === "cancelledByTappler" || status === "cancelledByTappler") {
    return "cancelledByTappler"
  }
  if (
    job.status === "cancelled" ||
    job.status === "cancelledByPro" ||
    status === "cancelled"
  ) {
    // Whose cancel: `job.status === "cancelled"` is the customer's, but a
    // restaurant's cancel can leave it there too (rows from before the job
    // settled to cancelledByPro), so the restaurant's reason, which only the
    // restaurant writes, settles it. With no reason, `cancelled` on the job is
    // the customer's own.
    const placeCancelled =
      job.status === "cancelledByPro" ||
      !!jobPro?.foodOrderCancelReason ||
      (status === "cancelled" && job.status !== "cancelled")

    return placeCancelled ? "cancelledByPlace" : "cancelledByCustomer"
  }
  if (jobPro?.selectionStatus === "proRejected" || job.status === "declined") {
    return "declined"
  }
  if (job.status === "ended" || status === "ended") {
    return jobPro?.selectionStatus === "offer" ? "closed" : "expired"
  }

  return null
}

/**
 * Whether the customer may be offered a review of this restaurant. A service
 * request is reviewable from the moment a pro's offer is accepted; a food
 * order only once it is delivered (or picked up: the same status). A review
 * never completes a food order, and "Leave review" on an order that has not
 * arrived is a way to score a restaurant for food the customer does not have.
 */
export const isReviewableJobPro = (job: JobType, jobPro: JobProType): boolean =>
  jobPro.selectionStatus === "offer" &&
  !jobPro.review &&
  (!job.serviceCategory?.hasMenu || jobPro.status === "delivered")
