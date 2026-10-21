/**
 * Jest only. The records the screens show (a service, a job, a chat, a
 * notification...), made up and typed by the app's own types, so a field a
 * screen reads can't go missing without tsc saying so. Dates sit around the
 * kit's frozen clock (engine.DEFAULT_NOW, 2026-10-20 10:00 in Cairo). No real
 * account's data.
 *
 * Where the backend sends `null` for a field the app's type doesn't allow
 * (an active service's `suspension`), `wireNull` says so at the spot.
 */
import type {
  BadgeCountsResponse,
  GeneralSettingResponse,
  GetJobsResponse,
  GetNotitficationsResponse,
  GetPointsHistoryResponse,
  ProsServicesCategoriesResponse,
} from "services"
import type {
  AddressType,
  ChatMessageType,
  ChatPreviewType,
  ChatType,
  CustomerType,
  IdDocumentData,
  JobProsType,
  JobType,
  MenuItemType,
  MenuSectionType,
  MenuType,
  NewAddressDataType,
  NotificationsItemType,
  PaymentTransactionType,
  PlaceOfServiceType,
  PointsItemPackagesType,
  PointsTransactionsHistoryType,
  ProfileSettingParamTypes,
  RejectedItemType,
  SubCategoryType,
} from "types"
import type { MockSearchItemType } from "data/mockData"

import { PRO_INDIVIDUAL } from "./users"

/** What the wire sends where the app's type has no null (read as "absent"). */
export const wireNull = <T>() => null as unknown as T

export const DAYS_AGO = (days: number, hour = 9) =>
  new Date(Date.UTC(2026, 9, 20 - days, hour - 2, 30)).toISOString()

// ---------------------------------------------------------------------------
// Services

const subCategory = (
  id: number,
  nameEn: string,
  nameAr: string,
  extra: Partial<SubCategoryType> = {}
): SubCategoryType => ({
  id,
  name: nameEn,
  nameEn,
  nameAr,
  descriptionForProsEn: `${nameEn} jobs near you.`,
  descriptionForProsAr: `وظائف ${nameAr} بالقرب منك.`,
  descriptionForCustomersEn: `Book a ${nameEn.toLowerCase()} pro.`,
  descriptionForCustomersAr: `احجز محترف ${nameAr}.`,
  descriptionForPros: `${nameEn} jobs near you.`,
  descriptionForCustomers: `Book a ${nameEn.toLowerCase()} pro.`,
  keywords: nameEn.toLowerCase(),
  picture: `https://example.com/parity/${id}.jpg`,
  interviewRequired: false,
  allowedEmployeeType: "both",
  opportunityPointsCost: 5,
  hasMenu: false,
  hasQualifications: false,
  criminalRecordsRequired: false,
  healthRecordsRequired: false,
  locationPhotoRequired: false,
  additionalDocuments: [],
  serviceId: 10,
  relatedServiceCategoriesIds: [],
  placeOfService: ["proToCustomer"],
  proQuestions: [],
  customerQuestions: [],
  ...extra,
})

export const SUB_CATEGORY: SubCategoryType = subCategory(
  201,
  "Plumbing",
  "سباكة"
)

export const SUB_CATEGORY_FOOD: SubCategoryType = subCategory(
  301,
  "Home Cooking",
  "طبخ منزلي",
  { hasMenu: true, placeOfService: ["delivery"], serviceId: 30 }
)

export const PLACE_OF_SERVICE: PlaceOfServiceType = {
  place: "proToCustomer",
  serviceLocationAreas: [
    { city: "Dokki", governorate: "Giza", governorateId: 2, cityId: 125 },
    { city: "Mohandessin", governorate: "Giza", governorateId: 2, cityId: 126 },
  ],
  serviceLocationType: "home",
  locationAddress: {
    serviceLocationId: 1,
    serviceLocation: { id: 1, nameEn: "Home", nameAr: "المنزل" },
    changedAt: null,
    address: {
      streetAddress: "12 Tahrir Street",
      city: "Dokki",
      governorate: "Giza",
      location: { lat: 30.0444, lng: 31.2357 },
    },
  },
  deliveryRadius: 5,
  pickupLocationType: "home",
  pickupAddress: {
    streetAddress: "12 Tahrir Street",
    city: "Dokki",
    governorate: "Giza",
  },
  isRemote: false,
}

