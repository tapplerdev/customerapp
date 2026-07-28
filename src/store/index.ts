import { TypedUseSelectorHook, useSelector } from "react-redux"
import { configureStore } from "@reduxjs/toolkit"
import authReducer from "./auth/slice"
import cartReducer from "./cart/slice"
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist"
import { combineReducers } from "redux"
import { api } from "services/api"
import { createAppStateMiddleware } from "@tappler/shared/src/store/appStateMiddleware"
import { reduxMmkvStorage } from "@tappler/shared/src/store/mmkv"

const persistConfig = {
  key: "tappler_customer_app-root-storage",
  storage: reduxMmkvStorage,
  // cart: half-built food orders survive app kills (delivery-app norm)
  whitelist: ["auth", "cart"],
  // v1: cart went from a single cart object to per-pro drafts
  // ({ carts: Record<proId, CartDraft> }). The old shape can't be mapped
  // safely (no per-draft timestamp), so drop any in-flight cart once.
  // v2: the delivery address moved off each draft onto the slice — one
  // address for the whole food flow. Lift it from any surviving draft so a
  // persisted basket doesn't come back asking for an address it already had.
  version: 2,
  migrate: async (state: any) => {
    if (state?.cart && !state.cart.carts) {
      return { ...state, cart: { carts: {}, address: null } }
    }
    if (state?.cart && state.cart.address === undefined) {
      const drafts: any[] = Object.values(state.cart.carts ?? {})
      const newest = drafts
        .filter((draft) => draft?.address)
        .sort((a, b) => (b?.lastUpdatedAt ?? 0) - (a?.lastUpdatedAt ?? 0))[0]
      const carts = Object.fromEntries(
        drafts.map(({ address, ...draft }: any) => [draft.proId, draft])
      )
      return {
        ...state,
        cart: { carts, address: newest?.address ?? null },
      }
    }
    return state
  },
}

const reducers = combineReducers({
  auth: authReducer,
  cart: cartReducer,
  [api.reducerPath]: api.reducer,
})

const persistedReducer = persistReducer(persistConfig, reducers)

const appStateMiddleware = createAppStateMiddleware(api as any, ["Auth"])

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(api.middleware, appStateMiddleware),
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector
