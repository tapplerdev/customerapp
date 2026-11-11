import { describe, expect, it, jest } from "@jest/globals"

import i18n from "locales/i18n"
import {
  JobRequestRefusal,
  jobRequestRefusalCopy,
  jobRequestRefusalOf,
} from "utils/jobRequestRefusal"

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

/*
 * POST /jobs's refusals for a request that no longer fits (backend
 * JobRefusalCode): a 400 with the code at the top level and no
 * validationErrors, as RTK Query hands it to the screen.
 */
describe("jobRequestRefusalOf", () => {
  const refused = (code: unknown) => ({
    status: 400,
    data: { code, message: "This pro no longer matches your selection." },
  })

  it("reads each code", () => {
    expect(jobRequestRefusalOf(refused("JOB_PROS_NOT_SERVING"))).toBe(
      JobRequestRefusal.prosNotServing
    )
    expect(
      jobRequestRefusalOf(refused("JOB_PLACE_OF_SERVICE_NOT_OFFERED"))
    ).toBe(JobRequestRefusal.placeOfServiceNotOffered)
    // venue-on-job: the venue picked is no longer the category's.
    expect(jobRequestRefusalOf(refused("JOB_FIXED_LOCATION_NOT_OFFERED"))).toBe(
      JobRequestRefusal.fixedLocationNotOffered
    )
  })

  it("is undefined for every other failure", () => {
    expect(jobRequestRefusalOf(refused("VALIDATION_FAILED"))).toBeUndefined()
    expect(jobRequestRefusalOf(refused(400))).toBeUndefined()
    expect(
      jobRequestRefusalOf({ status: 400, data: { message: "nope" } })
    ).toBeUndefined()
    expect(
      jobRequestRefusalOf({ status: "FETCH_ERROR", error: "offline" })
    ).toBeUndefined()
    expect(jobRequestRefusalOf({ status: 502, data: null })).toBeUndefined()
    expect(jobRequestRefusalOf(undefined)).toBeUndefined()
    expect(jobRequestRefusalOf(null)).toBeUndefined()
  })

  it("has a line in English and Arabic for each code", () => {
    const en = i18n.getFixedT("en")
    const ar = i18n.getFixedT("ar")
    Object.values(JobRequestRefusal).forEach((code) => {
      const key = jobRequestRefusalCopy[code]
      expect(en(key)).not.toBe(key)
      expect(ar(key)).not.toBe(key)
      expect(ar(key)).toMatch(/[؀-ۿ]/)
      expect(en(key)).not.toMatch(/[؀-ۿ]/)
    })
  })
})
