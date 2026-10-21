/**
 * Jest only. Route params for every registered screen that reads them, by
 * route name, typed by the navigator's own param list (navigation/types),
 * so a param a screen needs can't drift from what its callers pass. The
 * records come from entities.ts. A test gives its own params where a state
 * needs others (`route: { name, params }`).
 */
import type { RootStackParamList } from "navigation/types"
import type { ProAdditionalDocumentsType } from "types"

import type { ScreenState } from "../store"

import {
  ADDRESS,
  CHAT_PREVIEW,
  FOOD_ORDER,
  ID_DOCUMENT,
  JOB,
  JOB_LEAD,
  MENU_ITEM,
  MENU_SECTION,
  NOTIFICATION,
  PAYMENT_TRANSACTION,
  PLACE_OF_SERVICE,
  POINTS_HISTORY,
  PROFILE_PARAMS,
  REJECTED_ITEM,
  SEARCH_ITEM,
  SERVICE,
  SERVICE_FOOD,
  SERVICE_PENDING_INTERVIEW,
  SUB_CATEGORY,
} from "./entities"
import { PRO_INDIVIDUAL, signedOut } from "./users"

type RouteParams = {
  [Route in keyof RootStackParamList]?: RootStackParamList[Route]
}

const noop = () => undefined

const REJECTED_DOCUMENT: ProAdditionalDocumentsType = {
  id: 801,
  proDocument: {
    id: 802,
    type: "serviceCategory",
    status: "rejected",
    createdAt: "2026-10-01T09:00:00.000Z",
    processedAt: "2026-10-02T09:00:00.000Z",
    proId: PRO_INDIVIDUAL.id,
    processedById: null,
    files: [
      {
        assignment: "front",
        url: "https://example.com/parity/doc-802.jpg",
        extension: "jpg",
      },
    ],
    rejectedBySystem: false,
  },
  additionalDocument: {
    id: 803,
    serviceCategoryId: SERVICE.serviceCategory.id,
    documentTitle: "Plumbing license",
  },
}

const SERVICE_CATEGORY = {
  id: 10,
  nameAr: "إصلاحات المنزل",
  nameEn: "Home repairs",
  categories: [SUB_CATEGORY],
}

