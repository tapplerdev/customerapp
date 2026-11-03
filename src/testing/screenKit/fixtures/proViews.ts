import type { ProType } from "types/pro"

/*
 * The slim pro shapes the app asks for (backend #423), as the server cuts
 * them: `?view=card` on the listing and `?view=profile` on a pro. A copy of
 * ProCardView / ProProfileView in the backend's pro-core/utils/pro-views.ts,
 * with its projectView. A screen fed a fixture cut to its shape must draw
 * what it drew from the whole pro, which proves every field it reads is in
 * the shape.
 */
type ViewShape = true | ViewShape[] | { [key: string]: ViewShape }

const projectView = (value: unknown, shape: ViewShape): unknown => {
  if (shape === true || value === null || value === undefined) return value
  if (Array.isArray(shape)) {
    return Array.isArray(value)
      ? value.map((element) => projectView(element, shape[0]))
      : value
  }
  if (typeof value !== "object") return value
  const projected: Record<string, unknown> = {}
  for (const [key, keyShape] of Object.entries(shape)) {
    const keyValue = (value as Record<string, unknown>)[key]
    if (keyValue !== undefined) projected[key] = projectView(keyValue, keyShape)
  }
  return projected
}

const STICKER_DOCUMENTS: ViewShape = [
  {
    id: true,
    type: true,
    status: true,
    trustDocumentData: {
      trustProduct: {
        id: true,
        pictureEn: true,
        pictureAr: true,
        descriptionEn: true,
        descriptionAr: true,
      },
    },
  },
]

const STICKER_SERVICE_CATEGORIES: ViewShape = [
  {
    serviceCategoryId: true,
    isFeatured: true,
    subscriptions: [
      {
        id: true,
        promoStickerMessage: true,
        product: { id: true, subType: true, pictureEn: true, pictureAr: true },
      },
    ],
  },
]

const CARD: ViewShape = {
  id: true,
  registeredName: true,
  businessName: true,
  screenName: true,
  proType: true,
  profilePhoto: true,
  profilePhoto150: true,
  informationAbout: true,
  responseTimeHours: true,
  distanceKm: true,
  isDeliveryEnabled: true,
  isPickupEnabled: true,
  reviewScore: { overallScore: true, reviewsCount: true },
  address: { address: { city: true, governorate: true } },
  serviceCategories: STICKER_SERVICE_CATEGORIES,
  documents: STICKER_DOCUMENTS,
}

const PROFILE: ViewShape = {
  id: true,
  registeredName: true,
  businessName: true,
  proType: true,
  serviceScreenName: true,
  profilePhoto: true,
  profilePhoto150: true,
  informationAbout: true,
  reviewScore: { overallScore: true, reviewsCount: true },
  documents: STICKER_DOCUMENTS,
  workPhotos: [
    { id: true, mimeType: true, posterUrl: true, urlThumb: true, url720: true, url: true },
  ],
  hours: [{ dayOfWeek: true, openingTime: true, closingTime: true }],
  paymentMethods: true,
  socials: [{ id: true, socialMedia: true, socialLink: true }],
  address: { address: { city: true, governorate: true, location: true } },
}

/** A pro as `GET /pros/category/:id?view=card` sends it. */
export const asCard = (pro: ProType): ProType => projectView(pro, CARD) as ProType

/**
 * A pro as `GET /pros/:id?view=profile` sends it. The profile only ever
 * drew trust stickers (the server keeps type "trust" only).
 */
export const asProfile = (pro: ProType): ProType => {
  const cut = projectView(pro, PROFILE) as ProType
  return cut.documents
    ? { ...cut, documents: cut.documents.filter((doc) => doc.type === "trust") }
    : cut
}

type Answer = unknown
const mapAnswer = (answer: Answer, cut: (data: any) => unknown): Answer => {
  if (typeof answer === "function") {
    return (...args: unknown[]) => mapAnswer(answer(...args), cut)
  }
  if (answer && typeof answer === "object" && "data" in answer) {
    return { ...answer, data: cut((answer as { data: unknown }).data) }
  }
  return answer
}

/**
 * A render's backend with the pros the slim views send: the listing's rows
 * cut to the card, a pro cut to the profile. Everything else as given.
 */
export const withSlimPros = <A extends Record<string, unknown>>(api: A): A => ({
  ...api,
  ...("getProsForCategory" in api && {
    getProsForCategory: mapAnswer(api.getProsForCategory, (page) =>
      page && Array.isArray(page.data) ? { ...page, data: page.data.map(asCard) } : page
    ),
  }),
  ...("getProProfile" in api && {
    getProProfile: mapAnswer(api.getProProfile, (pro) => (pro ? asProfile(pro) : pro)),
  }),
})
