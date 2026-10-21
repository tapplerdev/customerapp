/**
 * Jest only. The screen kit's store: a real Redux store from the app's own
 * slices and RTK Query api, the app's middleware, preloaded with a render's
 * state, made fresh for every render (so nothing one render cached or
 * subscribed reaches the next).
 *
 * src/store/index.ts builds its store at import and wraps the reducers in
 * redux-persist (MMKV); under the parity config `store` is storeModule.ts
 * instead, whose `store` is the render's store from here and whose persistor
 * persists nothing. The reducer list and the middleware are the two places
 * this restates index.ts, so a test (screenKit.parity.tsx) reads index.ts's
 * combineReducers keys and its createAppStateMiddleware tags and fails if
 * they ever differ.
 */
import { combineReducers, configureStore } from "@reduxjs/toolkit"

import authReducer, { type AuthState } from "store/auth/slice"
import cartReducer, { type CartState } from "store/cart/slice"
import { api } from "services/api"
import { createAppStateMiddleware } from "@tappler/shared/src/store/appStateMiddleware"

/** The root reducer's keys, as src/store/index.ts combines them. */
export const REDUCER_KEYS = ["auth", "cart", "api"] as const

/** The tags index.ts's app-state middleware refetches on foregrounding. */
export const APP_STATE_TAGS = ["Auth"] as const

const rootReducer = combineReducers({
  auth: authReducer,
  cart: cartReducer,
  [api.reducerPath]: api.reducer,
})

export type ScreenRootState = ReturnType<typeof rootReducer>

/** A render's state: each slice's fields over its initial state. */
export type ScreenState = {
  auth?: Partial<AuthState>
  cart?: Partial<CartState>
}

/**
 * RTK Query cache entries to start with, as if fetched before the screen
 * opened (a detail screen opened from its list, a prefetch-before-navigate).
 * A hook that refetches on mount still asks the backend.
 */
export type CacheSeed = {
  endpoint: string
  args?: unknown
  data: unknown
}

const initial = () =>
  rootReducer(undefined, { type: "@@screenKit/init" }) as ScreenRootState

export const createScreenStore = (state: ScreenState = {}) => {
  const base = initial()
  const preloadedState = {
    ...base,
    auth: { ...base.auth, ...state.auth },
    cart: { ...base.cart, ...state.cart },
  } as ScreenRootState
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // The app's store checks serializability only for persist's actions;
        // fixtures are plain data, so neither check adds anything here.
        serializableCheck: false,
        immutableCheck: false,
      }).concat(
        api.middleware,
        createAppStateMiddleware(api, [...APP_STATE_TAGS])
      ),
  })
}

export type ScreenStore = ReturnType<typeof createScreenStore>

/**
 * Write the seeds into the store's cache and wait until they are there.
 * RTK 2.2.1 has no upsertQueryEntries (proapp's 2.12 does): each entry is an
 * upsertQueryData, which lands through its own thunk.
 */
export const seedCache = async (store: ScreenStore, cache: CacheSeed[] = []) => {
  await Promise.all(
    cache.map(({ endpoint, args, data }) =>
      store.dispatch(
        api.util.upsertQueryData(endpoint as never, args as never, data as never)
      )
    )
  )
}

let current: ScreenStore | null = null

/** The store `store` stands for right now (a fresh one if no render set it). */
export const currentStore = () => {
  if (!current) current = createScreenStore()
  return current
}

/** Make `store` stand for this store until the next render (the kit calls it). */
export const setCurrentStore = (store: ScreenStore | null) => {
  current = store
}

/**
 * redux-persist's persistor, which the app flushes before a restart and
 * PersistGate waits on: here there is nothing to persist, it is bootstrapped
 * from the start, and every call settles at once.
 */
export const persistor = {
  flush: () => Promise.resolve(),
  purge: () => Promise.resolve(),
  pause: () => undefined,
  persist: () => undefined,
  getState: () => ({ registry: [], bootstrapped: true }),
  subscribe: () => () => undefined,
  dispatch: (action: unknown) => action,
}