export const MENU_ITEM: MenuItemType = {
  id: 501,
  name: "Stuffed vine leaves",
  description: "Rice, herbs and lemon, rolled by hand. A tray of 30.",
  price: 180,
  discountPrice: 150,
  isExpressDeliveryAvailable: true,
  isPreOrderOnly: false,
  leadTimeHours: null,
  options: [
    {
      id: 1,
      name: "Size",
      isRequired: true,
      minQty: 1,
      maxQty: 1,
      choices: [
        { name: "30 pieces", price: 0 },
        { name: "60 pieces", price: 150 },
      ] as never,
    },
  ],
  photo: "https://example.com/parity/menu-501.jpg",
  inStock: true,
}

export const MENU_SECTION: MenuSectionType = {
  id: 401,
  title: "Main dishes",
  order: 1,
  menuItems: [
    MENU_ITEM,
    {
      ...MENU_ITEM,
      id: 502,
      name: "Molokhia with rice",
      price: 120,
      discountPrice: 0,
      options: [],
    },
  ],
}

export const REJECTED_ITEM: RejectedItemType = {
  itemId: 502,
  itemName: "Molokhia with rice",
  sectionTitle: "Main dishes",
  reason: "The photo doesn't show the dish.",
  reasons: ["The photo doesn't show the dish."],
}

export const MENU: MenuType = {
  foodCategories: [],
  deliveryCharge: 25,
  freeDeliveryThreshold: 500,
  totalOrderValueDiscountRate: 10,
  totalOrderValueDiscountThreshold: 300,
  menuSections: [MENU_SECTION],
  status: "approved",
  hasDraftChanges: false,
  hasApprovedVersion: true,
  matchesApprovedVersion: true,
  rejectedItems: [],
}

/** An active plumbing service, offered at the customer's place. */
export const SERVICE: ProsServicesCategoriesResponse = {
  serviceCategory: SUB_CATEGORY,
  status: "active",
  placeOfService: [PLACE_OF_SERVICE],
  questionsAnswers: [],
  menu: null,
  isFeatured: false,
  suspension: wireNull(),
  proAdditionalDocuments: [],
  qualificationDocuments: [],
  subscriptions: [],
  questionsOutdatedAt: null,
  lastLocationAddress: null,
}

/** An active home-cooking service with an approved menu, delivering. */
export const SERVICE_FOOD: ProsServicesCategoriesResponse = {
  ...SERVICE,
  serviceCategory: SUB_CATEGORY_FOOD,
  placeOfService: [{ ...PLACE_OF_SERVICE, place: "delivery" }],
  menu: MENU,
}

/** A service waiting for its interview. */
export const SERVICE_PENDING_INTERVIEW: ProsServicesCategoriesResponse = {
  ...SERVICE,
  serviceCategory: {
    ...subCategory(202, "Electrician", "كهربائي"),
    interviewRequired: true,
  },
  status: "pendingInterview",
}

// ---------------------------------------------------------------------------
// Jobs

export const ADDRESS: AddressType = {
  streetAddress: "5 Nile Street",
  city: "Dokki",
  governorate: "Giza",
  latitude: 30.0381,
  longitude: 31.2112,
  location: { lat: 30.0381, lng: 31.2112 },
  changedAt: null,
}

export const CUSTOMER: CustomerType = {
  id: 7001,
  firstName: "Mona",
  lastName: "Adel",
  gender: "female",
  mobileNumber: "+201111111111",
  email: "customer.parity@example.com",
  status: "verified",
  signupPlatform: "email",
  accountCreationDate: "2025-06-01T09:00:00.000Z",
  lastSeen: DAYS_AGO(0, 9),
  addresses: [ADDRESS],
  emailVerified: true,
}

const proOnJob = (
  jobId: number,
  selectionStatus: JobProsType["selectionStatus"]
): JobProsType => ({
  jobId,
  proId: PRO_INDIVIDUAL.id,
  selectionStatus,
  responseTime: 0,
  opportunityNotes: "",
  ratePerHour: 0,
  proOfferSentAt: wireNull(),
  proOpportunityOfferSentAt: wireNull(),
  rejectedByProAt: wireNull(),
  opportunityRejectedAt: wireNull(),
  opportunityAcceptedAt: wireNull(),
  status: null,
})

