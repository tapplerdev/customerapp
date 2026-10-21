/**
 * Jest only. The screen kit's store: a real Redux store from the app's own
 * slices and RTK Query api, the app's middleware, preloaded with a render's
 * state, made fresh for every render (so nothing one render cached or
 * subscribed reaches the next).
 *
 * src/store/index.ts builds its store at import and wraps the reducers in
 * redux-persist; under the parity config `store` is storeModule.ts instead,
 * whose `store` is the render's store from here. The reducer list is the
 * one place this restates index.ts, so a test (screenKit.test) reads the
 * keys of index.ts's combineReducers and fails if the two ever differ.
 */
import { combineReducers, configureStore } from "@reduxjs/toolkit"

import authReducer, { type AuthState } from "store/auth/slice"
import serviceReducer, { type ServiceState } from "store/service/slice"
import serviceMutationsReducer from "store/serviceMutations/slice"
import settingReducer, { type GeneralSettingState } from "store/setting/slice"
import appStateMiddleware from "store/appStateMiddleware"
import { api } from "services/api"

/** The root reducer's keys, as src/store/index.ts combines them. */
export const REDUCER_KEYS = [
  "auth",
  "service",
  "serviceMutations",
  "setting",
  "api",
] as const

const rootReducer = combineReducers({
  auth: authReducer,
  service: serviceReducer,
  serviceMutations: serviceMutationsReducer,
  setting: settingReducer,
  [api.reducerPath]: api.reducer,
})

export type ScreenRootState = ReturnType<typeof rootReducer>

/** A render's state: each slice's fields over its initial state. */
export type ScreenState = {
  auth?: Partial<AuthState>
  service?: Partial<ServiceState>
  setting?: Partial<GeneralSettingState>
  serviceMutations?: Partial<ScreenRootState["serviceMutations"]>
}

/**
 * RTK Query cache entries to start with, as if fetched before the screen
 * opened (a detail screen opened from its list). A hook that refetches on
 * mount still asks the backend.
 */
export type CacheSeed = {
  endpoint: string
  args?: unknown
  data: unknown
}

const initial = () =>
  rootReducer(undefined, { type: "@@screenKit/init" }) as ScreenRootState

export const createScreenStore = (
  state: ScreenState = {},
  cache: CacheSeed[] = []
) => {
  const base = initial()
  const preloadedState = {
    ...base,
    auth: { ...base.auth, ...state.auth },
    service: { ...base.service, ...state.service },
    setting: { ...base.setting, ...state.setting },
    serviceMutations: { ...base.serviceMutations, ...state.serviceMutations },
  } as ScreenRootState
  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // The app's store checks serializability only for persist's actions;
        // fixtures are plain data, so neither check adds anything here.
        serializableCheck: false,
        immutableCheck: false,
      }).concat(api.middleware, appStateMiddleware),
  })
  if (cache.length) {
    store.dispatch(
      api.util.upsertQueryEntries(
        cache.map(({ endpoint, args, data }) => ({
          endpointName: endpoint,
          arg: args,
          value: data,
        })) as never
      )
    )
  }
  return store
}

export type ScreenStore = ReturnType<typeof createScreenStore>

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
 * redux-persist's persistor, which the app flushes before a restart: here
 * there is nothing to persist, and every call settles at once.
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
