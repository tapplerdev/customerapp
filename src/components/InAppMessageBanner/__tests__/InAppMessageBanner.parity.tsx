/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry: the banner's
   event bus is required inside the step, from the row's. */
import { describe, it } from "@jest/globals"

import { rowsByPlatform, treeAfter, type Step } from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { CHAT_PREVIEW } from "testing/screenKit/fixtures/entities"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"

/*
 * InAppMessageBanner (the slide-down toast over the navigator), pinned to
 * what it drew before its conversion. It is mounted once with no props
 * (src/App.tsx) and draws what the event bus hands it, so each row emits the
 * event a socket does and lets the spring settle (it stays 5 s, the banner
 * has not dismissed itself yet): nothing yet; a chat message with the pro's
 * photo, one from a pro with no photo and only a registered name, and one
 * from a pro with neither name; a notification with its title, and one
 * with none (a config row seeded with a body only).
 *
 * The trees in __parity__ were captured from InAppMessageBanner before its
 * conversion (each case names the commit). Both languages, both platforms.
 *
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

const load = () => require("../InAppMessageBanner")

type Pro = NonNullable<typeof CHAT_PREVIEW.chat.pro>

const previewOf = (pro: Partial<Pro>) => ({
  ...CHAT_PREVIEW,
  chat: { ...CHAT_PREVIEW.chat, pro: { ...CHAT_PREVIEW.chat.pro, ...pro } },
})

const emitMessage =
  (pro: Partial<Pro>, body: string): Step =>
  () => {
    const { messageBannerEventBus } = require("events/messageBannerEventBus")
    messageBannerEventBus.emit("message:new", {
      chatPreview: previewOf(pro),
      body,
    })
  }

const emitNotification =
  (payload: Record<string, unknown>): Step =>
  () => {
    const { messageBannerEventBus } = require("events/messageBannerEventBus")
    messageBannerEventBus.emit("notification:new", payload)
  }

// The spring needs about a second of the kit's clock to arrive.
const arrive = <T extends Step>(step: T): T => {
  step.settleMs = 2500
  return step
}

const CASES: { name: string; steps: Step[] }[] = [
  { name: "nothing yet", steps: [] },
  {
    name: "a message, the pro's photo",
    steps: [
      arrive(
        emitMessage(
          { businessName: "Hassan Plumbing" },
          "I am on my way, see you in 10 minutes."
        )
      ),
    ],
  },
  {
    name: "a message, no photo, a registered name",
    steps: [
      arrive(
        emitMessage(
          {
            businessName: undefined,
            profilePhoto: undefined,
            profilePhoto150: undefined,
          },
          "Can you send me a photo of the tap?"
        )
      ),
    ],
  },
  {
    name: "a message, no photo, no name",
    steps: [
      arrive(
        emitMessage(
          {
            businessName: undefined,
            registeredName: undefined,
            profilePhoto: undefined,
            profilePhoto150: undefined,
          },
          "A long reply that goes on for more than two lines so the body is cut off where the banner stops it, and the customer opens the chat to read the rest of what the pro wrote."
        )
      ),
    ],
  },
  {
    name: "a notification",
    steps: [
      arrive(
        emitNotification({
          event: "system.job:customer.job.offer.received",
          title: "New offer",
          body: "Omar Hassan sent you an offer for Plumbing.",
          jobId: 3001,
        })
      ),
    ],
  },
  {
    name: "a notification without a title",
    steps: [
      arrive(
        emitNotification({
          event: "system.account:customer.jobs.review",
          title: "",
          body: "How was your service?",
        })
      ),
    ],
  },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("InAppMessageBanner draws as before", () => {
  it.each(rows)(
    "$name [$env.language $env.platform]",
    async ({ name, steps, env }) => {
      const tree = await treeAfter(
        load,
        {
          ...screenState("data"),
          lang: env.language,
          platform: env.platform,
          navigation: "none",
        },
        env,
        steps
      )
      expectParity(parityName(name, env), tree)
    }
  )
})