/** An open opportunity: a customer's request this pro hasn't answered. */
export const JOB: JobType = {
  id: 9001,
  requestedOn: DAYS_AGO(2),
  status: "active",
  cityId: 125,
  customerId: CUSTOMER.id,
  serviceCategoryId: SUB_CATEGORY.id,
  address: { id: 1, ...ADDRESS, address: ADDRESS },
  customer: CUSTOMER,
  serviceCategory: { ...SUB_CATEGORY, rejectReason: "", isRevised: false },
  serviceArea: { id: "125", type: "subArea", name: "Dokki", nameAr: "الدقي" },
  placeOfService: "proToCustomer",
  dateType: "specific",
  pros: [proOnJob(9001, "opportunity")],
  dates: [{ id: 1, date: "2026-10-22" }],
  timeSlots: [{ id: 1, start: "10:00", end: "12:00" }],
  orderNotes: null,
  paymentMethod: "cash",
  isFavorite: false,
}

/** A lead: the customer picked this pro directly. */
export const JOB_LEAD: JobType = {
  ...JOB,
  id: 9002,
  requestedOn: DAYS_AGO(1),
  pros: [proOnJob(9002, "selected")],
}

/** A food order to this pro's kitchen, for delivery. */
export const FOOD_ORDER: JobType = {
  ...JOB,
  id: 9003,
  requestedOn: DAYS_AGO(0, 9),
  serviceCategoryId: SUB_CATEGORY_FOOD.id,
  serviceCategory: { ...SUB_CATEGORY_FOOD, rejectReason: "", isRevised: false },
  placeOfService: "delivery",
  dateType: "asap",
  dates: [],
  timeSlots: [],
  pros: [proOnJob(9003, "selected")],
  foodOrderItems: [
    {
      id: 1,
      menuItemId: 501,
      name: "Stuffed vine leaves",
      price: 150,
      quantity: 2,
    },
    {
      id: 2,
      menuItemId: 502,
      name: "Molokhia with rice",
      price: 120,
      quantity: 1,
    },
  ],
  deliveryFee: 25,
  orderDiscount: 0,
  orderNotes: "Ring the bell twice, please.",
}

/** The lead after this pro sent a price: the chat that follows it, Update your offer. */
export const JOB_LEAD_OFFERED: JobType = {
  ...JOB_LEAD,
  pros: [
    {
      ...proOnJob(JOB_LEAD.id, "offer"),
      ratePerHour: 300,
      proOfferSentAt: DAYS_AGO(1, 12),
    },
  ],
}

export const jobsPage = (data: JobType[]): GetJobsResponse => ({
  page: 1,
  perPage: 20,
  total: data.length,
  data,
})

// ---------------------------------------------------------------------------
// Chats

export const CHAT: ChatType = {
  id: 6001,
  status: "active",
  proId: PRO_INDIVIDUAL.id,
  customerId: CUSTOMER.id,
  customer: CUSTOMER,
  serviceCategoryId: SUB_CATEGORY.id,
  serviceCategory: {
    id: 10,
    nameAr: "إصلاحات المنزل",
    nameEn: "Home repairs",
    categories: [SUB_CATEGORY],
  },
  jobId: JOB_LEAD_OFFERED.id,
  job: JOB_LEAD_OFFERED,
  canProRevealContactInfo: false,
}

export const CHAT_MESSAGES: ChatMessageType[] = [
  {
    id: 1,
    text: "Hello, can you come on Thursday morning?",
    ownerType: "customer",
    createdAt: DAYS_AGO(1, 10),
    readAt: DAYS_AGO(1, 11),
    customerId: CUSTOMER.id,
  },
  {
    id: 2,
    text: "Yes, 10 am works. I'll bring the parts.",
    ownerType: "pro",
    createdAt: DAYS_AGO(1, 11),
    readAt: null,
    proId: PRO_INDIVIDUAL.id,
  },
]

export const CHAT_PREVIEW: ChatPreviewType = {
  chat: CHAT,
  notReadMessages: 1,
  lastMessage: CHAT_MESSAGES[1],
  hasCustomerMessages: true,
}

