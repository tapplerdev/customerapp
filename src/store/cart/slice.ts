import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { CartItemType } from "types/food"
import { AddressInfo } from "navigation/types"

// One food cart at a time, tied to a single pro (one menu, one kitchen).
// Persisted (whitelisted in store/index.ts) so a half-built order survives
// app kills — mirroring every delivery app's behavior.
export interface CartState {
  proId: number | null
  serviceCategoryId: number | null
  serviceId: number | null
  proName: string | null
  categoryName: string | null
  // The address the customer browsed with — checkout starts from it
  address: AddressInfo | null
  items: CartItemType[]
  orderNotes: string
}

const initialState: CartState = {
  proId: null,
  serviceCategoryId: null,
  serviceId: null,
  proName: null,
  categoryName: null,
  address: null,
  items: [],
  orderNotes: "",
}

export interface CartContext {
  proId: number
  serviceCategoryId: number
  serviceId: number
  proName: string
  categoryName: string
  address: AddressInfo | null
}

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    // Adding from a different pro must go through clearCart first — the
    // screens confirm the reset with the customer before dispatching.
    addCartItem: (
      state,
      action: PayloadAction<{ context: CartContext; item: CartItemType }>
    ) => {
      const { context, item } = action.payload
      if (state.proId !== context.proId) {
        state.items = []
      }
      state.proId = context.proId
      state.serviceCategoryId = context.serviceCategoryId
      state.serviceId = context.serviceId
      state.proName = context.proName
      state.categoryName = context.categoryName
      state.address = context.address

      const existing = state.items.find((line) => line.uid === item.uid)
      if (existing) {
        existing.quantity += item.quantity
      } else {
        state.items.push(item)
      }
    },
    setCartItemQuantity: (
      state,
      action: PayloadAction<{ uid: string; quantity: number }>
    ) => {
      const line = state.items.find((l) => l.uid === action.payload.uid)
      if (!line) return
      if (action.payload.quantity <= 0) {
        state.items = state.items.filter((l) => l.uid !== action.payload.uid)
      } else {
        line.quantity = action.payload.quantity
      }
    },
    removeCartItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((l) => l.uid !== action.payload)
    },
    setCartAddress: (state, action: PayloadAction<AddressInfo>) => {
      state.address = action.payload
    },
    setOrderNotes: (state, action: PayloadAction<string>) => {
      state.orderNotes = action.payload
    },
    clearCart: () => initialState,
  },
})

export const {
  addCartItem,
  setCartItemQuantity,
  removeCartItem,
  setCartAddress,
  setOrderNotes,
  clearCart,
} = cartSlice.actions

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

export default cartSlice.reducer
