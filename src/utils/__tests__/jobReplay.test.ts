import { describe, expect, it } from "@jest/globals"

import type { JobType } from "types/job"
import { replayedChanges } from "utils/jobReplay"

/*
 * A retry with a kept Idempotency-Key is answered with the job the first
 * attempt created. Changes made in between show up as differences between
 * what was sent and that job.
 */
const SENT = {
  serviceCategoryId: 302,
  prosIds: [1003],
  foodOrderItems: [
    { menuItemId: 411, quantity: 2 },
    { menuItemId: 412, quantity: 1 },
  ],
  placeOfService: "delivery",
  paymentMethod: "cash",
  address: {
    city: "Giza",
    governorate: "Giza",
    location: { lat: 30.0444, lng: 31.2357 },
  },
}

const JOB = {
  id: 9001,
  serviceCategoryId: 302,
  pros: [{ proId: 1003 }],
  foodOrderItems: [
    { id: 1, menuItemId: 412, name: "B", price: 10, quantity: 1 },
    { id: 2, menuItemId: 411, name: "A", price: 20, quantity: 2 },
  ],
  placeOfService: "delivery",
  paymentMethod: "cash",
  address: { address: { location: { lat: 30.0444, lng: 31.2357 } } },
} as unknown as JobType

describe("replayedChanges", () => {
  it("the same job, whatever order the dishes and pros come back in", () => {
    expect(replayedChanges(SENT, JOB)).toEqual([])
    expect(
      replayedChanges({ ...SENT, prosIds: [2, 1] }, {
        ...JOB,
        pros: [{ proId: 1 }, { proId: 2 }],
      } as unknown as JobType)
    ).toEqual([])
  })

  it("a dish's quantity, an added or a removed dish", () => {
    expect(
      replayedChanges(
        {
          ...SENT,
          foodOrderItems: [
            { menuItemId: 411, quantity: 3 },
            { menuItemId: 412, quantity: 1 },
          ],
        },
        JOB
      )
    ).toEqual(["foodOrderItems"])
    expect(
      replayedChanges(
        { ...SENT, foodOrderItems: [{ menuItemId: 411, quantity: 2 }] },
        JOB
      )
    ).toEqual(["foodOrderItems"])
  })

  it("a pro taken off a job post", () => {
    expect(
      replayedChanges({ serviceCategoryId: 301, prosIds: [1001] }, {
        serviceCategoryId: 301,
        pros: [{ proId: 1001 }, { proId: 1002 }],
      } as unknown as JobType)
    ).toEqual(["prosIds"])
  })

  it("the payment method, the place of service and the address", () => {
    expect(
      replayedChanges(
        {
          ...SENT,
          paymentMethod: "creditCard",
          placeOfService: "pickup",
          address: { ...SENT.address, location: { lat: 30.05, lng: 31.2357 } },
        },
        JOB
      )
    ).toEqual(["paymentMethod", "placeOfService", "address"])
  })

  it("a float round trip is still the same point", () => {
    expect(
      replayedChanges(
        {
          ...SENT,
          address: {
            ...SENT.address,
            location: { lat: 30.04440000001, lng: 31.2357 },
          },
        },
        JOB
      )
    ).toEqual([])
  })

  it("compares only what the answer carries", () => {
    expect(replayedChanges(SENT, { id: 8301 } as unknown as JobType)).toEqual(
      []
    )
    expect(replayedChanges(SENT, undefined)).toEqual([])
    expect(
      replayedChanges({ serviceCategoryId: 301, prosIds: [1001] }, {
        ...JOB,
        serviceCategoryId: 301,
        pros: [{ proId: 1001 }],
        foodOrderItems: [],
      } as unknown as JobType)
    ).toEqual([])
  })
})
