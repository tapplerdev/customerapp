/**
 * Jest only. The records the backend answers with (fixtures/api.ts), one of
 * each the screens open with, made up and typed by the app's own types. A big
 * record is `some<T>()`: only the fields given, each one typed. Dates count
 * back from the kit's clock (engine.tsx DEFAULT_NOW), so "2 hours ago" and a
 * cart draft's freshness come out the same on every run.
 *
 * One answer per endpoint, as the kit's core (skeptic M9): the states an area
 * needs (a job in every status, each message kind on its own) belong to that
 * area's tests, built from these, and move here when a second area wants them.
 */
import type { CartDraft } from "store/cart/slice"
import type {
  ChatMessageType,
  ChatPreviewType,
  ChatType,
} from "types/chat"
import type {
  PresetType,
  ServiceCategoryType,
  ServiceQuestionType,
  ServiceType,
} from "types/cms"
import type {
  AreaGeometryResponse,
  FoodMenuType,
  PointAreasResponse,
} from "types/food"
import type { JobProType, JobType } from "types/job"
import type { NotificationsItemType } from "types/notification"
import type { ProType } from "types/pro"

import { CUSTOMER } from "./users"

type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

/** A record with only the fields the screens read; what is given is typed. */
export const some = <T>(value: DeepPartial<T>) => value as T

/** The kit's clock (engine.tsx DEFAULT_NOW). */
export const KIT_NOW = Date.parse("2026-10-20T08:00:00.000Z")

const HOUR = 60 * 60 * 1000
/** An ISO date `hours` before the kit's clock. */
export const HOURS_AGO = (hours: number) =>
  new Date(KIT_NOW - hours * HOUR).toISOString()
/** An ISO date `days` before the kit's clock. */
export const DAYS_AGO = (days: number) => HOURS_AGO(days * 24)

const IMG = (name: string) => ({
  id: name.length,
  url: `https://example.com/parity/${name}.jpg`,
  url720: `https://example.com/parity/${name}-720.jpg`,
  url150: `https://example.com/parity/${name}-150.jpg`,
})

// ---------------------------------------------------------------------------
// Services and categories

export const QUESTION_PLACE: ServiceQuestionType = {
  id: 701,
  assignee: "customer",
  type: "oneChoice",
  style: "radio",
  text: "What needs fixing?",
  textAr: "ما الذي يحتاج إلى إصلاح؟",
  isFilter: true,
  tier: "primary",
  order: 1,
  options: [
    { id: 7011, label: "A leaking tap", labelAr: "صنبور يسرب", value: "tap" },
    { id: 7012, label: "A blocked drain", labelAr: "صرف مسدود", value: "drain" },
  ],
}

export const QUESTION_NOTES: ServiceQuestionType = {
  id: 702,
  assignee: "customer",
  type: "paragraph",
  text: "Anything the pro should know?",
  textAr: "هل هناك ما يجب أن يعرفه المحترف؟",
  isFilter: false,
  order: 2,
}

export const CATEGORY: ServiceCategoryType = {
  id: 301,
  nameEn: "Plumbing",
  nameAr: "السباكة",
  picture: IMG("plumbing"),
  serviceId: 201,
  placeOfService: ["customerPlace"],
  customerQuestions: [QUESTION_PLACE, QUESTION_NOTES],
  dateTypes: ["asap", "date", "hours48", "week", "notDecided"],
  isUrgent: false,
  hasMenu: false,
}

export const CATEGORY_FOOD: ServiceCategoryType = {
  id: 302,
  nameEn: "Home-cooked meals",
  nameAr: "أكل بيتي",
  picture: IMG("meals"),
  serviceId: 202,
  placeOfService: ["customerPlace", "proPlace"],
  customerQuestions: [],
  dateTypes: [],
  isUrgent: true,
  hasMenu: true,
}

export const SERVICE: ServiceType = {
  id: 201,
  nameEn: "Home repairs",
  nameAr: "إصلاحات المنزل",
  categories: [CATEGORY],
}

export const SERVICE_FOOD: ServiceType = {
  id: 202,
  nameEn: "Food",
  nameAr: "طعام",
  categories: [CATEGORY_FOOD],
}

export const SERVICES: ServiceType[] = [SERVICE, SERVICE_FOOD]

