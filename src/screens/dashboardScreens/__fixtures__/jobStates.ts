/**
 * Jest only. The job states S1's screens (Talabati, JobDetail, RequestDetails,
 * ReviewProSelection, ReviewForm) are captured in, built from the kit's JOB,
 * JOB_FOOD and pros (testing/screenKit/fixtures/entities.ts). Data only: it
 * imports no app module, so a test can import it at the top.
 */
import type { JobProType, JobType } from "types/job"
import type { ProType } from "types/pro"

import {
  CATEGORY,
  CATEGORY_FOOD,
  DAYS_AGO,
  HOURS_AGO,
  JOB,
  JOB_FOOD,
  JOB_PRO_OFFER,
  JOB_PRO_WAITING,
  PRO_COMPANY,
  PRO_FOOD,
  PRO_INDIVIDUAL,
  some,
} from "testing/screenKit/fixtures/entities"

/** The art a trust sticker or an OFFERS sticker fetches: a red block, the same for every url. */
export const SVG_ART =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 118 31"><rect width="118" height="31" fill="#CC0000"/></svg>'

const stickers = (id: number) => ({
  id,
  type: "motivational",
  status: "active",
  product: {
    subType: "motivational",
    pictureEn: `https://example.com/parity/sticker-${id}-en.svg`,
    pictureAr: `https://example.com/parity/sticker-${id}-ar.svg`,
  },
})

/** An individual with no photo at all (the initial draws instead). */
export const PRO_NO_PHOTO: ProType = {
  ...PRO_INDIVIDUAL,
  id: 1004,
  registeredName: "Salma Nour",
  profilePhoto: undefined,
  profilePhoto150: undefined,
  profilePhoto720: undefined,
}

/** A featured company with a trust sticker and an OFFERS sticker. */
export const PRO_FEATURED: ProType = {
  ...PRO_COMPANY,
  id: 1005,
  registeredName: "Nile Plumbing Co.",
  businessName: "Nile Plumbing Co.",
  serviceCategories: [
    {
      serviceCategoryId: CATEGORY.id,
      status: "active",
      isFeatured: true,
      subscriptions: [stickers(31) as never],
    },
  ],
  documents: [
    {
      id: 71,
      type: "trust",
      status: "approved",
      trustDocumentData: {
        trustProduct: {
          descriptionEn: "Verified business",
          descriptionAr: "نشاط موثق",
          pictureEn: "https://example.com/parity/trust-en.svg",
          pictureAr: "https://example.com/parity/trust-ar.svg",
        },
      },
    },
  ],
}

/** A pro who answered an invitation (an offer in): the Selected tab's normal card. */
export const SELECTED_OFFER: JobProType = { ...JOB_PRO_OFFER }

/** An invited pro who has not answered. */
export const SELECTED_WAITING: JobProType = { ...JOB_PRO_WAITING }

/** An invited pro who declined: the dimmed card. */
export const SELECTED_DECLINED: JobProType = {
  id: 9010,
  jobId: JOB.id,
  proId: PRO_NO_PHOTO.id,
  selectionStatus: "proRejected",
  pro: PRO_NO_PHOTO,
  offers: [],
  review: null,
}

/** An opportunity pro who has not offered yet (Other Pros tab, with its notes). */
export const OPPORTUNITY: JobProType = {
  id: 9011,
  jobId: JOB.id,
  proId: PRO_FEATURED.id,
  selectionStatus: "opportunity",
  opportunityNotes: "I have a free slot tomorrow morning and my own parts.",
  pro: PRO_FEATURED,
  offers: [],
  review: null,
}

/** An opportunity pro who offered (a price on the Other Pros card). */
export const OPPORTUNITY_OFFERED: JobProType = {
  id: 9012,
  jobId: JOB.id,
  proId: 1006,
  selectionStatus: "offer",
  ratePerHour: 220,
  proOpportunityOfferSentAt: HOURS_AGO(1),
  proOfferSentAt: HOURS_AGO(1),
  pro: { ...PRO_INDIVIDUAL, id: 1006, registeredName: "Karim Fathy" },
  offers: [],
  review: null,
}

/** The kit's JOB with other pros. */
const jobWith = (pros: JobProType[], more: Partial<JobType> = {}): JobType => ({
  ...JOB,
  pros,
  ...more,
})

export const JOB_NO_PROS = jobWith([])
export const JOB_DECLINED_ONE = jobWith([SELECTED_OFFER, SELECTED_DECLINED])
export const JOB_OPPORTUNITIES = jobWith([
  SELECTED_OFFER,
  OPPORTUNITY,
  OPPORTUNITY_OFFERED,
])
/** Every invited pro declined: the "find other pros" rescue card. */
export const JOB_STRANDED = jobWith([
  { ...SELECTED_DECLINED },
  { ...SELECTED_DECLINED, id: 9013, proId: PRO_COMPANY.id, pro: PRO_COMPANY },
])
export const JOB_ENDED = jobWith([SELECTED_OFFER, SELECTED_WAITING], {
  status: "ended",
})
export const JOB_COMPLETED = jobWith([SELECTED_OFFER], { status: "completed" })

