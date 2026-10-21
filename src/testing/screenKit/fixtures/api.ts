/**
 * Jest only. The backend's answers for the endpoints the screens ask for on
 * opening (backend.ts answers RTK Query by endpoint name), in the states a
 * screen is captured in: DATA (every list has a few rows), EMPTY (every list
 * empty, every count zero), ERROR (every one of them a server error).
 * Endpoints not listed stay loading in every state; a render's request log
 * says which ones a screen asked for.
 *
 * Each answer is the wire's shape, typed by the app's response type: the
 * app's transformResponse still runs on it. A big record is given as
 * `some<T>()`: only the fields the screens read, each one typed.
 */
import type {
  GetJobsResponse,
  GetNotitficationsResponse,
  GetNotitficationsSettingsResponse,
  GetPointsHistoryResponse,
  GetPointsPackagesResponse,
  GetProsMyActivation,
  GetQuotesResponse,
  GetSimilarServicesResponse,
  GetSubscriptionsResponse,
  GovernorateResponse,
  InterviewResponse,
  LegalDocumentsResponse,
  MotivationalStickersResponse,
  MyDocumentsResponse,
  MyReviewResponse,
  ProsServicesCategoriesResponse,
  QuoteDetailsType,
  ResponseTimeResponse,
  ServicesResponce,
  ServiceWorkPhotosResponse,
  TrustStickersResponse,
  VouchersResponse,
} from "services"
import type { ChatMessagesPage } from "services/chatThread"
import type {
  ChatPreviewType,
  OpenUpgradeRequestType,
  PaymentCardType,
  PaymentTransactionType,
  ProfileEditsResponse,
} from "types"

import type { BackendFixtures, EndpointAnswer } from "../backend"
import {
  BADGE_COUNTS,
  CHAT_MESSAGES,
  CHAT_PREVIEW,
  CUSTOMER,
  DAYS_AGO,
  FOOD_ORDER,
  GENERAL_SETTINGS,
  JOB,
  JOB_LEAD,
  NOTIFICATION,
  PAYMENT_TRANSACTION,
  POINTS_HISTORY,
  POINTS_PACKAGE,
  POINTS_TRANSACTION,
  SERVICE,
  SERVICE_FOOD,
  SERVICE_PENDING_INTERVIEW,
  SUB_CATEGORY,
  SUB_CATEGORY_FOOD,
  jobsPage,
  notificationsPage,
} from "./entities"
import { PRO_INDIVIDUAL } from "./users"

type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

/** A record with only the fields the screens read; what is given is typed. */
export const some = <T>(value: DeepPartial<T>) => value as T

const data = <T>(value: T): EndpointAnswer => ({ data: value })

/** The path an endpoint asked for, with its params (`/jobs/pro-jobs/ended?page=1`). */
const urlOf = (args: unknown) => {
  if (typeof args === "string") return args
  const { url, params } = (args ?? {}) as {
    url?: string
    params?: Record<string, unknown>
  }
  const query = params
    ? new URLSearchParams(
        Object.entries(params).map(([key, value]) => [key, String(value)])
      ).toString()
    : ""
  return `${url ?? ""}${query ? `${url?.includes("?") ? "&" : "?"}${query}` : ""}`
}

/** Page 1 has the rows; any later page is empty, as the end of a list is. */
const firstPageOnly =
  <T>(rows: T[], wrap: (rows: T[]) => unknown) =>
  (args: unknown): EndpointAnswer =>
    data(wrap(/[?&]page=([2-9]|\d{2,})/.test(urlOf(args)) ? [] : rows))

const page = <T>(rows: T[]) => ({
  page: 1,
  perPage: 20,
  total: rows.length,
  data: rows,
})

// ---------------------------------------------------------------------------
// Records only the endpoints use

const SERVICES: ProsServicesCategoriesResponse[] = [
  SERVICE,
  SERVICE_FOOD,
  SERVICE_PENDING_INTERVIEW,
]

const serviceById = (args: unknown) => {
  const id = Number(urlOf(args).split("/").pop())
  return SERVICES.find((s) => s.serviceCategory.id === id) ?? SERVICE
}

const DOCUMENTS: MyDocumentsResponse = [
  some<MyDocumentsResponse[number]>({
    id: 1101,
    createdAt: DAYS_AGO(200),
    files: [
      {
        assignment: "id.front",
        url: "https://example.com/parity/id-front.jpg",
      },
      { assignment: "id.back", url: "https://example.com/parity/id-back.jpg" },
      { assignment: "id.selfie", url: "https://example.com/parity/selfie.jpg" },
    ],
    idDocumentData: {
      name: "Omar Hassan",
      idNumber: "29005120100000",
      dateOfBirth: "1990-05-12",
      expirationDate: "2030-05-12",
    },
    proId: PRO_INDIVIDUAL.id,
    processedAt: null,
    processedById: null,
    rejectReason: null,
    status: "approved",
    isExpired: false,
    isCurrent: true,
    expiresOn: "2030-05-12",
    daysUntilExpiry: 1300,
    isExpiringSoon: false,
    licenseNumber: "",
    registrationDate: "",
  }),
]

const ACTIVATION = some<GetProsMyActivation>({
  id: 1201,
  proName: PRO_INDIVIDUAL.registeredName,
  businessName: "",
  proId: PRO_INDIVIDUAL.id,
  proType: "individual",
  mobileNumber: PRO_INDIVIDUAL.mobileNumber,
  email: PRO_INDIVIDUAL.email,
  accountCreatedAt: DAYS_AGO(230),
  status: "approved",
  createdAt: DAYS_AGO(230),
  profilePhoto: { id: 1, status: "approved", fileId: 1, file: null },
  photosOfWork: { id: 2, status: "approved", photosOfWork: [] },
  informationAbout: {
    id: 3,
    status: "approved",
    informationAbout: PRO_INDIVIDUAL.informationAbout,
  },
})

const PAYMENT_CARDS: { data: PaymentCardType[] } = {
  data: [
    {
      id: 1301,
      maskedPan: "xxxx-xxxx-xxxx-4242",
      cardBrand: "Visa",
      expiryMonth: "09",
      expiryYear: "28",
    },
  ],
}

const PAYMENT_TRANSACTIONS: { data: PaymentTransactionType[] } = {
  data: [PAYMENT_TRANSACTION],
}

const GOVERNORATES = {
  data: [
    some<GovernorateResponse>({
      id: 2,
      dataSource: "parity",
      nameEn: "Giza",
      nameAr: "الجيزة",
      type: "governorate",
      isActive: true,
      parentId: null,
      updatedAt: DAYS_AGO(300),
      createdAt: DAYS_AGO(300),
      bigAreas: [],
    }),
  ],
}

const QUOTES: GetQuotesResponse = page([
  {
    quoteId: 149,
    quoteNumber: 1049,
    date: DAYS_AGO(4),
    expirationDate: DAYS_AGO(-10),
    price: "1500.00",
    status: "active",
    deletedAt: null,
    paidAt: null,
    serviceCategoryNameEn: SUB_CATEGORY.nameEn,
    serviceCategoryNameAr: SUB_CATEGORY.nameAr,
  },
])

const QUOTE = some<QuoteDetailsType>({
  id: 149,
  quoteNumber: 1049,
  date: DAYS_AGO(4),
  expirationDate: DAYS_AGO(-10),
  status: "active",
  serviceCategory: {
    id: SUB_CATEGORY.id,
    nameEn: SUB_CATEGORY.nameEn,
    nameAr: SUB_CATEGORY.nameAr,
  },
  products: [
    {
      productId: 1802,
      product: {
        id: 1802,
        type: "motivational",
        status: "active",
        descriptionEn: "Featured Pro",
        descriptionAr: "محترف مميز",
        pricePerDay: 5,
        maxDiscount: 0,
        startDate: DAYS_AGO(20),
        expirationDate: DAYS_AGO(-70),
        pictureEn: "https://example.com/parity/featured-en.png",
        pictureAr: "https://example.com/parity/featured-ar.png",
        proType: "all",
        subType: "featuredPro",
      },
      price: 1500,
      durationDays: 90,
      discount: 0,
      totalPrice: 1500,
      promoStickerMessage: null,
    },
  ],
  salesEmployee: { firstName: "Sara", lastName: "Nabil" },
  taxRate: 14,
  paidAt: null,
  message: "Featured Pro for three months.",
})

