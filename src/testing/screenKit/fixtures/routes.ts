/**
 * Jest only. Route params for every registered screen that reads them, by
 * route name, typed by the navigator's own param list (navigation/types),
 * so a param a screen needs can't drift from what its callers pass. The
 * records come from entities.ts. A test gives its own params where a state
 * needs others (`route: { name, params }`).
 */
import type {
  AddressInfo,
  RootStackParamList,
  SelectedProInfo,
} from "navigation/types"

import type { ScreenState } from "../store"

import {
  CART_DRAFT,
  CATEGORY,
  CATEGORY_FOOD,
  CHAT_PREVIEW,
  JOB,
  JOB_FOOD,
  NOTIFICATION_UNREAD,
  PRO_COMPANY,
  PRO_FOOD,
  PRO_INDIVIDUAL,
  QUESTION_NOTES,
  QUESTION_PLACE,
  SERVICE,
  SERVICE_FOOD,
} from "./entities"
import { SAVED_HOME } from "./users"

type RouteParams = {
  [Route in keyof RootStackParamList]?: RootStackParamList[Route]
}

/** The customer's address as the request flow carries it. */
export const ADDRESS: AddressInfo = {
  address: "12 Tahrir Street, Dokki",
  city: "Dokki",
  governorate: "Giza",
  coords: { lat: 30.0444, lon: 31.2357 },
}

const SELECTED_PROS: SelectedProInfo[] = [
  {
    id: PRO_INDIVIDUAL.id,
    name: PRO_INDIVIDUAL.registeredName,
    photo: PRO_INDIVIDUAL.profilePhoto,
    rating: 4.6,
    reviewsCount: 18,
    proType: "individual",
  },
  {
    id: PRO_COMPANY.id,
    name: PRO_COMPANY.registeredName,
    rating: 4.6,
    reviewsCount: 18,
    proType: "company",
  },
]

const REQUEST = {
  categoryId: CATEGORY.id,
  categoryName: CATEGORY.nameEn,
  serviceId: SERVICE.id,
  selectedProIds: SELECTED_PROS.map((pro) => pro.id),
  selectedProNames: SELECTED_PROS.map((pro) => pro.name).join(", "),
  selectedProsInfo: SELECTED_PROS,
  address: ADDRESS,
  placeOfService: "customerPlace",
}

const ANSWERS = [
  { questionId: QUESTION_PLACE.id, optionId: 7011 },
  { questionId: QUESTION_NOTES.id, answer: "Under the kitchen sink." },
]

const FOOD_CONTEXT = {
  proId: PRO_FOOD.id,
  serviceCategoryId: CATEGORY_FOOD.id,
  serviceId: SERVICE_FOOD.id,
  proName: PRO_FOOD.registeredName,
  categoryName: CATEGORY_FOOD.nameEn,
  fulfillmentMode: "delivery" as const,
}

export const ROUTE_PARAMS: RouteParams = {
  HomeTabs: { screen: "home" },
  MySavedAddressesScreen: { selectionMode: false },
  AddNewAddressScreen: {
    address: ADDRESS.address,
    city: ADDRESS.city,
    governorate: ADDRESS.governorate,
    coords: ADDRESS.coords,
  },
  ViewAddressScreen: {
    addressId: SAVED_HOME.id,
    name: SAVED_HOME.name,
    streetAddress: SAVED_HOME.address.streetAddress ?? "",
    city: SAVED_HOME.address.city,
    governorate: SAVED_HOME.address.governorate,
    type: SAVED_HOME.type,
  },
  MessagesDetailsScreen: { chatPreview: CHAT_PREVIEW },
  SubCategoriesScreen: { service: SERVICE },
  SearchAnimationScreen: {
    nextParams: {
      categoryId: CATEGORY.id,
      categoryName: CATEGORY.nameEn,
      serviceId: SERVICE.id,
      address: ADDRESS,
    },
  },
  ProsListingScreen: {
    categoryId: CATEGORY.id,
    categoryName: CATEGORY.nameEn,
    serviceId: SERVICE.id,
    address: ADDRESS,
    placeOfService: "customerPlace",
  },
  FoodMenuScreen: FOOD_CONTEXT,
  FoodItemScreen: { ...FOOD_CONTEXT, menuItemId: 411 },
  FoodCartScreen: { proId: CART_DRAFT.proId },
  FoodCheckoutScreen: { proId: CART_DRAFT.proId },
  FoodOrderReviewScreen: {
    proId: CART_DRAFT.proId,
    payload: {
      serviceCategoryId: CATEGORY_FOOD.id,
      address: {
        city: "Dokki",
        governorate: "Giza",
        streetAddress: "12 Tahrir Street",
        location: { lat: 30.0444, lng: 31.2357 },
      },
      prosIds: [PRO_FOOD.id],
      placeOfService: "customerPlace",
      questionsAnswers: [],
      foodOrderItems: [
        { menuItemId: 411, name: "Molokhia with chicken", price: 185, quantity: 1 },
      ],
      paymentMethod: "cash",
    },
    isPickup: false,
    whereLabel: "Deliver to",
    whereValue: "12 Tahrir Street, Dokki",
    whenValue: "As soon as possible",
    paymentLabel: "Cash on delivery",
    mapCoords: ADDRESS.coords,
  },
  ServiceRequestDetailsScreen: {
    ...REQUEST,
    answeredQuestions: ANSWERS,
    initialAnsweredIds: ANSWERS.map((answer) => answer.questionId),
    stepIndex: 0,
  },
  RequestSummaryScreen: {
    ...REQUEST,
    questionsAnswers: ANSWERS,
    dateType: "asap",
    notes: "Please call when you arrive.",
  },
  ReviewProSelectionScreen: { jobId: JOB.id },
  ReviewFormScreen: { jobId: JOB.id, proId: PRO_INDIVIDUAL.id },
  ProProfileScreen: {
    proId: PRO_INDIVIDUAL.id,
    serviceCategoryId: CATEGORY.id,
  },
  JobDetailScreen: { jobId: JOB.id },
  NotificationDetailsScreen: { notification: NOTIFICATION_UNREAD },
  RequestDetailsScreen: { jobId: JOB.id },
  // Saved already: an unsaved address opens the save sheet after 3 s.
  RequestSuccessScreen: { address: { ...ADDRESS, savedAddressId: SAVED_HOME.id } },
  SaveAddressSheetScreen: { address: ADDRESS },
}

/**
 * Screens whose content depends on more than their default params: the
 * params (or store states) that reach each other part. The coverage sweep
 * renders each; a screen's own parity test picks its own.
 */
export const ROUTE_VARIANTS: Record<
  string,
  { name: string; params?: object; state?: ScreenState }[]
> = {
  // A food order draws FoodOrderView instead of the offers list.
  JobDetailScreen: [{ name: "food order", params: { jobId: JOB_FOOD.id } }],
}
