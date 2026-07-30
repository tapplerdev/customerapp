import { CreateJobRequest } from "types/job"
import { NativeStackScreenProps } from "@react-navigation/native-stack"
import { ChatPreviewType } from "types/chat"
import { NotificationsItemType } from "types/notification"
import { ServiceType } from "types/cms"
import { QuestionAnswerType } from "types/job"
import { AddressInfo } from "@tappler/shared/src/types"

export type { AddressInfo }

export type SelectedProInfo = {
  id: number
  name: string
  photo?: string
  rating?: number
  reviewsCount?: number
  proType: "individual" | "company"
}

export type RootStackParamList = {
  WelcomeScreen: undefined
  AuthWelcomeScreen: undefined
  RegisterScreen: undefined
  SignInEmailScreen: undefined
  GuestLocationScreen: undefined
  PickAddressScreen: undefined
  AuthGateScreen: undefined
  TapplyAIScreen: undefined
  HomeTabs: { screen?: string } | undefined
  AccountDetailsScreen: undefined
  MyInformationScreen: undefined
  ChangePasswordScreen: undefined
  UpdateMobileNumberScreen: undefined
  UpdateEmailScreen: undefined
  DeleteAccountScreen: undefined
  MySavedAddressesScreen: { selectionMode?: boolean } | undefined
  AddNewAddressScreen: {
    address?: string
    city?: string
    governorate?: string
    coords?: { lat: number; lon: number }
    fromSuccess?: boolean
  } | undefined
  ViewAddressScreen: {
    addressId: number
    name: string
    streetAddress: string
    city: string
    governorate: string
    type: string
  }
  AboutAppScreen: undefined
  ArchivedMessagesScreen: undefined
  MessagesDetailsScreen: { chatPreview: ChatPreviewType }
  CategoriesScreen: undefined
  SubCategoriesScreen: {
    service: ServiceType
  }
  SearchAnimationScreen: {
    nextParams: {
      categoryId: number
      categoryName: string
      serviceId: number
      address: AddressInfo
      placeOfService?: string
      // Repost flow: forwarded verbatim to ProsListingScreen
      initialAnswers?: QuestionAnswerType[]
      forceQuestionFlow?: boolean
    }
  }
  ProsListingScreen: {
    categoryId: number
    categoryName: string
    serviceId: number
    address: AddressInfo
    placeOfService?: string
    // Repost flow: seeds the listing's answer state from a previous job so
    // the question flow / details steps arrive pre-filled.
    initialAnswers?: QuestionAnswerType[]
    // Repost flow: present the first-arrival question flow even though a
    // placeOfService is already known — it opens pre-filled, "starting fresh".
    forceQuestionFlow?: boolean
  }
  QuestionFlowScreen: {
    categoryId: number
    categoryName: string
    serviceId: number
    address: AddressInfo
    placeOfServiceOptions: string[]
  }
  // Food ordering (hasMenu categories): browse a pro's approved menu →
  // item detail (options/qty) → cart. Context params ride along so add-to-
  // cart can stamp the cart with pro/category/address without extra fetches.
  FoodMenuScreen: {
    proId: number
    serviceCategoryId: number
    serviceId: number
    proName: string
    categoryName: string
    fulfillmentMode?: "delivery" | "pickup"
  }
  FoodItemScreen: {
    menuItemId: number
    proId: number
    serviceCategoryId: number
    serviceId: number
    proName: string
    categoryName: string
    fulfillmentMode?: "delivery" | "pickup"
  }
  // Both operate on the draft for the pro they were entered from
  FoodCartScreen: { proId: number }
  FoodCheckoutScreen: { proId: number }
  // The payload is built by checkout and passed through verbatim — plain JSON,
  // so it crosses the boundary without a serialisation warning. The display
  // strings ride along so this screen never re-derives what checkout decided.
  FoodOrderReviewScreen: {
    proId: number
    payload: CreateJobRequest
    isPickup: boolean
    whereLabel: string
    whereValue: string
    whenValue: string
    paymentLabel: string
    // Anchors the map: the customer's address on delivery, the pro's on
    // pickup (where it only resolves the area — it is never pinned).
    mapCoords?: { lat: number; lon: number } | null
  }
  AllQuestionsScreen: {
    categoryName: string
    placeOfServiceOptions: string[]
    customerQuestions: import("types/cms").ServiceQuestionType[]
    initialAnswers: import("types/job").QuestionAnswerType[]
    initialPlaceOfService?: string
    onApply: (result: {
      placeOfService?: string
      filterOptionIds: number[]
      dataAnswers: import("types/job").QuestionAnswerType[]
      allAnswers: import("types/job").QuestionAnswerType[]
      filtersChanged: boolean
      resetAll?: boolean
    }) => void
  }
  FiltersScreen: {
    currentPlaceOfService?: string
    // Food only: shows a Fulfillment (All/Delivery/Pickup) section + un-gates
    // the distance slider.
    isFoodCategory?: boolean
    foodMode?: "all" | "delivery" | "pickup"
    refinementFilters?: import("types/cms").ServiceQuestionType[]
    initialRefinementOptionIds?: number[]
    initialRanges?: { filterId: number; min?: number; max?: number }[]
    upfrontSelections?: {
      questionText: string
      questionTextAr?: string
      options: { key: string; label: string; labelAr?: string }[]
    }[]
    initialFilters?: {
      proType?: string
      distanceKm?: number
      minRating?: number
      maxResponseTimeHours?: number
      creditCardPayment?: boolean
    }
    onApply: (filters: {
      proType?: string
      distanceKm?: number
      minRating?: number
      maxResponseTimeHours?: number
      creditCardPayment?: boolean
      refinementFilterOptionIds: number[]
      ranges: { filterId: number; min?: number; max?: number }[]
      fulfillment?: "all" | "delivery" | "pickup"
    }) => void
  }
  QuestionStepScreen: {
    categoryId: number
    categoryName: string
    serviceId: number
    placeOfServiceOptions: string[]
    customerQuestions: import("types/cms").ServiceQuestionType[]
    // Repost flow: pre-fill the flow with a previous job's answers
    initialAnswers?: QuestionAnswerType[]
    initialPlaceOfService?: string
  }
  ServiceRequestDetailsScreen: {
    categoryId: number
    categoryName: string
    serviceId: number
    selectedProIds: number[]
    selectedProNames: string
    selectedProsInfo: SelectedProInfo[]
    address: AddressInfo
    placeOfService?: string
    answeredQuestions?: QuestionAnswerType[]
    initialAnsweredIds?: number[]
    stepIndex?: number
  }
  RequestSummaryScreen: {
    categoryId: number
    categoryName: string
    serviceId: number
    selectedProIds: number[]
    selectedProNames: string
    selectedProsInfo: SelectedProInfo[]
    address: AddressInfo
    placeOfService?: string
    questionsAnswers: QuestionAnswerType[]
    dateType?: string
    selectedDate?: string
    selectedTimeSlot?: { start: string; end: string }
    notes?: string
  }
  ReviewProSelectionScreen: {
    jobId: number
  }
  ReviewFormScreen: {
    jobId: number
    proId: number
  }
  ProProfileScreen: {
    proId: number
    serviceCategoryId: number
    serviceCategories?: import("types/pro").ProServiceCategoryType[]
    chatJobId?: number
    // Present when arriving from a food (hasMenu) listing: shows the
    // floating "Food Menu" pill and carries the context the menu needs
    foodMenu?: {
      serviceId: number
      categoryName: string
      address: AddressInfo | null
    }
  }
  JobDetailScreen: {
    jobId: number
  }
  NotificationsScreen: undefined
  NotificationDetailsScreen: { notification: NotificationsItemType }
  RequestDetailsScreen: {
    jobId: number
  }
  RequestSuccessScreen: {
    address?: AddressInfo
  } | undefined
  SaveAddressSheetScreen: {
    address?: AddressInfo
  } | undefined
}

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>