const REVIEWS: MyReviewResponse = page([
  some<MyReviewResponse["data"][number]>({
    id: 1601,
    jobId: JOB.id,
    proId: PRO_INDIVIDUAL.id,
    customerId: CUSTOMER.id,
    comment: "Came on time and fixed the leak in half an hour.",
    proCompletedJob: true,
    reviewDate: DAYS_AGO(6),
    status: "approved",
    customer: CUSTOMER,
    rejectReason: "",
    isRevised: false,
    qualityScore: 5,
    completionInTimeScore: 5,
    jobAwarenessScore: 4,
    honestyScore: 5,
    responseTimeScore: 4,
    overallScore: 4.6,
    reviewsCount: 1,
  }),
])

const WORK_PHOTOS: ServiceWorkPhotosResponse = {
  documentId: 1701,
  status: "approved",
  photos: [
    {
      id: 901,
      status: "approved",
      url: "https://example.com/parity/work-901.jpg",
      url720: "https://example.com/parity/work-901-720.jpg",
      url150: "https://example.com/parity/work-901-150.jpg",
      urlThumb: "https://example.com/parity/work-901-thumb.jpg",
      thumbnailCrop: null,
      mimeType: "image/jpeg",
      posterUrl: null,
    },
    {
      id: 902,
      status: "pending",
      url: "https://example.com/parity/work-902.jpg",
      url720: "https://example.com/parity/work-902-720.jpg",
      url150: "https://example.com/parity/work-902-150.jpg",
      urlThumb: "",
      thumbnailCrop: null,
      mimeType: "image/jpeg",
      posterUrl: null,
    },
  ],
}

const STICKER = {
  id: 1801,
  status: "active" as const,
  descriptionEn: "Health certificate",
  pricePerDay: 2,
  pricePerYear: 500,
  maxDiscount: 10,
  startDate: DAYS_AGO(100),
  expirationDate: DAYS_AGO(-265),
  picture: "https://example.com/parity/sticker.png",
}

const TRUST_STICKERS: TrustStickersResponse = page([
  { ...STICKER, type: "trust" },
])

const MOTIVATIONAL_STICKERS = some<MotivationalStickersResponse>(
  page([
    {
      ...STICKER,
      id: 1802,
      type: "motivational",
      descriptionAr: "ملصق",
      pictureEn: "https://example.com/parity/motivational-en.png",
      pictureAr: "https://example.com/parity/motivational-ar.png",
      proType: "all",
      subType: "motivational",
    },
  ])
)

const POINTS_PACKAGES: GetPointsPackagesResponse = page([
  POINTS_PACKAGE,
  { ...POINTS_PACKAGE, id: 28, pointsAmount: 250, price: 1100, saving: 400 },
])

const SUBSCRIPTIONS = some<GetSubscriptionsResponse>({
  data: [
    {
      id: 1901,
      status: "active",
      proServiceCategoryId: SUB_CATEGORY.id,
      paymentOrderId: 1501,
      salesOrderId: 2001,
      productId: 1802,
      product: {
        id: 1802,
        type: "motivational",
        status: "active",
        descriptionEn: "Featured Pro",
        descriptionAr: "محترف مميز",
        pricePerDay: 5,
        maxDiscount: 0,
        startDate: DAYS_AGO(20),
        expirationDate: DAYS_AGO(-70),
        pictureEn: "https://example.com/parity/featured-en.png",
        pictureAr: "https://example.com/parity/featured-ar.png",
        proType: "all",
        subType: "featuredPro",
      },
      startDate: DAYS_AGO(20),
      expirationDate: DAYS_AGO(-70),
      promoStickerMessage: null,
      promoLineHistory: [],
    },
  ],
})

const INTERVIEWS = some<InterviewResponse>([
  {
    id: 2101,
    status: "pending",
    proId: PRO_INDIVIDUAL.id,
    serviceCategoryId: SERVICE_PENDING_INTERVIEW.serviceCategory.id,
    requestedAt: DAYS_AGO(2),
  },
])

