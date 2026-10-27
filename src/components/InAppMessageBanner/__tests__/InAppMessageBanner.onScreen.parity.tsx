/* The kit loads each render's modules in the render's registry: the banner's
   event bus and the navigation ref are required inside the row's. */
import { describe, expect, it, jest } from "@jest/globals"
import type { ComponentType } from "react"

import { openScreen } from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * A banner for what the customer is already watching is noise: the same event
 * refreshes the open order, so the news arrives under their eyes. Except when
 * the news is that the order is over (declined, cancelled by either side, or
 * ended by the clock), which is the one update that needs them to act and the
 * one that is lost if it is swallowed because they happened to be on the
 * screen. `ended` is on that list since #512 phase 4: the order screen
 * otherwise kept saying "Sent to Pro" with no banner to say why it stopped.
 *
 * The order is read from two places, because the job's own status depends on
 * a backend step that can bail: the notification's job (jobStatus) and its
 * top-level foodOrderStatus (foodStatus).
 */

const WATCHING = 3001
const BODY = "Your order was closed."

const notification = (more: Record<string, unknown>) => ({
  event: "system.job:customer.job.foodOrder.status",
  title: "Order closed",
  body: BODY,
  jobId: WATCHING,
  ...more,
})

const CASES: {
  name: string
  payload: Record<string, unknown>
  shown: boolean
}[] = [
  {
    name: "a step of the order they are watching is not announced",
    payload: notification({ jobStatus: "active", foodStatus: "preparing" }),
    shown: false,
  },
  {
    name: "the clock ending it is, by the job's status",
    payload: notification({ jobStatus: "ended" }),
    shown: true,
  },
  {
    name: "the clock ending it is, by the food order's own status",
    payload: notification({ jobStatus: "active", foodStatus: "ended" }),
    shown: true,
  },
  {
    name: "the clock ending it is, with only the food order's status",
    payload: notification({ foodStatus: "ended" }),
    shown: true,
  },
  {
    name: "a cancel still is",
    payload: notification({
      jobStatus: "cancelledByPro",
      foodStatus: "cancelled",
    }),
    shown: true,
  },
  {
    name: "a decline still is",
    payload: notification({ jobStatus: "declined" }),
    shown: true,
  },
  {
    name: "the same news for another order is announced like any other",
    payload: notification({
      jobId: WATCHING + 1,
      jobStatus: "active",
      foodStatus: "preparing",
    }),
    shown: true,
  },
]

describe.each(PARITY_MATRIX)(
  "InAppMessageBanner on the order's own screen [$language $platform]",
  (env) => {
    it.each(CASES)("$name", async (row) => {
      const load = () => {
        const ref = require("navigation/navigationRef")
        jest.spyOn(ref.navigationRef, "isReady").mockReturnValue(true)
        jest.spyOn(ref.navigationRef, "getCurrentRoute").mockReturnValue({
          key: "k",
          name: "JobDetailScreen",
          params: { jobId: WATCHING },
        })
        const Banner = require("../InAppMessageBanner").default
        return { default: Banner as ComponentType }
      }
      const session = await openScreen(load, {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
        ...screenState("data"),
      })
      try {
        await session.act(() => {
          const {
            messageBannerEventBus,
          } = require("events/messageBannerEventBus")
          messageBannerEventBus.emit("notification:new", row.payload)
        }, 500)
        expect(JSON.stringify(session.tree()).includes(BODY)).toBe(row.shown)
      } finally {
        jest.restoreAllMocks()
        session.unmount()
      }
    })
  }
)