// ---------------------------------------------------------------------------
// Notifications, points, settings

export const NOTIFICATION: NotificationsItemType = {
  id: 4001,
  event: "system.job:pro.job.opportunity.available",
  userType: "pro",
  userId: PRO_INDIVIDUAL.id,
  title: "New opportunity",
  body: "A customer in Dokki needs a plumber.",
  readAt: wireNull(),
  createdAt: DAYS_AGO(0, 8),
  data: { jobId: JOB.id, job: JOB },
}

export const notificationsPage = (
  data: NotificationsItemType[]
): GetNotitficationsResponse => ({
  page: 1,
  perPage: 20,
  total: data.length,
  data,
})

export const POINTS_PACKAGE: PointsItemPackagesType = {
  id: 27,
  status: "active",
  pointsAmount: 100,
  price: 500,
  originalPrice: 600,
  saving: 100,
  descriptionEn: "100 points",
  descriptionAr: "100 نقطة",
  startDate: "2026-01-01T00:00:00.000Z",
  expirationDate: "2027-01-01T00:00:00.000Z",
}

export const POINTS_TRANSACTION: PointsTransactionsHistoryType = {
  id: 3001,
  type: "purchase",
  pointsAdded: 100,
  amountBefore: 20,
  amountAfter: 120,
  date: DAYS_AGO(3),
  proId: PRO_INDIVIDUAL.id,
  pointsPackageId: POINTS_PACKAGE.id,
  pointsPackage: POINTS_PACKAGE,
}

export const POINTS_HISTORY: GetPointsHistoryResponse = {
  page: 1,
  perPage: 20,
  total: 2,
  data: [
    POINTS_TRANSACTION,
    {
      ...POINTS_TRANSACTION,
      id: 3002,
      type: "spend",
      pointsAdded: 0,
      pointsCharged: 5,
      amountBefore: 125,
      amountAfter: 120,
      date: DAYS_AGO(1),
      pointsPackageId: null,
      jobId: JOB.id,
    },
  ],
}

export const PAYMENT_TRANSACTION: PaymentTransactionType = {
  id: 1401,
  createdAt: DAYS_AGO(3),
  systemTransactionNumber: "TX-1401",
  status: "success",
  paymentMethod: "card",
  cents: 50000,
  currency: "EGP",
  orderId: 1501,
}

export const BADGE_COUNTS: BadgeCountsResponse = {
  newLeads: 2,
  unseenOpportunities: 3,
}

export const GENERAL_SETTINGS: GeneralSettingResponse = {
  firstDayOfWeek: "saturday",
  mobileNumberOne: "+20221234567",
  mobileNumberTwo: "+201000000001",
  contactRevealPointsCost: 1,
}

// ---------------------------------------------------------------------------
// What screens pass each other

/** My Profile's edit screens are opened with the profile as it stands. */
export const PROFILE_PARAMS: ProfileSettingParamTypes = {
  proType: PRO_INDIVIDUAL.proType,
  businessName: PRO_INDIVIDUAL.businessName,
  informationAbout: PRO_INDIVIDUAL.informationAbout,
  profilePhoto: PRO_INDIVIDUAL.profilePhoto,
  payment: PRO_INDIVIDUAL.paymentMethods,
  originalPayment: PRO_INDIVIDUAL.paymentMethods,
  media: PRO_INDIVIDUAL.media,
  socials: PRO_INDIVIDUAL.socials,
  photosOfWorks: [],
  hours: PRO_INDIVIDUAL.hours,
  credential: [],
}

export const NEW_ADDRESS: NewAddressDataType = {
  address: "12 Tahrir Street",
  city: "Dokki",
  governorate: "Giza",
  coords: { lat: 30.0444, lon: 31.2357 },
}

export const SEARCH_ITEM: MockSearchItemType = {
  id: "125",
  name: "Dokki",
  area: "Dokki",
  governorate: "Giza",
  coords: { lat: 30.0381, lon: 31.2112 },
}

export const ID_DOCUMENT: IdDocumentData = {
  name: "Omar Hassan",
  idNumber: "29005120100000",
  dateOfBirth: "1990-05-12",
  expirationDate: "2030-05-12",
}