const NOTIFICATION_SETTINGS: GetNotitficationsSettingsResponse = {
  data: (
    [
      "accountActivation",
      "accountUpgrade",
      "services",
      "serviceRequests",
      "jobOpportunities",
      "messages",
      "reviews",
    ] as const
  ).map((type, index) => ({
    id: 2200 + index,
    type,
    enabled: true,
    frequency: type === "jobOpportunities" ? ("instant" as never) : null,
  })),
}

const CURRENT_LEAD: OpenUpgradeRequestType = {
  id: 2301,
  salesStatus: "new",
  createdAt: DAYS_AGO(1),
  products: ["featuredPro"],
}

const SERVICE_CATALOGUE = some<ServicesResponce>({
  data: [
    {
      id: 10,
      nameEn: "Home repairs",
      nameAr: "إصلاحات المنزل",
      categories: [SUB_CATEGORY],
    },
    {
      id: 30,
      nameEn: "Food",
      nameAr: "طعام",
      categories: [SUB_CATEGORY_FOOD],
    },
  ],
  page: 1,
  perPage: 100,
  total: 2,
})

const LEGAL: LegalDocumentsResponse = {
  termsAndConditionsEn: "These terms govern your use of Tappler Pro.",
  termsAndConditionsAr: "تحكم هذه الشروط استخدامك لتطبيق تابلر برو.",
  privacyPolicyEn: "We keep your data to run the service.",
  privacyPolicyAr: "نحتفظ ببياناتك لتشغيل الخدمة.",
}

const RESPONSE_TIME: ResponseTimeResponse = {
  proId: PRO_INDIVIDUAL.id,
  weekResponseTime: 2,
  monthResponseTime: 3,
  lifeTimeResponseTime: 4,
}

const PROFILE_EDITS: ProfileEditsResponse = { data: [] }

const VOUCHERS: VouchersResponse = {
  data: [
    {
      id: 2401,
      assignDate: DAYS_AGO(5),
      claimDate: null,
      notes: "Welcome points",
      proId: PRO_INDIVIDUAL.id,
      status: "active",
    },
  ],
}

const SIMILAR: GetSimilarServicesResponse = { data: [SUB_CATEGORY_FOOD] }

const OFFER_HISTORY: {
  data: { id: number; ratePerHour: number; createdAt: string }[]
} = {
  data: [
    { id: 2501, ratePerHour: 250, createdAt: DAYS_AGO(2) },
    { id: 2502, ratePerHour: 300, createdAt: DAYS_AGO(1, 12) },
  ],
}

const CHAT_PAGE: ChatMessagesPage = {
  data: [...CHAT_MESSAGES].reverse(),
  page: 1,
  perPage: 30,
  total: CHAT_MESSAGES.length,
}

const CHATS: { data: ChatPreviewType[] } = { data: [CHAT_PREVIEW] }

const LEADS: GetJobsResponse = jobsPage([JOB_LEAD, FOOD_ORDER])
const OPPORTUNITIES: GetJobsResponse = jobsPage([JOB])
const NOTIFICATIONS: GetNotitficationsResponse = notificationsPage([
  NOTIFICATION,
])
const HISTORY: GetPointsHistoryResponse = POINTS_HISTORY

// ---------------------------------------------------------------------------
// The states

