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

// The API nests this: ProAddressDto wraps an AddressDto. The flat shape here
// never matched the payload, which is why nothing could read it.
export type ProAddressType = {
  changedAt?: string
  address?: {
    streetAddress?: string
    city?: string
    governorate?: string
    unitNumber?: string
    // The wire uses lng, not lon (transformCoordinatesToPoint -> PointDto).
    // The customer's OWN address is the one that uses lon; do not conflate them.
    location?: { lat: number; lng: number }
  }
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
  // Bare strings ("cash" | "credit card"). ProDto @Type()s them to
  // ProPaymentMethodDto but a @Transform ABOVE that flattens to type, so the
  // wire format is a string array despite the DTO's declared type.
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
