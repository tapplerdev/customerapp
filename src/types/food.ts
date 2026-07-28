// Food-ordering (hasMenu categories). Menu shapes mirror the backend's
// customer menu endpoint (GET pros/category/:serviceCategoryId/:proId/menu),
// which serves the pro's latest APPROVED snapshot — the same ids/prices the
// FoodOrderItemsMatchMenu validator pins order lines to at submission.

export type FoodOptionChoiceType = {
  id?: number
  name: string
  price: string | number
  discountPrice?: string | number
}

export type FoodOptionType = {
  id?: number
  name: string
  isRequired: boolean
  minQty: string | number
  maxQty: string | number
  choices: FoodOptionChoiceType[]
}

export type FoodMenuItemType = {
  id: number
  name: string
  description: string
  price: number
  discountPrice: number
  isExpressDeliveryAvailable: boolean
  isPreOrderOnly: boolean
  options?: FoodOptionType[]
  photo: string
  inStock?: boolean
}

export type FoodMenuSectionType = {
  id: number
  title: string
  order: number
  menuItems: FoodMenuItemType[]
}

export type FoodMenuType = {
  deliveryCharge: number
  freeDeliveryThreshold: number | null
  totalOrderValueDiscountRate: number | null
  totalOrderValueDiscountThreshold: number | null
  menuSections: FoodMenuSectionType[]
  status?: string
  // Pro's fulfillment capability — checkout limits the mode selector to these
  isDeliveryEnabled?: boolean
  isPickupEnabled?: boolean
}

// One cart line = a menu item + a specific combination of option choices.
// Same item with different choices is a separate line (own uid).
// `price` is the EFFECTIVE price (discount applied) — the only one sent to
// the backend. `originalPrice` is display-only (pre-discount, for strike-
// through totals) and MUST NOT be submitted.
export type CartSelectedOptionType = {
  optionName: string
  choices: { name: string; price: number; originalPrice?: number }[]
}

export type CartItemType = {
  uid: string
  menuItemId: number
  name: string
  // Unit base price (discount already applied) — choices priced separately
  price: number
  originalPrice?: number
  quantity: number
  selectedOptions?: CartSelectedOptionType[]
  photo?: string
  // Display-only: drives the Pre Order badge in the cart
  isPreOrderOnly?: boolean
}

// --- Service-area geometry (map overlays) ---------------------------------
// The pickup map outlines the pro's curated area rather than pinning their
// exact address, matching the pro app's opportunity map.

export type ServiceAreaRefType = {
  id: string | number
  type: string
  nameEn?: string | null
  nameAr?: string | null
}

export type PointAreasResponse = {
  country?: ServiceAreaRefType
  governorate?: ServiceAreaRefType
  area?: ServiceAreaRefType
}

// Server-simplified outline. GeoJSON coordinate order throughout: [lng, lat].
export type AreaGeometryResponse = {
  id: string
  type: string
  nameEn: string | null
  nameAr: string | null
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] }
}