/** Every main endpoint answers with rows. */
export const DATA: BackendFixtures = {
  getPros: data(PRO_INDIVIDUAL),
  responseTime: data(RESPONSE_TIME),
  prosServiceCategories: data(SERVICES),
  getProsServiceById: (args) => data(serviceById(args)),
  getServiceById: (args) => data(serviceById(args)),
  getMyDocument: data(DOCUMENTS),
  getProsMyActivation: data(ACTIVATION),
  getProsProfileEdits: data(PROFILE_EDITS),
  getGeneralSettings: data(GENERAL_SETTINGS),
  getLegalDocuments: data(LEGAL),
  getBadgeCounts: data(BADGE_COUNTS),
  getChats: data(CHATS),
  getChatMessages: (args) =>
    data(
      /[?&]page=1(&|$)/.test(urlOf(args))
        ? CHAT_PAGE
        : { ...CHAT_PAGE, data: [], page: 2 }
    ),
  getJobs: firstPageOnly(OPPORTUNITIES.data, jobsPage),
  getLeads: firstPageOnly(LEADS.data, jobsPage),
  // One request for the active leads and one for the ended ones (its queryFn).
  getAllLeads: (args) =>
    urlOf(args).includes("/ended")
      ? data(jobsPage([]))
      : firstPageOnly(LEADS.data, jobsPage)(args),
  getArchivedLeads: data(jobsPage([])),
  getFavoriteJobs: data(OPPORTUNITIES),
  getProJobById: data(JOB_LEAD),
  getProJobDetails: data(JOB_LEAD),
  getProOpportunityDetails: data(JOB),
  getOfferHistory: data(OFFER_HISTORY),
  getNotitfications: firstPageOnly(NOTIFICATIONS.data, notificationsPage),
  getNotitficationsById: data(NOTIFICATION),
  getNotitficationsSettings: data(NOTIFICATION_SETTINGS),
  getProPaymentCards: data(PAYMENT_CARDS),
  getMyPaymentTransactions: data(PAYMENT_TRANSACTIONS),
  getPointsHistory: data(HISTORY),
  getPointsPurchaseHistory: data(HISTORY),
  getPointsSpendHistory: data(HISTORY),
  getPointsPurchaseDetail: data(POINTS_TRANSACTION),
  getPointsSpendDetail: data(HISTORY.data[1]),
  getPointsPackages: data(POINTS_PACKAGES),
  getProVouchersAssignment: data(VOUCHERS),
  getQuotes: data(QUOTES),
  getPaidQuotes: data(page([])),
  getQuoteById: data(QUOTE),
  getSubscriptions: data(SUBSCRIPTIONS),
  getCurrentProLead: data(CURRENT_LEAD),
  getTrustStickers: data(TRUST_STICKERS),
  getProductsTrust: data(TRUST_STICKERS),
  getMotivationalStickers: data(MOTIVATIONAL_STICKERS),
  getProsReviewMe: data(REVIEWS),
  getServiceWorkPhotos: data(WORK_PHOTOS),
  getServiceStatus: data(INTERVIEWS),
  getServices: data(SERVICE_CATALOGUE),
  getSimilarServices: data(SIMILAR),
  getGovernorates: data(GOVERNORATES),
  getTax: data({ id: 1, name: "VAT", rate: 14 }),
}

/** Every list empty, every count zero. */
export const EMPTY: BackendFixtures = {
  ...DATA,
  prosServiceCategories: data([]),
  getMyDocument: data([]),
  getBadgeCounts: data({ newLeads: 0, unseenOpportunities: 0 }),
  getChats: data({ data: [] }),
  getChatMessages: data({ data: [], page: 1, perPage: 30, total: 0 }),
  getJobs: data(jobsPage([])),
  getLeads: data(jobsPage([])),
  getAllLeads: data(jobsPage([])),
  getFavoriteJobs: data(jobsPage([])),
  getOfferHistory: data({ data: [] }),
  getNotitfications: data(notificationsPage([])),
  getProPaymentCards: data({ data: [] }),
  getMyPaymentTransactions: data({ data: [] }),
  getPointsHistory: data(page([])),
  getPointsPurchaseHistory: data(page([])),
  getPointsSpendHistory: data(page([])),
  getPointsPackages: data(page([])),
  getProVouchersAssignment: data({ data: [] }),
  getQuotes: data(page([])),
  getSubscriptions: data({ data: [] }),
  getCurrentProLead: data(null),
  getTrustStickers: data(page([])),
  getProductsTrust: data(page([])),
  getMotivationalStickers: data(page([])),
  getProsReviewMe: data(page([])),
  getServiceWorkPhotos: data({ documentId: null, status: null, photos: [] }),
  getServiceStatus: data([]),
  getSimilarServices: data({ data: [] }),
}

const SERVER_ERROR: EndpointAnswer = {
  error: { status: 500, data: { message: "Internal server error" } },
}

/** Every main endpoint fails as a server error would (the signed-in pro still loads). */
export const ERROR: BackendFixtures = Object.fromEntries(
  Object.keys(DATA).map((endpoint) => [
    endpoint,
    endpoint === "getPros" ? DATA.getPros : SERVER_ERROR,
  ])
)
