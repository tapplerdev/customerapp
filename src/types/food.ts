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
  // km, null = pro delivers with no radius cap
  deliveryRadius?: number | null
  // The pro's address point(s) — an address is in-zone when within
  // deliveryRadius of ANY of them (mirrors the backend rule).
  proLocations?: { latitude: number; longitude: number }[]
}

// One cart line = a menu item + a specific combination of option choices.
// Same item with different choices is a separate line (own uid).
export type CartSelectedOptionType = {
  optionName: string
  choices: { name: string; price: number }[]
}

export type CartItemType = {
  uid: string
  menuItemId: number
  name: string
  // Unit base price (discount already applied) — choices priced separately
  price: number
  quantity: number
  selectedOptions?: CartSelectedOptionType[]
  photo?: string
}
