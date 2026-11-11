/**
 * The refusals POST /jobs answers when what the customer picked no longer
 * fits (backend JobRefusalCode, mode-mismatch 2026-11): a 400 with the code
 * at the top level and no validationErrors.
 *
 * - JOB_PROS_NOT_SERVING: a selected pro no longer serves the request (their
 *   place of service was taken off the category, or doesn't reach the
 *   address). The list is fetched again and drops them.
 * - JOB_PLACE_OF_SERVICE_NOT_OFFERED: the category no longer offers the place
 *   of service chosen. The choice is cleared and the list fetched again.
 * - JOB_FIXED_LOCATION_NOT_OFFERED (venue-on-job): the venue picked is no
 *   longer one of the category's. The venue is cleared and the list fetched
 *   again.
 */
export const JobRequestRefusal = {
  prosNotServing: "JOB_PROS_NOT_SERVING",
  placeOfServiceNotOffered: "JOB_PLACE_OF_SERVICE_NOT_OFFERED",
  fixedLocationNotOffered: "JOB_FIXED_LOCATION_NOT_OFFERED",
} as const

export type JobRequestRefusalCode =
  (typeof JobRequestRefusal)[keyof typeof JobRequestRefusal]

const CODES: readonly string[] = Object.values(JobRequestRefusal)

/** The refusal's code, or undefined for any other failure. */
export const jobRequestRefusalOf = (
  error: unknown
): JobRequestRefusalCode | undefined => {
  const code = (
    (error as { data?: unknown } | null | undefined)?.data as
      { code?: unknown } | null | undefined
  )?.code
  return typeof code === "string" && CODES.includes(code)
    ? (code as JobRequestRefusalCode)
    : undefined
}

/** The app's line for it, a translation key. */
export const jobRequestRefusalCopy: Record<JobRequestRefusalCode, string> = {
  JOB_PROS_NOT_SERVING: "request_pros_not_serving",
  JOB_PLACE_OF_SERVICE_NOT_OFFERED: "request_place_not_offered",
  JOB_FIXED_LOCATION_NOT_OFFERED: "request_location_not_offered",
}