export const ROUTE_PARAMS: RouteParams = {
  "account-upgrades-notes": { selectedTypes: ["featured"] },
  camera: { type: "front" },
  "delivery-radius": {
    service: SERVICE_FOOD,
    placeOfService: { ...PLACE_OF_SERVICE, place: "delivery" },
  },
  "details-in-messages": { job: JOB_LEAD },
  done: {
    nextScreenName: "home",
    title: "Your request was sent",
    subtitle: "We'll let you know as soon as it's reviewed.",
  },
  "email-verify": { email: PRO_INDIVIDUAL.email },
  "expired-opportunity": { job: JOB },
  "filter-categories": { selectedCategory: SUB_CATEGORY, isLeads: true },
  "filter-cities": { selectedAddress: SEARCH_ITEM, isLeads: true },
  "food-delivery-charge": { service: SERVICE_FOOD },
  "food-discounts": { service: SERVICE_FOOD },
  "food-menu": { service: SERVICE_FOOD },
  "food-menu-store": { service: SERVICE_FOOD },
  "food-order-detail": { job: FOOD_ORDER },
  "food-place-of-service": { service: SERVICE_FOOD },
  "food-section-detail": {
    service: SERVICE_FOOD,
    currentSection: MENU_SECTION,
  },
  "food-section-menu-detail": {
    service: SERVICE_FOOD,
    menuItem: MENU_ITEM,
    currentSection: MENU_SECTION,
  },
  "governorate-select": { onSubmit: noop },
  interview: { service: SERVICE_PENDING_INTERVIEW },
  "interview-failed": {
    serviceCategoryId: SERVICE_PENDING_INTERVIEW.serviceCategory.id,
  },
  "lead-detail": { job: JOB_LEAD },
  "legal-document": { document: "terms" },
  "messages-details": { chatPreview: CHAT_PREVIEW },
  "my-account-verify-mobile-number": { phone: PRO_INDIVIDUAL.mobileNumber },
  "my-documents-bussiness-detail": { address: ADDRESS },
  "my-documents-change-place": { address: ADDRESS },
  "my-documents-selfie": { idDocumentData: ID_DOCUMENT },
  "my-points-transactions": { data: POINTS_HISTORY },
  "my-profile-about-me": { profileParams: PROFILE_PARAMS },
  "my-profile-business-hours": { profileParams: PROFILE_PARAMS },
  "my-profile-choose-account-type": { profileParams: PROFILE_PARAMS },
  "my-profile-payments-methods": { profileParams: PROFILE_PARAMS },
  "my-profile-photos-of-works": { profileParams: PROFILE_PARAMS },
  "my-profile-picture": { profileParams: PROFILE_PARAMS },
  "my-profile-qualification-credentials": { profileParams: PROFILE_PARAMS },
  "my-profile-social-media-links": { profileParams: PROFILE_PARAMS },
  "my-service-detail-documents": { service: SERVICE },
  "my-service-detail-documents-status": { service: SERVICE },
  "my-service-qualification-credentials": { service: SERVICE },
  "my-service-resubmit-screen": {
    service: SERVICE,
    document: REJECTED_DOCUMENT,
  },
  "my-service-work-photo-adjust": {
    serviceId: SERVICE.serviceCategory.id,
    serviceName: SERVICE.serviceCategory.nameEn,
    documentFileId: 901,
    uri: "https://example.com/parity/work-901-720.jpg",
    currentThumbUri: "https://example.com/parity/work-901-thumb.jpg",
  },
  "my-service-work-photos": {
    serviceId: SERVICE.serviceCategory.id,
    serviceName: SERVICE.serviceCategory.nameEn,
  },
  "my-services-detail": { serviceId: SERVICE.serviceCategory.id },
  "offer-sent": { source: "opportunity", path: "quote", pointsSpent: 5 },
  "opportunity-detail": { job: JOB },
  "password-reset-code": { email: PRO_INDIVIDUAL.email },
  "pickup-location-type": {
    service: SERVICE_FOOD,
    selectedLocationType: "home",
  },
  "quote-view-details": { quoteId: 149 },
  "account-upgrades-view-details": { subscriptionId: 1901 },
  "password-change": {
    email: PRO_INDIVIDUAL.email,
    userType: "pro",
    confirmationCode: "1234",
    lang: "en",
  },
  "food-order-cancel-modal": { jobId: FOOD_ORDER.id },
  "points-transaction-detail": { type: "purchase", id: 3001 },
  "payment-transaction-detail": { transaction: PAYMENT_TRANSACTION },
  "create-food-menu-option": { onSave: noop },
  "media-gallery": { onMediaSelected: noop },
  "select-city": { onSubmit: noop },
  "my-account-verify-email": { email: PRO_INDIVIDUAL.email },
  "place-of-services": { service: SERVICE },
  preview: { menuItem: MENU_ITEM },
  "rejected-items": { service: SERVICE_FOOD, rejectedItems: [REJECTED_ITEM] },
  "revice-offer": { chatPreview: CHAT_PREVIEW },
  "score-detail": { type: "review" },
  "screen-name": { service: SERVICE_FOOD },
  "select-location-type-modal": {
    service: SERVICE,
    currentPlaceOfService: PLACE_OF_SERVICE,
  },
  "send-offer": { job: JOB },
  "service-detail": { service: SERVICE_CATEGORY },
  "service-setup": { service: SERVICE },
  "service-setup-food": { service: SERVICE_FOOD },
  "sign-up-check": { method: "email" },
  "similar-service": {
    id: SERVICE.serviceCategory.id,
    serviceId: SERVICE.serviceCategory.serviceId,
  },
  "trust-stickers-individual": { type: "health" },
  "updates-notifications": { notifications: NOTIFICATION },
  "view-my-profile": { selectedService: SERVICE },
  "view-my-profile-preview": { service: SERVICE },
  wait: {
    title: "We're checking your documents",
    descr: "This usually takes up to 48 hours.",
    startHours: 24,
    endHours: 48,
  },
}

/**
 * Screens whose content depends on more than params: the store states that
 * reach each part (the registration flow resumes at its saved step). The
 * coverage sweep renders each; a screen's own parity test picks its own.
 */
export const ROUTE_VARIANTS: Record<
  string,
  { name: string; state: ScreenState }[]
> = {
  "registration-flow": [0, 1, 2, 3, 4, 5, 6, 7, 8].map((currentStep) => ({
    name: `step ${currentStep}`,
    state: {
      auth: {
        ...signedOut,
        isAuth: true,
        isRegistrationFlowComleted: false,
        token: "parity-signup-token",
        registrationResult: {
          accoutType: "individual",
          personalInfo: {
            firstName: "Omar",
            lastName: "Hassan",
            address: "12 Tahrir Street",
            city: "Dokki",
            governorate: "Giza",
            gender: "male",
            coords: { lat: 30.0444, lon: 31.2357 },
          },
          aboutMe: "Ten years fixing plumbing in Giza.",
          payments: ["cash"],
          phone: "+201000000000",
          currentStep,
          currentBarStep: Math.max(0, currentStep - 1),
        },
      },
    },
  })),
}