// ---------------------------------------------------------------------------
// Talabati: a job in each state the list words differently

const listed = (id: number, more: Partial<JobType>): JobType => ({
  ...JOB,
  id,
  ...more,
  pros: more.pros ?? [],
})

const REVIEWABLE: JobProType = { ...SELECTED_OFFER, review: null }
const REVIEWED: JobProType = {
  ...SELECTED_OFFER,
  id: 9020,
  review: { id: 1, status: "approved", overallScore: 5 },
}

export const TALABATI_JOBS: JobType[] = [
  // an active request with offers waiting and a review to leave
  listed(8101, {
    requestedOn: HOURS_AGO(2),
    // two offers waiting (one of them already reviewed), one pro to review
    pros: [
      REVIEWABLE,
      OPPORTUNITY,
      { ...OPPORTUNITY_OFFERED, review: REVIEWED.review },
    ],
  }),
  // active, no area, nothing else
  listed(8102, {
    requestedOn: DAYS_AGO(1),
    address: { address: { streetAddress: "1 Street" } },
    pros: [SELECTED_WAITING],
  }),
  listed(8103, {
    status: "completed",
    requestedOn: DAYS_AGO(5),
    pros: [REVIEWED],
  }),
  listed(8104, { status: "cancelled", requestedOn: DAYS_AGO(6) }),
  listed(8105, { status: "cancelledByPro", requestedOn: DAYS_AGO(7) }),
  listed(8106, { status: "declined", requestedOn: DAYS_AGO(8) }),
  listed(8107, { status: "ended", requestedOn: DAYS_AGO(9) }),
  listed(8108, { status: "cancelledByTappler", requestedOn: DAYS_AGO(10) }),
  listed(8109, { status: "somethingNew", requestedOn: DAYS_AGO(11) }),
  // a food order the restaurant declined, one it cancelled after accepting
  listed(8110, {
    requestedOn: DAYS_AGO(2),
    serviceCategoryId: CATEGORY_FOOD.id,
    serviceCategory: JOB_FOOD.serviceCategory,
    pros: [
      {
        ...JOB_FOOD.pros![0],
        selectionStatus: "proRejected",
        status: undefined,
      },
    ],
  }),
  listed(8111, {
    requestedOn: DAYS_AGO(3),
    serviceCategoryId: CATEGORY_FOOD.id,
    serviceCategory: JOB_FOOD.serviceCategory,
    pros: [{ ...JOB_FOOD.pros![0], status: "cancelled" }],
  }),
  // a food order on its way (active, green)
  { ...JOB_FOOD, id: 8112, requestedOn: DAYS_AGO(4) },
  // no category at all
  listed(8113, { serviceCategory: undefined, requestedOn: DAYS_AGO(12) }),
]

// ---------------------------------------------------------------------------
// Food orders (JobDetail's FoodOrderView, RequestDetails)

const foodPro = (more: Partial<JobProType>): JobProType => ({
  ...JOB_FOOD.pros![0],
  ...more,
})

const foodJob = (more: Partial<JobType>): JobType => ({ ...JOB_FOOD, ...more })

const KITCHEN_PRO: ProType = {
  ...PRO_FOOD,
  serviceCategories: [
    {
      serviceCategoryId: CATEGORY_FOOD.id,
      status: "active",
      isFeatured: true,
      subscriptions: [stickers(32) as never],
    },
  ],
  documents: PRO_FEATURED.documents,
}

