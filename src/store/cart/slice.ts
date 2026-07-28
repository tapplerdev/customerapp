import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { CartItemType } from "types/food"
import { AddressInfo } from "navigation/types"

// One DRAFT PER PRO (Deliveroo model): browsing another kitchen never destroys
// the basket you were building at the first one. Drafts are persisted
// (whitelisted in store/index.ts → MMKV) and expire individually after
// CART_STALE_MS via a lazy sweep — MMKV has no TTL of its own.
export interface CartDraft {
  proId: number
  serviceCategoryId: number
  serviceId: number
  proName: string
  categoryName: string
  items: CartItemType[]
  orderNotes: string
  // Chosen at the listing (Delivery/Pickup toggle) — steers checkout
  fulfillmentMode: "delivery" | "pickup"
  // ms epoch of the last activity on THIS draft — drives per-draft expiry
  lastUpdatedAt: number
}

export interface CartState {
  carts: Record<number, CartDraft>
  // ONE address for the whole food flow, not a copy per draft. Baskets are
  // per-pro because you can shop two kitchens at once; the address you are
  // ordering to is a property of the session, not of the kitchen. Copies on
  // each draft only refreshed inside addCartItem, so changing the address
  // anywhere else — the listing, the checkout sheet — left every existing
  // basket pointing at the address the customer had already abandoned.
  address: AddressInfo | null
}

const initialState: CartState = { carts: {}, address: null }

// Everything needed to open a draft for a pro the first time an item is added.
// Deliberately NO address: it lives on the slice, written by whoever actually
// changes it. Carrying it here meant a menu screen opened before the customer
// changed their address could hand back the old one on the next add.
export interface CartContext {
  proId: number
  serviceCategoryId: number
  serviceId: number
  proName: string
  categoryName: string
  fulfillmentMode: "delivery" | "pickup"
}

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addCartItem: (
      state,
      action: PayloadAction<{ context: CartContext; item: CartItemType }>
    ) => {
      const { context, item } = action.payload
      const draft = state.carts[context.proId]

      if (!draft) {
        state.carts[context.proId] = {
          ...context,
          items: [item],
          orderNotes: "",
          lastUpdatedAt: Date.now(),
        }
        return
      }

      // Refresh the browsing context (pro/category naming may have changed)
      draft.serviceCategoryId = context.serviceCategoryId
      draft.serviceId = context.serviceId
      draft.proName = context.proName
      draft.categoryName = context.categoryName
      draft.fulfillmentMode = context.fulfillmentMode

      const existing = draft.items.find((line) => line.uid === item.uid)
      if (existing) {
        existing.quantity += item.quantity
      } else {
        draft.items.push(item)
      }
      draft.lastUpdatedAt = Date.now()
    },

    setCartItemQuantity: (
      state,
      action: PayloadAction<{ proId: number; uid: string; quantity: number }>
    ) => {
      const { proId, uid, quantity } = action.payload
      const draft = state.carts[proId]
      if (!draft) return

      const line = draft.items.find((l) => l.uid === uid)
      if (!line) return

      if (quantity <= 0) {
        draft.items = draft.items.filter((l) => l.uid !== uid)
      } else {
        line.quantity = quantity
      }

      // Emptied → drop the draft entirely (no zombie pro identity left behind)
      if (!draft.items.length) {
        delete state.carts[proId]
        return
      }
      draft.lastUpdatedAt = Date.now()
    },

    removeCartItem: (
      state,
      action: PayloadAction<{ proId: number; uid: string }>
    ) => {
      const { proId, uid } = action.payload
      const draft = state.carts[proId]
      if (!draft) return

      draft.items = draft.items.filter((l) => l.uid !== uid)
      if (!draft.items.length) {
        delete state.carts[proId]
        return
      }
      draft.lastUpdatedAt = Date.now()
    },

    // Every screen that can change where the order is going dispatches this:
    // the pros listing, the checkout sheet, the address pickers. One write,
    // and every screen in the flow reads the same value back.
    setBrowsingAddress: (state, action: PayloadAction<AddressInfo>) => {
      state.address = action.payload
    },

    setOrderNotes: (
      state,
      action: PayloadAction<{ proId: number; notes: string }>
    ) => {
      const draft = state.carts[action.payload.proId]
      if (!draft) return
      draft.orderNotes = action.payload.notes
      draft.lastUpdatedAt = Date.now()
    },

    // After a successful order (or an explicit discard) — drops ONLY that pro's
    // draft; other baskets survive.
    clearCart: (state, action: PayloadAction<number>) => {
      delete state.carts[action.payload]
    },

    // Lazy TTL: called on app launch and on menu entry. Drops every draft that
    // hasn't been touched within CART_STALE_MS.
    sweepStaleCarts: (state, action: PayloadAction<number>) => {
      const now = action.payload
      for (const key of Object.keys(state.carts)) {
        const draft = state.carts[Number(key)]
        if (!draft || now - draft.lastUpdatedAt > CART_STALE_MS) {
          delete state.carts[Number(key)]
        }
      }
    },
  },
})

