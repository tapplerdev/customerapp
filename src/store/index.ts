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
  version: 1,
  migrate: async (state: any) => {
    if (state?.cart && !state.cart.carts) {
      return { ...state, cart: { carts: {} } }
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
