import { ProType } from "./pro"

export type CreateJobAddressType = {
  city: string
  governorate: string
  streetAddress?: string
  location: { lat: number; lng: number }
}

export type CreateJobDateType = {
  date: string
}

export type CreateJobTimeSlotType = {
  start: string
  end: string
}

export type QuestionAnswerType = {
  questionId: number
  answer?: string
  optionId?: number
  optionsIds?: number[]
  date?: string
  startDate?: string
  endDate?: string
  startTime?: string
  endTime?: string
  files?: string[]
}

export type CreateJobRequest = {
  serviceCategoryId: number
  address: CreateJobAddressType
  prosIds: number[]
  placeOfService?: string
  dateType?: "asap" | "hours48" | "week" | "date" | "notDecided"
  dates?: CreateJobDateType[]
  timeSlots?: CreateJobTimeSlotType[]
  orderNotes?: string
  questionsAnswers: QuestionAnswerType[]
  // Food orders (hasMenu categories): lines are validated server-side
  // against the pro's approved menu — names/prices must be the menu's own
  foodOrderItems?: {
    menuItemId: number
    name: string
    price: number
    quantity: number
    selectedOptions?: {
      optionName: string
      choices: { name: string; price: number }[]
    }[]
  }[]
  // Both collected on delivery — no in-app payment capture
  paymentMethod?: "cash" | "creditCard"
}

export type JobAddressType = {
  address?: {
    streetAddress?: string
    city?: string
    governorate?: string
    location?: { lat?: number; lng?: number; latitude?: number; longitude?: number }
  }
  location?: { lat: number; lng: number }
  latitude?: number
  longitude?: number
}

export type JobDateType = {
  id: number
  date: string
  startTime?: string
  endTime?: string
}

export type JobTimeSlotType = {
  id: number
  start: string
  end: string
}

export type JobServiceCategoryType = {
  id: number
  nameEn: string
  nameAr: string
  picture?: string
  // Parent service — always on the wire (ServiceCategoryDto); needed to
  // re-enter the request flow from an existing job (repost).
  serviceId?: number
}

export type JobProOfferType = {
  id: number
  jobProId: number
  ratePerHour: number
  createdAt: string
}

export type JobProReviewType = {
  id: number
  status: string
  qualityScore?: number
  completionInTimeScore?: number
  jobAwarenessScore?: number
  honestyScore?: number
  responseTimeScore?: number
  overallScore?: number
  comment?: string
}

export type JobProType = {
  id: number
  jobId: number
  proId: number
  selectionStatus: "selected" | "opportunity" | "offer" | "proRejected" | "customerRejected"
  responseTime?: number
  ratePerHour?: number
  opportunityNotes?: string
  proOfferSentAt?: string
  proOpportunityOfferSentAt?: string
  rejectedByProAt?: string
  opportunityRejectedAt?: string
  opportunityAcceptedAt?: string
  rejectReason?: string
  status?: string
  // Food orders: set by the pro when cancelling (customerNotAnswering, ...)
  foodOrderCancelReason?: string
  pro?: ProType
  offers?: JobProOfferType[]
  review?: JobProReviewType | null
}

export type JobFoodOrderItemType = {
  id: number
  menuItemId: number
  name: string
  price: number
  quantity: number
  selectedOptions?: {
    optionName: string
    choices: { name: string; price: number }[]
  }[]
}

export type JobType = {
  id: number
  status: string
  requestedOn: string
  serviceCategoryId: number
  customerId: number
  address?: JobAddressType
  serviceCategory?: JobServiceCategoryType
  pros?: JobProType[]
  dateType?: string
  dates?: JobDateType[]
  timeSlots?: JobTimeSlotType[]
  questionsAnswers?: QuestionAnswerType[]
  placeOfService?: string
  isOnReview?: boolean
  orderNotes?: string
  paymentMethod?: string
  // Food orders: lines + server-computed totals persisted at creation
  foodOrderItems?: JobFoodOrderItemType[]
  deliveryFee?: number
  orderDiscount?: number
  createdAt: string
  updatedAt: string
}

export type ListJobsResponse = {
  data: JobType[]
  total: number
  page: number
  perPage: number
}
