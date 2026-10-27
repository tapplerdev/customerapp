import { describe, expect, it } from "@jest/globals"

import type { JobProType, JobType } from "types/job"
import { foodOrderEnd, isReviewableJobPro } from "utils/foodOrderState"

/*
 * How a food order ended, and whether it may be reviewed. The order screen and
 * the Talabati list both ask these, so a row in this table is a row on both.
 */
const pro = (more: Partial<JobProType> = {}): JobProType =>
  ({
    id: 1,
    jobId: 40,
    proId: 2,
    selectionStatus: "offer",
    ...more,
  } as JobProType)

const job = (
  status: string,
  jobPro: Partial<JobProType> | null = {},
  more: Partial<JobType> = {}
): JobType =>
  ({
    id: 40,
    status,
    serviceCategory: { hasMenu: true },
    pros: jobPro ? [pro(jobPro)] : [],
    ...more,
  } as JobType)

describe("foodOrderEnd", () => {
  it.each([
    ["live: accepted", job("active", { status: "accepted" }), null],
    [
      "live: not answered",
      job("active", { selectionStatus: "selected" }),
      null,
    ],
    ["delivered, completed", job("completed", { status: "delivered" }), null],
    ["no pro row at all", job("active", null), null],
    [
      "the customer's cancel, row still accepted",
      job("cancelled", { status: "accepted" }),
      "cancelledByCustomer",
    ],
    [
      "the customer's cancel, row cancelled with no reason",
      job("cancelled", { status: "cancelled" }),
      "cancelledByCustomer",
    ],
    [
      "the customer's cancel, nothing on the row",
      job("cancelled", { status: undefined }),
      "cancelledByCustomer",
    ],
    [
      "the restaurant's cancel with a reason",
      job("cancelledByPro", {
        status: "cancelled",
        foodOrderCancelReason: "tooBusy",
      }),
      "cancelledByPlace",
    ],
    [
      "the restaurant's cancel with the reason hidden (Other)",
      job("cancelledByPro", { status: "cancelled" }),
      "cancelledByPlace",
    ],
    [
      "the restaurant's cancel before the job settled",
      job("active", { status: "cancelled" }),
      "cancelledByPlace",
    ],
    [
      "the job settled without the row",
      job("cancelledByPro", { status: "preparing" }),
      "cancelledByPlace",
    ],
    [
      "a reason on a job still marked cancelled (an old row)",
      job("cancelled", {
        status: "cancelled",
        foodOrderCancelReason: "customerNotAnswering",
      }),
      "cancelledByPlace",
    ],
    [
      "an old restaurant cancel that expiry overwrote to ended",
      job("ended", { status: "ended", foodOrderCancelReason: "tooBusy" }),
      "cancelledByPlace",
    ],
    [
      "moderated, on the job",
      job("cancelledByTappler", { status: "preparing" }),
      "cancelledByTappler",
    ],
    [
      "moderated, on the row of a job still active",
      job("active", { status: "cancelledByTappler" }),
      "cancelledByTappler",
    ],
    [
      "declined, job still active",
      job("active", { selectionStatus: "proRejected" }),
      "declined",
    ],
    ["declined, job settled", job("declined", {}), "declined"],
    [
      "never answered, ended",
      job("ended", { selectionStatus: "selected", status: "ended" }),
      "expired",
    ],
    [
      "never answered, only the job says ended",
      job("ended", { selectionStatus: "selected" }),
      "expired",
    ],
    [
      "accepted and never finished, ended",
      job("ended", { selectionStatus: "offer", status: "ended" }),
      "closed",
    ],
    [
      "a legacy accept (no status), ended",
      job("ended", { status: undefined }),
      "closed",
    ],
  ])("%s", (_name, order, expected) => {
    expect(foodOrderEnd(order)).toBe(expected)
  })

  it("a cancel wins over a decline, as it always did", () => {
    expect(
      foodOrderEnd(
        job("cancelledByPro", {
          selectionStatus: "proRejected",
          status: "cancelled",
        })
      )
    ).toBe("cancelledByPlace")
  })
})

describe("isReviewableJobPro", () => {
  const food = (status?: string) => job("active", { status })
  const service = (more: Partial<JobProType> = {}) =>
    job("active", more, { serviceCategory: { hasMenu: false } as never })

  it.each([
    ["accepted", false],
    ["preparing", false],
    ["withDeliveryCourier", false],
    ["readyForPickup", false],
    ["cancelled", false],
    ["ended", false],
    ["delivered", true],
  ])("a food order that is %s: %p", (status, expected) => {
    const order = food(status)
    expect(isReviewableJobPro(order, order.pros![0])).toBe(expected)
  })

  it("a food order already reviewed is not", () => {
    const order = job("completed", {
      status: "delivered",
      review: { id: 1, status: "approved", overallScore: 5 } as never,
    })
    expect(isReviewableJobPro(order, order.pros![0])).toBe(false)
  })

  it("a restaurant that never accepted is not, whatever its status", () => {
    const order = job("active", {
      selectionStatus: "proRejected",
      status: "delivered",
    })
    expect(isReviewableJobPro(order, order.pros![0])).toBe(false)
  })

  it("a service request is reviewable from the accepted offer on, as before", () => {
    const order = service({ status: undefined })
    expect(isReviewableJobPro(order, order.pros![0])).toBe(true)
    const selected = service({ selectionStatus: "selected" })
    expect(isReviewableJobPro(selected, selected.pros![0])).toBe(false)
  })
})
