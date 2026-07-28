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

export type ProWorkPhotoType = {
  id: number
  url: string
  url720: string
  url150: string
  // Distinguishes a video from an image without sniffing the URL
  mimeType: string | null
  // Poster frame uploaded with the video; null for images
  posterUrl: string | null
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
  // Straight-line km to the pro (backend-computed; set only when the list
  // request carries a customer address). Food cards render it.
  distanceKm?: number
  // Food fulfillment capability (food listings only) — drives the card badges
  isDeliveryEnabled?: boolean
  isPickupEnabled?: boolean
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
  // Per-service gallery: already filtered by the backend to the service being
  // viewed and to approved items only. Replaces the legacy pro-level
  // photosOfWork, which is no longer sent to customers.
  workPhotos?: ProWorkPhotoType[]
  hours?: ProHourType[]
  // The API serialises these as objects ({ type: "cash" | "credit card" }),
  // not bare strings — ProDto @Type()s them to ProPaymentMethodDto.
  paymentMethods?: { type: string }[]
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
