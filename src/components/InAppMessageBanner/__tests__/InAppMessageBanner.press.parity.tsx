/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry: the banner's
   event bus and the navigation ref are required inside the row's. */
import { describe, expect, it, jest } from "@jest/globals"

import { openScreen } from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { CHAT_PREVIEW } from "testing/screenKit/fixtures/entities"
import { pressContaining } from "testing/pressContaining"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * InAppMessageBanner opens what it announces: a press on a chat message's
 * banner pre-marks that chat active and opens its thread; a press on a
 * notification's banner opens the job it names (the pro picker for a review
 * reminder) or, with no job, the notifications list. (A handler swapped for
 * one that does nothing draws the same tree until it is pressed.)
 */

const REVIEW_EVENT = "system.account:customer.jobs.review"

const CASES: {
  name: string
  event: "message:new" | "notification:new"
  payload: Record<string, unknown>
  words: string
  navigated: [string, unknown]
}[] = [
  {
    name: "a chat message opens its thread",
    event: "message:new",
    payload: { chatPreview: CHAT_PREVIEW, body: "I am on my way." },
    words: "I am on my way.",
    navigated: ["MessagesDetailsScreen", { chatPreview: CHAT_PREVIEW }],
  },
  {
    name: "an offer opens its job",
    event: "notification:new",
    payload: {
      event: "system.job:customer.job.offer.received",
      title: "New offer",
      body: "Omar Hassan sent you an offer.",
      jobId: 3001,
    },
    words: "Omar Hassan sent you an offer.",
    navigated: ["JobDetailScreen", { jobId: 3001 }],
  },
  {
    name: "a review reminder opens the pro picker",
    event: "notification:new",
    payload: {
      event: REVIEW_EVENT,
      title: "Leave a review",
      body: "How was your service?",
      jobId: 3002,
    },
    words: "How was your service?",
    navigated: ["ReviewProSelectionScreen", { jobId: 3002 }],
  },
  {
    name: "a notification with no job opens the list",
    event: "notification:new",
    payload: {
      event: "system.account:customer.welcome",
      title: "Welcome",
      body: "Find a pro for anything.",
    },
    words: "Find a pro for anything.",
    navigated: ["NotificationsScreen", undefined],
  },
]

describe.each(PARITY_MATRIX)(
  "InAppMessageBanner's press [$language $platform]",
  (env) => {
    it.each(CASES)("$name", async (row) => {
      const navigate = jest.fn()
      const load = () => {
        const React = require("react") as typeof import("react")
        // The kit's container isn't the app's navigationRef; the banner
        // calls navigateFromRef through the module, so a spy sees the call.
        const ref = require("navigation/navigationRef")
        jest.spyOn(ref, "navigateFromRef").mockImplementation(navigate as never)
        const Banner = require("../InAppMessageBanner").default
        return { default: Banner as React.ComponentType }
      }
      const session = await openScreen(load, {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
        ...screenState("data"),
      })
      try {
        await session.act(() => {
          const { messageBannerEventBus } = require("events/messageBannerEventBus")
          messageBannerEventBus.emit(row.event, row.payload)
        }, 2500)
        expect(navigate).not.toHaveBeenCalled()
        await session.act(() => {
          pressContaining(session.root, row.words)
        })
        expect(navigate).toHaveBeenCalledTimes(1)
        expect(navigate).toHaveBeenCalledWith(...row.navigated)
        if (row.event === "message:new") {
          const { getActiveChat } = require("services/chatCache")
          expect(getActiveChat()).toBe(CHAT_PREVIEW.chat.id)
        }
      } finally {
        jest.restoreAllMocks()
        session.unmount()
      }
    })
  }
)