/** The Home screen's active preset: one section of main categories. */
export const PRESET: PresetType = {
  id: 1,
  name: "parity",
  isActive: true,
  updatedAt: DAYS_AGO(3),
  sections: [
    {
      id: 11,
      order: 1,
      shapeType: "squareWithOverlay",
      titleEn: "Popular services",
      titleAr: "الخدمات الشائعة",
      descriptionEn: "What customers book most",
      descriptionAr: "ما يحجزه العملاء أكثر",
      dataSource: "mainCategories",
      viewAll: true,
      groups: [
        {
          id: 111,
          order: 1,
          sectionId: 11,
          items: [
            {
              id: 1111,
              nameEn: "Home repairs",
              nameAr: "إصلاحات المنزل",
              pictureEn: IMG("repairs-en"),
              pictureAr: IMG("repairs-ar"),
              services: [SERVICE],
              groupId: 111,
            },
            {
              id: 1112,
              nameEn: "Food",
              nameAr: "طعام",
              pictureEn: IMG("food-en"),
              pictureAr: IMG("food-ar"),
              services: [SERVICE_FOOD],
              groupId: 111,
            },
          ],
        },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Pros

const REVIEW_SCORE = {
  overallScore: 4.6,
  qualityScore: 4.7,
  completionInTimeScore: 4.5,
  jobAwarenessScore: 4.6,
  honestyScore: 4.8,
  responseTimeScore: 4.4,
  reviewsCount: 18,
}

export const PRO_INDIVIDUAL: ProType = {
  id: 1001,
  registeredName: "Omar Hassan",
  displayName: "full",
  proType: "individual",
  profilePhoto: "https://example.com/parity/pro.jpg",
  profilePhoto150: "https://example.com/parity/pro-150.jpg",
  profilePhoto720: "https://example.com/parity/pro-720.jpg",
  reviewScore: REVIEW_SCORE,
  informationAbout:
    "Ten years fixing plumbing and electrics in Giza and Cairo. Clean work, fair prices.",
  address: {
    changedAt: DAYS_AGO(90),
    address: {
      streetAddress: "5 Mossadak Street",
      city: "Dokki",
      governorate: "Giza",
      location: { lat: 30.0385, lng: 31.2118 },
    },
  },
  serviceCategories: [
    { serviceCategoryId: CATEGORY.id, status: "active", isFeatured: false },
  ],
  documents: [],
  paymentMethods: ["cash", "credit card"],
  hours: [
    { id: 1, dayOfWeek: "sunday", openingTime: "09:00", closingTime: "17:00" },
    { id: 2, dayOfWeek: "monday", openingTime: "09:00", closingTime: "17:00" },
  ],
  workPhotos: [],
  socials: [],
  media: [],
  responseTimeHours: 2,
  lastSeen: HOURS_AGO(1),
}

export const PRO_COMPANY: ProType = {
  ...PRO_INDIVIDUAL,
  id: 1002,
  proType: "company",
  registeredName: "Hassan Home Services",
  businessName: "Hassan Home Services",
  displayName: undefined,
}

/** A food pro (a hasMenu category), delivering and taking pickups. */
export const PRO_FOOD: ProType = {
  ...PRO_INDIVIDUAL,
  id: 1003,
  registeredName: "Laila's Kitchen",
  businessName: "Laila's Kitchen",
  proType: "company",
  distanceKm: 2.4,
  isDeliveryEnabled: true,
  isPickupEnabled: true,
  serviceCategories: [
    { serviceCategoryId: CATEGORY_FOOD.id, status: "active", isFeatured: true },
  ],
}

export const FOOD_MENU: FoodMenuType = {
  deliveryCharge: 25,
  freeDeliveryThreshold: 400,
  totalOrderValueDiscountRate: null,
  totalOrderValueDiscountThreshold: null,
  status: "approved",
  isDeliveryEnabled: true,
  isPickupEnabled: true,
  menuSections: [
    {
      id: 41,
      title: "Mains",
      order: 1,
      menuItems: [
        {
          id: 411,
          name: "Molokhia with chicken",
          description: "Slow-cooked, with rice and bread.",
          price: 185,
          discountPrice: 0,
          isExpressDeliveryAvailable: true,
          isPreOrderOnly: false,
          leadTimeHours: null,
          photo: "https://example.com/parity/molokhia.jpg",
          inStock: true,
          options: [
            {
              id: 4111,
              name: "Bread",
              isRequired: false,
              minQty: 0,
              maxQty: 1,
              choices: [{ id: 41111, name: "Extra bread", price: 10 }],
            },
          ],
        },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Jobs

/** A pro on a job that has sent an offer. */
export const JOB_PRO_OFFER: JobProType = {
  id: 9001,
  jobId: 8001,
  proId: PRO_INDIVIDUAL.id,
  selectionStatus: "offer",
  ratePerHour: 150,
  proOfferSentAt: HOURS_AGO(2),
  pro: PRO_INDIVIDUAL,
  offers: [{ id: 1, jobProId: 9001, ratePerHour: 150, createdAt: HOURS_AGO(2) }],
  review: null,
}

/** A pro on the same job that hasn't answered yet. */
export const JOB_PRO_WAITING: JobProType = {
  id: 9002,
  jobId: 8001,
  proId: PRO_COMPANY.id,
  selectionStatus: "selected",
  pro: PRO_COMPANY,
  offers: [],
  review: null,
}

/** An open service request with one offer in. */
export const JOB: JobType = {
  id: 8001,
  status: "active",
  requestedOn: HOURS_AGO(5),
  serviceCategoryId: CATEGORY.id,
  customerId: CUSTOMER.id,
  address: {
    address: {
      streetAddress: "12 Tahrir Street",
      city: "Dokki",
      governorate: "Giza",
      location: { lat: 30.0444, lng: 31.2357 },
    },
  },
  serviceCategory: {
    id: CATEGORY.id,
    nameEn: CATEGORY.nameEn,
    nameAr: CATEGORY.nameAr,
    serviceId: SERVICE.id,
    hasMenu: false,
  },
  pros: [JOB_PRO_OFFER, JOB_PRO_WAITING],
  dateType: "asap",
  dates: [],
  timeSlots: [],
  questionsAnswers: [
    { questionId: QUESTION_PLACE.id, optionId: 7011 },
    { questionId: QUESTION_NOTES.id, answer: "Under the kitchen sink." },
  ],
  placeOfService: "customerPlace",
  createdAt: HOURS_AGO(5),
  updatedAt: HOURS_AGO(2),
}

/** A food order a pro is preparing. */
export const JOB_FOOD: JobType = {
  id: 8002,
  status: "active",
  requestedOn: HOURS_AGO(1),
  serviceCategoryId: CATEGORY_FOOD.id,
  customerId: CUSTOMER.id,
  address: JOB.address,
  serviceCategory: {
    id: CATEGORY_FOOD.id,
    nameEn: CATEGORY_FOOD.nameEn,
    nameAr: CATEGORY_FOOD.nameAr,
    serviceId: SERVICE_FOOD.id,
    hasMenu: true,
  },
  pros: [
    {
      id: 9003,
      jobId: 8002,
      proId: PRO_FOOD.id,
      selectionStatus: "offer",
      status: "preparing",
      pro: PRO_FOOD,
      offers: [],
      review: null,
    },
  ],
  placeOfService: "customerPlace",
  paymentMethod: "cash",
  foodOrderItems: [
    {
      id: 1,
      menuItemId: 411,
      name: "Molokhia with chicken",
      price: 185,
      quantity: 2,
    },
  ],
  deliveryFee: 25,
  orderDiscount: 0,
  createdAt: HOURS_AGO(1),
  updatedAt: HOURS_AGO(1),
}

// ---------------------------------------------------------------------------
// Chats

export const CHAT: ChatType = {
  id: 6001,
  status: "active",
  proId: PRO_INDIVIDUAL.id,
  customerId: CUSTOMER.id,
  pro: {
    id: PRO_INDIVIDUAL.id,
    registeredName: PRO_INDIVIDUAL.registeredName,
    proType: "individual",
    profilePhoto: PRO_INDIVIDUAL.profilePhoto,
    profilePhoto150: PRO_INDIVIDUAL.profilePhoto150,
    lastSeen: HOURS_AGO(1),
    accountStatus: "active",
  },
  customer: {
    id: CUSTOMER.id,
    firstName: CUSTOMER.firstName,
    lastName: CUSTOMER.lastName,
  },
  serviceCategoryId: CATEGORY.id,
  serviceCategory: {
    id: CATEGORY.id,
    nameEn: CATEGORY.nameEn,
    nameAr: CATEGORY.nameAr,
  },
  jobId: JOB.id,
  createdAt: HOURS_AGO(4),
}

/** A thread: the pro's text, the customer's reply, a photo, a location. */
export const CHAT_MESSAGES: ChatMessageType[] = [
  {
    id: 7104,
    chatId: CHAT.id,
    ownerType: "customer",
    location: { id: 1, latitude: 30.0444, longitude: 31.2357 },
    createdAt: HOURS_AGO(1),
    readAt: HOURS_AGO(1),
  },
  {
    id: 7103,
    chatId: CHAT.id,
    ownerType: "pro",
    files: [
      {
        id: 1,
        fileName: "sink.jpg",
        extension: "jpg",
        originalName: "sink.jpg",
        mimeType: "image/jpeg",
        storageKey: "parity/sink.jpg",
        url: "https://example.com/parity/sink.jpg",
        url720: "https://example.com/parity/sink-720.jpg",
        url150: "https://example.com/parity/sink-150.jpg",
      },
    ],
    createdAt: HOURS_AGO(2),
    readAt: null,
  },
  {
    id: 7102,
    chatId: CHAT.id,
    ownerType: "customer",
    text: "Thursday at 10 works. The tap is under the kitchen sink.",
    createdAt: HOURS_AGO(3),
    readAt: HOURS_AGO(3),
  },
  {
    id: 7101,
    chatId: CHAT.id,
    ownerType: "pro",
    text: "Hello! I can come on Thursday at 10 with the parts.",
    createdAt: HOURS_AGO(4),
    readAt: HOURS_AGO(3),
  },
]

export const CHAT_PREVIEW: ChatPreviewType = {
  chat: CHAT,
  notReadMessages: 1,
  hasHumanMessages: true,
  hasCustomerMessages: true,
  lastMessage: CHAT_MESSAGES[0],
}

// ---------------------------------------------------------------------------
// Notifications

export const NOTIFICATION_UNREAD: NotificationsItemType = {
  id: 5001,
  event: "system.job:customer.job.offer.received",
  userType: "customer",
  userId: CUSTOMER.id,
  title: "New offer",
  body: "Omar Hassan sent you an offer for Plumbing.",
  readAt: null,
  createdAt: HOURS_AGO(2),
  data: { jobId: JOB.id },
}

export const NOTIFICATION_READ: NotificationsItemType = {
  id: 5002,
  event: "system.account:customer.welcome",
  userType: "customer",
  userId: CUSTOMER.id,
  title: "Welcome to Tappler",
  body: "Find a pro for anything around the house.",
  readAt: DAYS_AGO(2),
  createdAt: DAYS_AGO(3),
}

// ---------------------------------------------------------------------------
// Maps and the cart

export const POINT_AREAS: PointAreasResponse = {
  country: { id: 1, type: "country", nameEn: "Egypt", nameAr: "مصر" },
  governorate: { id: 2, type: "governorate", nameEn: "Giza", nameAr: "الجيزة" },
  area: { id: 125, type: "area", nameEn: "Dokki", nameAr: "الدقي" },
}

export const AREA_GEOMETRY: AreaGeometryResponse = {
  id: "125",
  type: "area",
  nameEn: "Dokki",
  nameAr: "الدقي",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [31.2, 30.03],
        [31.22, 30.03],
        [31.22, 30.05],
        [31.2, 30.05],
        [31.2, 30.03],
      ],
    ],
  },
}

/** A cart draft at PRO_FOOD, touched ten minutes before the kit's clock (fresh: drafts expire after an hour). */
export const CART_DRAFT: CartDraft = {
  proId: PRO_FOOD.id,
  serviceCategoryId: CATEGORY_FOOD.id,
  serviceId: SERVICE_FOOD.id,
  proName: PRO_FOOD.registeredName,
  categoryName: CATEGORY_FOOD.nameEn,
  items: [
    {
      uid: "411:bread",
      menuItemId: 411,
      name: "Molokhia with chicken",
      price: 185,
      quantity: 1,
      selectedOptions: [
        { optionName: "Bread", choices: [{ name: "Extra bread", price: 10 }] },
      ],
      photo: "https://example.com/parity/molokhia.jpg",
    },
  ],
  orderNotes: "",
  fulfillmentMode: "delivery",
  lastUpdatedAt: KIT_NOW - 10 * 60 * 1000,
}

/** Offer history for the chat's strip (GET .../offer-history). */
export const OFFER_HISTORY = {
  data: [{ id: 1, ratePerHour: 150, createdAt: HOURS_AGO(2) }],
}