export const {
  addCartItem,
  setCartItemQuantity,
  removeCartItem,
  setBrowsingAddress,
  setOrderNotes,
  clearCart,
  sweepStaleCarts,
} = cartSlice.actions

// One formatter for every amount in the food flow. Whole values print bare
// ("185 EGP"), which is what the design shows and what each screen previously
// re-implemented on its own. A genuinely fractional amount still shows its
// decimals — rounding those away would misstate a price, and the order
// discount (round(subtotal * rate) / 100) can legitimately land on one.
export const formatMoney = (value: number): string =>
  value % 1 === 0 ? String(value) : value.toFixed(2)

// A discount exists only when discountPrice is above zero. 0 is this system's
// "no discount" sentinel, not a giveaway: proapp submits Number("") → 0 for a
// blank discount field and reads it back as blank, the backend DTO makes
// discountPrice required on option choices, and in the live menu 212 of 449
// items sit at exactly 0 while NOT ONE is null. Treating 0 as a real price
// would zero out half the menu.
export const hasDiscount = (row: {
  discountPrice?: string | number | null
}): boolean => Number(row.discountPrice) > 0

// What the customer actually pays for one unit. The strikethrough and the
// price it strikes out both go through here, so they cannot disagree about
// whether a discount exists. Kept in lockstep with the server's effectivePrice
// in food-order-items-match-menu.decorator.ts — if these two ever diverge the
// menu-match validator rejects the whole order with a 400.
export const effectiveUnitPrice = (row: {
  price?: string | number | null
  discountPrice?: string | number | null
}): number => {
  if (hasDiscount(row)) return Number(row.discountPrice)
  const base = Number(row.price)
  return Number.isFinite(base) ? base : 0
}

// Per-line total = (base + choices) × qty; subtotal drives the fee/discount
// preview — the backend recomputes and persists its own numbers at creation.
export const cartLineTotal = (line: CartItemType): number => {
  const choicesTotal = (line.selectedOptions ?? []).reduce(
    (sum, option) =>
      sum + option.choices.reduce((s, choice) => s + (choice.price || 0), 0),
    0
  )
  return (line.price + choicesTotal) * line.quantity
}

export const cartSubtotal = (items: CartItemType[]): number =>
  items.reduce((sum, line) => sum + cartLineTotal(line), 0)

export const cartCount = (items: CartItemType[]): number =>
  items.reduce((sum, line) => sum + line.quantity, 0)

// A draft untouched for this long is treated as abandoned.
export const CART_STALE_MS = 60 * 60 * 1000 // 1 hour

export const isDraftStale = (draft: CartDraft, now: number): boolean =>
  now - draft.lastUpdatedAt > CART_STALE_MS

// Live (non-expired) drafts. Screens read through these so an expired draft is
// never rendered, even if the sweep dispatch lands a frame later.
export const selectDraft = (
  state: CartState,
  proId: number | undefined,
  now: number
): CartDraft | undefined => {
  if (!proId) return undefined
  const draft = state.carts[proId]
  return draft && !isDraftStale(draft, now) ? draft : undefined
}

// Placeholder so cart/checkout can render their empty states without
// null-checking every field (items: [] drives the empty UI).
export const emptyDraft = (proId: number): CartDraft => ({
  proId,
  serviceCategoryId: 0,
  serviceId: 0,
  proName: "",
  categoryName: "",
  items: [],
  orderNotes: "",
  fulfillmentMode: "delivery",
  lastUpdatedAt: 0,
})

export const selectOtherDrafts = (
  state: CartState,
  proId: number | undefined,
  now: number
): CartDraft[] =>
  Object.values(state.carts).filter(
    (draft) => draft.proId !== proId && !isDraftStale(draft, now)
  )

export default cartSlice.reducer

// One source of truth for order money. Checkout and Review must never compute
// this separately — a customer approving one total and being charged another
// is the worst possible divergence, and it would be invisible in review.
// Mirrors the server's math in job.service.createJob.
export const computeOrderTotals = (
  items: CartItemType[],
  menu:
    | {
        deliveryCharge?: number | null
        freeDeliveryThreshold?: number | null
        totalOrderValueDiscountRate?: number | null
        totalOrderValueDiscountThreshold?: number | null
      }
    | undefined,
  isPickup: boolean
) => {
  const subtotal = cartSubtotal(items)

  const deliveryFee =
    isPickup || !menu
      ? 0
      : menu.freeDeliveryThreshold != null &&
          subtotal >= menu.freeDeliveryThreshold
        ? 0
        : (menu.deliveryCharge ?? 0)

  const orderDiscount =
    !menu ||
    menu.totalOrderValueDiscountRate == null ||
    menu.totalOrderValueDiscountThreshold == null ||
    subtotal < menu.totalOrderValueDiscountThreshold
      ? 0
      : Math.round(subtotal * menu.totalOrderValueDiscountRate) / 100

  return {
    subtotal,
    deliveryFee,
    orderDiscount,
    total: subtotal + deliveryFee - orderDiscount,
  }
}
