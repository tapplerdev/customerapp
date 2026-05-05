import { NativeStackScreenProps } from "@react-navigation/native-stack"
import { ChatPreviewType } from "types/chat"
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
  SubCategoriesScreen: { service: ServiceType }
  SearchAnimationScreen: {
    nextParams: {
      categoryId: number
      categoryName: string
      serviceId: number
      address: AddressInfo
      placeOfService?: string
    }
  }
  ProsListingScreen: {
    categoryId: number
    categoryName: string
    serviceId: number
    address: AddressInfo
    placeOfService?: string
  }
  QuestionFlowScreen: {
    categoryId: number
    categoryName: string
    serviceId: number
    address: AddressInfo
    placeOfServiceOptions: string[]
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
    }) => void
  }
  FiltersScreen: {
    currentPlaceOfService?: string
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
    }) => void
  }
  QuestionStepScreen: {
    categoryId: number
    categoryName: string
    serviceId: number
    placeOfServiceOptions: string[]
    customerQuestions: import("types/cms").ServiceQuestionType[]
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
  }
  JobDetailScreen: {
    jobId: number
  }
  RequestDetailsScreen: {
    jobId: number
  }
  RequestSuccessScreen: {
    address?: AddressInfo
  } | undefined
}

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>
