export type ProSubscriptionType = {
  id: number
  type: string
  status: string
}

export type ProDocumentType = {
  id: number
  type: string
  status: string
  trustDocumentData?: {
    trustProduct?: {
      descriptionEn?: string
      descriptionAr?: string
      pictureEn?: string
      pictureAr?: string
    }
  }
}

export type ProOfferType = {
  id: number
  title?: string
  description?: string
}

export type ProAddressType = {
  city?: string
  governorate?: string
  streetAddress?: string
  location?: { lat: number; lon: number }
}

export type ProReviewScoreType = {
  overallScore: number
  qualityScore: number
  completionInTimeScore: number
  jobAwarenessScore: number
  honestyScore: number
  responseTimeScore: number
  reviewsCount: number
}

export type ProServiceCategoryType = {
  serviceCategoryId: number
  status: string
  isFeatured: boolean
  subscriptions?: ProSubscriptionType[]
}

export type ProHourType = {
  id: number
  dayOfWeek: string
  openingTime: string
  closingTime: string
}

export type ProSocialType = {
  id: number
  socialMedia: string
  socialLink: string
}

export type ProMediaType = {
  id: number
  type: string
  url?: string
}

export type ProType = {
  id: number
  registeredName: string
  businessName?: string
  screenName?: string
  displayName?: string
  proType: "individual" | "company"
  profilePhoto?: string
  profilePhoto150?: string
  profilePhoto720?: string
  profilePhoto1920?: string
  reviewScore?: ProReviewScoreType
  informationAbout?: string
  address?: ProAddressType
  serviceCategories?: ProServiceCategoryType[]
  documents?: ProDocumentType[]
  subscriptions?: ProSubscriptionType[]
  offers?: ProOfferType[]
  mobileNumber?: string
  email?: string
  photosOfWork?: string[]
  hours?: ProHourType[]
  paymentMethods?: string[]
  socials?: ProSocialType[]
  media?: ProMediaType[]
  responseTimeHours?: number
  lastSeen?: string
}

export type ListProsResponse = {
  data: ProType[]
  total: number
  page: number
  perPage: number
}
