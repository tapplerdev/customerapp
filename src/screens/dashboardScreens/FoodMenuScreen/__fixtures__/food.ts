/**
 * Jest only. What the food flow's screens are captured with (S3, W2): a menu
 * with several sections and every kind of item, and the carts a customer
 * builds from it. Made up, typed by the app's own types; dated from the
 * kit's clock like the kit's own records. Used by FoodMenu, FoodItem,
 * FoodCart, FoodCheckout and FoodOrderReview's parity tests.
 */
import type { CartDraft } from "store/cart/slice"
import type { CartItemType, FoodMenuType } from "types/food"

import {
  CART_DRAFT,
  CATEGORY_FOOD,
  FOOD_MENU,
  KIT_NOW,
  PRO_FOOD,
  SERVICE_FOOD,
} from "testing/screenKit/fixtures/entities"

const PHOTO = (name: string) => `https://example.com/parity/${name}.jpg`

/** Options on one item: a required single choice, an optional pick-up-to-three. */
const MOLOKHIA_OPTIONS = [
  {
    id: 4111,
    name: "Size",
    isRequired: true,
    minQty: 1,
    maxQty: 1,
    choices: [
      { id: 41111, name: "Regular", price: 0, discountPrice: 0 },
      { id: 41112, name: "Large", price: 30, discountPrice: 25 },
    ],
  },
  {
    id: 4112,
    name: "Extras",
    isRequired: false,
    minQty: 0,
    maxQty: 3,
    choices: [
      { id: 41121, name: "Extra bread", price: 10, discountPrice: 0 },
      { id: 41122, name: "Pickles", price: 5, discountPrice: 0 },
      { id: 41123, name: "Garlic sauce", price: 0, discountPrice: 0 },
    ],
  },
]

/**
 * Three sections: a main with options, a discounted one without, a side with
 * no photo and no price, a pre-order dessert and one that is out of stock.
 * Delivery 25, free from 400, and 10% off from 300.
 */
export const RICH_MENU: FoodMenuType = {
  ...FOOD_MENU,
  deliveryCharge: 25,
  freeDeliveryThreshold: 400,
  totalOrderValueDiscountRate: 10,
  totalOrderValueDiscountThreshold: 300,
  menuSections: [
    {
      id: 41,
      title: "Mains",
      order: 1,
      menuItems: [
        {
          id: 411,
          name: "Molokhia with chicken",
          description: "Slow-cooked, with rice and bread.",
          price: 185,
          discountPrice: 0,
          isExpressDeliveryAvailable: true,
          isPreOrderOnly: false,
          leadTimeHours: null,
          photo: PHOTO("molokhia"),
          inStock: true,
          options: MOLOKHIA_OPTIONS,
        },
        {
          id: 412,
          name: "Grilled chicken",
          description: "Half a chicken, charcoal grilled, with garlic sauce.",
          price: 150,
          discountPrice: 120,
          isExpressDeliveryAvailable: true,
          isPreOrderOnly: false,
          leadTimeHours: null,
          photo: PHOTO("chicken"),
          inStock: true,
        },
      ],
    },
    {
      id: 42,
      title: "Sides",
      order: 2,
      menuItems: [
        {
          id: 421,
          name: "Vermicelli rice",
          description: "",
          price: 0,
          discountPrice: 0,
          isExpressDeliveryAvailable: true,
          isPreOrderOnly: false,
          leadTimeHours: null,
          photo: "",
          inStock: true,
        },
      ],
    },
    {
      id: 43,
      title: "Desserts",
      order: 3,
      menuItems: [
        {
          id: 431,
          name: "Basbousa",
          description: "Made to order, a day ahead.",
          price: 60,
          discountPrice: 0,
          isExpressDeliveryAvailable: false,
          isPreOrderOnly: true,
          leadTimeHours: 24,
          photo: PHOTO("basbousa"),
          inStock: true,
        },
        {
          id: 432,
          name: "Om Ali",
          description: "Sold out today.",
          price: 55,
          discountPrice: 0,
          isExpressDeliveryAvailable: false,
          isPreOrderOnly: false,
          leadTimeHours: null,
          photo: PHOTO("omali"),
          inStock: false,
        },
      ],
    },
  ],
}

const CONTEXT = {
  proId: PRO_FOOD.id,
  serviceCategoryId: CATEGORY_FOOD.id,
  serviceId: SERVICE_FOOD.id,
  proName: PRO_FOOD.registeredName,
  categoryName: CATEGORY_FOOD.nameEn,
}

const MOLOKHIA_LINE: CartItemType = {
  uid: "411:Extras=Extra bread+Pickles|Size=Large",
  menuItemId: 411,
  name: "Molokhia with chicken",
  price: 185,
  originalPrice: 185,
  quantity: 2,
  selectedOptions: [
    {
      optionName: "Size",
      choices: [{ name: "Large", price: 25, originalPrice: 30 }],
    },
    {
      optionName: "Extras",
      choices: [
        { name: "Extra bread", price: 10, originalPrice: 10 },
        { name: "Pickles", price: 5, originalPrice: 5 },
      ],
    },
  ],
  photo: PHOTO("molokhia"),
}

const CHICKEN_LINE: CartItemType = {
  uid: "412:",
  menuItemId: 412,
  name: "Grilled chicken",
  price: 120,
  originalPrice: 150,
  quantity: 1,
  photo: PHOTO("chicken"),
}

const BASBOUSA_LINE: CartItemType = {
  uid: "431:",
  menuItemId: 431,
  name: "Basbousa",
  price: 60,
  originalPrice: 60,
  quantity: 30,
  photo: "",
  isPreOrderOnly: true,
  leadTimeHours: 24,
}

/** The kit's one-line draft, with its notes and the clock the kit uses. */
export const DRAFT_ONE_LINE: CartDraft = CART_DRAFT

/** Three lines: options and a discount, a discount, a pre-order at the 30 cap. */
export const DRAFT_RICH: CartDraft = {
  ...CONTEXT,
  items: [MOLOKHIA_LINE, CHICKEN_LINE, BASBOUSA_LINE],
  orderNotes: "No onions please, and ring the bell twice.",
  fulfillmentMode: "delivery",
  lastUpdatedAt: KIT_NOW - 5 * 60 * 1000,
}

/** Two lines, picking the order up. */
export const DRAFT_PICKUP: CartDraft = {
  ...CONTEXT,
  items: [MOLOKHIA_LINE, CHICKEN_LINE],
  orderNotes: "",
  fulfillmentMode: "pickup",
  lastUpdatedAt: KIT_NOW - 5 * 60 * 1000,
}

/** A draft an hour and a half old: the sweep drops it. */
export const DRAFT_STALE: CartDraft = {
  ...DRAFT_ONE_LINE,
  lastUpdatedAt: KIT_NOW - 90 * 60 * 1000,
}

/** Another kitchen's fresh draft, which this one's screens must leave alone. */
export const DRAFT_OTHER_PRO: CartDraft = {
  ...DRAFT_ONE_LINE,
  proId: 1999,
  proName: "Somebody Else's Kitchen",
}
