/**
 * Jest only. What the chat screen is captured with (S3, W2): the previews it
 * opens from (a direct chat, a request with an offer in, an ended one, a food
 * order, a pro with no photo), and the threads it draws (the kinds of message
 * the chat holds, by what each one draws). Made up, typed by the app's own
 * types, dated from the kit's clock. MessageComponent has its own rows for
 * every kind; these put each one inside the screen.
 */
import type { ChatFileType, ChatMessageType, ChatPreviewType } from "types/chat"
import type { JobType } from "types/job"

import {
  CHAT,
  CHAT_MESSAGES,
  CHAT_PREVIEW,
  HOURS_AGO,
  JOB,
  JOB_FOOD,
  some,
} from "testing/screenKit/fixtures/entities"

const preview = (
  job: JobType | undefined,
  over: Partial<ChatPreviewType["chat"]> = {}
): ChatPreviewType => ({
  ...CHAT_PREVIEW,
  chat: { ...CHAT, ...(job ? { jobId: job.id, job } : {}), ...over },
})

/** A direct chat: no request behind it, so no offer, no action bar. */
export const DIRECT = CHAT_PREVIEW
/** A request that is open, with an offer of 150 in. */
export const WITH_OFFER = preview(JOB)
/** The same request, ended: the repost strip, attachments dimmed. */
export const ENDED = preview({ ...JOB, status: "ended" })
/** A food order a kitchen is preparing (no hourly offer). */
export const FOOD = preview(JOB_FOOD)
/** A food order delivered: its chat is still open for a photo. */
export const FOOD_DELIVERED = preview({ ...JOB_FOOD, status: "completed" })
/** A pro with no photo and no last-seen time: the initial in a red disc. */
export const NO_PHOTO = preview(undefined, {
  pro: {
    ...CHAT.pro,
    profilePhoto: undefined,
    profilePhoto150: undefined,
    lastSeen: undefined,
  },
})

const at = (
  id: number,
  ownerType: ChatMessageType["ownerType"],
  hoursAgo: number,
  rest: Partial<ChatMessageType> = {}
): ChatMessageType => ({
  id,
  chatId: CHAT.id,
  ownerType,
  createdAt: HOURS_AGO(hoursAgo),
  readAt: ownerType === "customer" ? HOURS_AGO(hoursAgo - 0.1) : undefined,
  ...rest,
})

const image = (n: number): ChatFileType => ({
  id: 900 + n,
  fileName: `photo${n}.jpg`,
  extension: "jpg",
  originalName: `photo${n}.jpg`,
  mimeType: "image/jpeg",
  storageKey: `parity/photo${n}.jpg`,
  url: `https://example.com/parity/photo${n}.jpg`,
  url720: `https://example.com/parity/photo${n}-720.jpg`,
  url150: `https://example.com/parity/photo${n}-150.jpg`,
})
const pdf: ChatFileType = {
  id: 950,
  fileName: "quote.pdf",
  extension: "pdf",
  originalName: "quote.pdf",
  mimeType: "application/pdf",
  storageKey: "parity/quote.pdf",
  url: "https://example.com/parity/quote.pdf",
}

/** The kit's thread (the pro's text, a reply, a photo, a location): a direct chat's. */
export const THREAD = CHAT_MESSAGES

/** Text across three days: the date headers, grouping, and the read receipt. */
export const DATES_AND_TEXT: ChatMessageType[] = [
  at(7301, "customer", 1, { text: "Perfect, see you then." }),
  at(7302, "pro", 2.5, { text: "Great, I will bring a spare washer." }),
  at(7303, "pro", 2.6, {
    text: "I will be there at 10, it should take an hour.",
  }),
  at(7304, "customer", 28, {
    text: "Can you come Thursday? The tap has been dripping for two days now and it is getting worse.",
  }),
  at(7305, "pro", 29, { text: "Hello! I saw your request." }),
  at(7306, "customer", 300, { text: "Hi", readAt: null }),
]

/** Photos of every count, a document, a location, and an attachment with nothing in it. */
export const ATTACHMENTS: ChatMessageType[] = [
  at(7401, "customer", 1, {
    location: { id: 2, latitude: 30.0444, longitude: 31.2357 },
  }),
  at(7402, "pro", 1.5, { files: [pdf], text: "The quote, as discussed." }),
  at(7403, "customer", 2, { files: [1, 2, 3, 4, 5].map(image) }),
  at(7404, "pro", 2.5, { files: [1, 2, 3].map(image) }),
  at(7405, "customer", 3, { files: [1, 2].map(image) }),
  at(7406, "pro", 3.5, { files: [image(1)], text: "Is it this one?" }),
  at(7407, "pro", 4, {
    location: { id: 3, latitude: 30.0385, longitude: 31.2118 },
  }),
  // An attachment whose upload never landed: nothing to draw but its frame.
  at(7408, "customer", 4.5, {}),
]

/** Every system line the thread can hold. */
export const SYSTEM_EVENTS: ChatMessageType[] = [
  at(7501, "system", 1, { text: "food_order_delivered" }),
  at(7502, "system", 1.5, { text: "food_order_with_courier" }),
  at(7503, "system", 2, { text: "food_order_preparing" }),
  at(7504, "system", 2.5, { text: "food_order_accepted" }),
  at(7505, "system", 3, { text: "food_order_cancelled_by_pro" }),
  at(7506, "system", 3.5, { text: "job_cancelled_by_customer" }),
  at(7507, "system", 4, { text: "job_expired" }),
  at(7508, "system", 4.5, { text: "offer_updated:150:120" }),
  at(7509, "system", 5, { text: "opportunity_accepted" }),
  // Dropped by the thread: the offer pill says it.
  at(7510, "system", 5.5, { text: "offer_sent_to_customer" }),
]

/** Twenty texts: a full page, so the list reports there may be more to load. */
export const LONG_THREAD: ChatMessageType[] = Array.from(
  { length: 20 },
  (_, i) =>
    at(7600 + i, i % 2 ? "customer" : "pro", 1 + i * 0.2, {
      text: `Message number ${20 - i}`,
    })
)

/** What the request sheet reads from /details: dated, with every kind of answer. */
export const JOB_DETAILS: JobType = some<JobType>({
  ...JOB,
  dates: [{ date: "2026-10-24" }],
  timeSlots: [{ start: "10:00", end: "12:00" }],
  // The /details payload's rows are rich (nested question and options), which the
  // job type's flat answers don't spell: the screen reads them as any.
  questionsAnswers: [
    {
      questionId: 701,
      question: {
        text: "What needs fixing?",
        textAr: "ما الذي يحتاج إلى إصلاح؟",
      },
      options: [{ label: "A leaking tap", labelAr: "صنبور يسرب" }],
    },
    {
      questionId: 702,
      question: {
        text: "Anything the pro should know?",
        textAr: "هل هناك ما يجب أن يعرفه المحترف؟",
      },
      answer: "Under the kitchen sink, behind the bin.",
    },
    {
      questionId: 703,
      question: { text: "Photos", textAr: "صور" },
      files: [{ id: 1 }, { id: 2 }],
    },
    // A row with nothing to show is skipped.
    { questionId: 704 },
  ] as unknown as JobType["questionsAnswers"],
})