/** Accepted, delivery, a note, a dated slot, two lines with options. */
export const FOOD_ACCEPTED = foodJob({
  orderNotes: "Please ring the bell twice.",
  dateType: "date",
  dates: [{ id: 1, date: "2026-10-23" }],
  timeSlots: [{ id: 1, start: "13:00:00", end: "15:30:00" }],
  foodOrderItems: [
    {
      id: 1,
      menuItemId: 411,
      name: "Molokhia with chicken",
      price: 185,
      quantity: 2,
      selectedOptions: [
        { optionName: "Bread", choices: [{ name: "Extra bread", price: 10 }] },
      ],
    },
    { id: 2, menuItemId: 412, name: "Rice", price: 40, quantity: 1 },
  ],
  pros: [foodPro({ status: "accepted", pro: KITCHEN_PRO })],
})
export const FOOD_PREPARING = foodJob({})
export const FOOD_COURIER = foodJob({
  pros: [foodPro({ status: "withDeliveryCourier" })],
})
export const FOOD_DELIVERED = foodJob({
  pros: [foodPro({ status: "delivered" })],
  orderDiscount: 30,
})
/** A pickup order: ready for pickup, card on pickup, no fee, a morning slot ending at midnight. */
export const FOOD_PICKUP = foodJob({
  placeOfService: "pickup",
  paymentMethod: "creditCard",
  deliveryFee: 0,
  dateType: "date",
  dates: [{ id: 1, date: "2026-10-23" }],
  timeSlots: [{ id: 1, start: "22:00:00", end: "00:00:00" }],
  pros: [foodPro({ status: "readyForPickup" })],
})
/** The kitchen has not answered, ASAP, no fee. */
export const FOOD_SENT = foodJob({
  dateType: "asap",
  deliveryFee: 0,
  pros: [foodPro({ status: undefined })],
})
export const FOOD_CANCELLED_BY_CUSTOMER = foodJob({
  status: "cancelled",
  pros: [foodPro({ status: undefined })],
})
export const FOOD_CANCELLED_BY_KITCHEN = foodJob({
  status: "cancelled",
  pros: [
    foodPro({
      status: "cancelled",
      foodOrderCancelReason: "customerNotAnswering",
    }),
  ],
})
/** The restaurant pulled it after accepting: the job settled to cancelledByPro and the reason is hidden from customers (Other). */
export const FOOD_CANCELLED_BY_PLACE_NO_REASON = foodJob({
  status: "cancelledByPro",
  pros: [foodPro({ status: "cancelled", foodOrderCancelReason: undefined })],
})
/** A reason this build has no line for (newer than the build): the plain line, never the raw key. */
export const FOOD_CANCELLED_BY_PLACE_UNKNOWN_REASON = foodJob({
  status: "cancelledByPro",
  pros: [
    foodPro({ status: "cancelled", foodOrderCancelReason: "somethingNew" }),
  ],
})
/** Moderation took it down. */
export const FOOD_MODERATED = foodJob({
  status: "cancelledByTappler",
  pros: [foodPro({ status: "cancelledByTappler" })],
})
/** The clock ended an order the restaurant never answered. */
export const FOOD_EXPIRED = foodJob({
  status: "ended",
  dateType: "asap",
  deliveryFee: 0,
  pros: [foodPro({ selectionStatus: "selected", status: "ended" })],
})
/** The clock ended an order the restaurant had accepted and never marked finished. */
export const FOOD_CLOSED = foodJob({
  status: "ended",
  pros: [foodPro({ status: "ended" })],
})
export const FOOD_CLOSED_PICKUP = foodJob({
  status: "ended",
  placeOfService: "pickup",
  deliveryFee: 0,
  pros: [foodPro({ status: "ended" })],
})
export const FOOD_DECLINED = foodJob({
  pros: [foodPro({ selectionStatus: "proRejected", status: undefined })],
})
export const FOOD_NO_PRO = foodJob({ pros: [] })

// ---------------------------------------------------------------------------
// Talabati: food orders in each state the list words, and whether it may be reviewed

const listedFood = (
  id: number,
  hoursAgo: number,
  status: string,
  pro: Partial<JobProType>
): JobType => ({
  ...JOB_FOOD,
  id,
  status,
  requestedOn: HOURS_AGO(hoursAgo),
  pros: [{ ...JOB_FOOD.pros![0], ...pro }],
})

export const TALABATI_FOOD_JOBS: JobType[] = [
  // delivered, not yet reviewed: the one that offers "Leave review"
  listedFood(8301, 1, "completed", { status: "delivered" }),
  // accepted, then cooking, then on its way: no review yet
  listedFood(8302, 2, "active", { status: "accepted" }),
  listedFood(8303, 3, "active", { status: "withDeliveryCourier" }),
  // the restaurant pulled it after accepting
  listedFood(8304, 4, "cancelledByPro", { status: "cancelled" }),
  // moderation
  listedFood(8305, 5, "cancelledByTappler", { status: "cancelledByTappler" }),
  // the clock: never answered, accepted and never finished
  listedFood(8306, 6, "ended", { selectionStatus: "selected", status: "ended" }),
  listedFood(8307, 7, "ended", { status: "ended" }),
  // the customer's own cancel, after an accept
  listedFood(8308, 8, "cancelled", { status: "accepted" }),
]

// ---------------------------------------------------------------------------
// ReviewProSelection and ReviewForm

const reviewable = (id: number, pro: ProType): JobProType => ({
  id: 9100 + id,
  jobId: JOB.id,
  proId: pro.id,
  selectionStatus: "offer",
  ratePerHour: 150,
  proOfferSentAt: HOURS_AGO(3),
  pro,
  offers: [],
  review: null,
})

/** Three pros to review (a photo, a company with a photo, none), one already reviewed, one only selected. */
export const JOB_REVIEWABLE = jobWith([
  reviewable(1, PRO_INDIVIDUAL),
  reviewable(2, PRO_FEATURED),
  reviewable(3, PRO_NO_PHOTO),
  { ...REVIEWED, proId: 1007, pro: { ...PRO_INDIVIDUAL, id: 1007 } },
  SELECTED_WAITING,
])
/** Nothing left to review. */
export const JOB_ALL_REVIEWED = jobWith([REVIEWED])
export { some }
