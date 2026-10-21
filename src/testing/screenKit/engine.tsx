/**
 * Jest only. The screen kit's renderer, loaded once per platform registry by
 * index.ts (never import it directly: it must load after the platform is
 * decided). Everything it imports, the screen and the app's modules come
 * from that registry, so they all see one Platform, one React and one store.
 */
import path from "path"
import React, { act } from "react"
import { Image } from "react-native"
import { Provider } from "react-redux"
import moment from "moment"
import { jest } from "@jest/globals"
import type { ReactTestInstance } from "react-test-renderer"
import type { EdgeInsets } from "react-native-safe-area-context"

import {
  renderParity,
  type HostNode,
  type ParityLanguage,
} from "testing/hostTreeParity"

import {
  backendBusy,
  backendLog,
  configureBackend,
  httpLog,
  type BackendFixtures,
  type BackendRequest,
  type HttpFixtures,
  type HttpRequest,
} from "./backend"
import type { LocationAnswer } from "./nativeMocks"
import { resetRowState } from "./rowState"
import {
  withNavigation,
  type NavigationRecord,
  type ScreenRoute,
} from "./navigation"
import { bootPlatform, type KitPlatform } from "./platform"
import { applyWindow, windowOf, type ScreenWindow } from "./window"
import {
  createScreenStore,
  seedCache,
  setCurrentStore,
  type CacheSeed,
  type ScreenState,
  type ScreenStore,
} from "./store"

const SRC = path.resolve(__dirname, "../..")

/** A screen: its module path under src, or a loader run in the render's registry. */
export type ScreenSource = string | (() => unknown)

export { DEFAULT_WINDOW, type ScreenWindow } from "./window"

export type ScreenOptions = {
  lang: ParityLanguage
  platform: KitPlatform
  /** Route params and name (navigation.tsx). */
  route?: ScreenRoute
  /** The store's slices, over each slice's initial state. */
  state?: ScreenState
  /** RTK Query cache entries present before the screen opens. */
  cache?: CacheSeed[]
  /** The backend's answers by endpoint (backend.ts); unlisted ones stay loading. */
  api?: BackendFixtures
  /**
   * The answers to the app's plain fetches (HERE, the SVG art cache), by URL
   * without HERE's apiKey (backend.ts's httpKey); unlisted ones never answer.
   */
  http?: HttpFixtures
  /**
   * The device's permission answers, by react-native-permissions name
   * (`ios.permission.LOCATION_WHEN_IN_USE`...) or `notifications` (which
   * notifee and Firebase messaging read too); granted unless given.
   */
  permissions?: Partial<Record<string, PermissionAnswer>>
  /** What a location request answers (nativeMocks' LocationAnswer); default "pending". */
  location?: LocationAnswer
  /** MMKV keys present before the render (the app's memos, flags). */
  storage?: Record<string, string | number | boolean>
  /** Safe-area insets; default an iPhone 16 Pro's on iOS, a Pixel's on Android. */
  insets?: Partial<EdgeInsets>
  /**
   * The window; default an iPhone 16 Pro's (402 x 874 @3x). Part of the
   * render's registry: applied before the app loads (window.ts).
   */
  window?: Partial<ScreenWindow>
  /** The clock, frozen at this instant and moved only by the settle loop. */
  now?: Date | string | number
  /** How long the settle loop runs the clock after mounting; default 1000 ms. */
  settleMs?: number
  /**
   * `container` (default): the one route of a real stack inside a real
   * NavigationContainer. `none`: the bare component, for one that is not a
   * screen and needs no navigator.
   */
  navigation?: "container" | "none"
  /** Props for the component, beside `navigation` and `route`. */
  props?: Record<string, unknown>
}

export const DEFAULT_NOW = "2026-10-20T08:00:00.000Z"

export const DEFAULT_INSETS: Record<KitPlatform, EdgeInsets> = {
  ios: { top: 62, right: 0, bottom: 34, left: 0 },
  android: { top: 24, right: 0, bottom: 24, left: 0 },
}

let booted: KitPlatform | null = null

/**
 * React Native's image loader as a device answers it: a prefetch succeeds, a
 * size is 1440 x 1080. The preset's Image mock keeps the real statics, whose
 * native module answers nothing (a prefetch with no promise).
 */
const answerImageLoader = () => {
  const ImageStatics = Image as unknown as Record<string, unknown>
  const SIZE = { width: 1440, height: 1080 }
  ImageStatics.prefetch = () => Promise.resolve(true)
  ImageStatics.prefetchWithMetadata = () => Promise.resolve(true)
  ImageStatics.queryCache = () => Promise.resolve({})
  const getSize = (
    _uri: string,
    success?: (width: number, height: number) => void
  ) => {
    if (success) {
      success(SIZE.width, SIZE.height)
      return undefined
    }
    return Promise.resolve(SIZE)
  }
  ImageStatics.getSize = getSize
  ImageStatics.getSizeWithHeaders = (
    uri: string,
    _headers: unknown,
    success?: (width: number, height: number) => void
  ) => getSize(uri, success)
}

/** Once per registry: the platform's constants, before the screen loads. */
export const boot = (platform: KitPlatform) => {
  bootPlatform(platform)
  answerImageLoader()
  booted = platform
}

/** A react-native-permissions result (its RESULTS values). */
export type PermissionAnswer =
  | "granted"
  | "limited"
  | "denied"
  | "blocked"
  | "unavailable"

type Mocked = { mockImplementation: (fn: unknown) => void; mockClear: () => void }

/**
 * The device's permission answers for this row, through the library's own
 * jest mock (its check/request are jest.fns, granted by default) and the
 * notifee and Firebase messaging stand-ins (an AuthorizationStatus from
 * `notifications`). Every row sets all of them, so none leaks into the next.
 */
const answerPermissions = (
  answers: Partial<Record<string, PermissionAnswer>> = {}
) => {
  /* eslint-disable global-require, @typescript-eslint/no-var-requires */
  const permissions = require("react-native-permissions") as Record<
    string,
    Mocked
  >
  const of = (name: string): PermissionAnswer => answers[name] ?? "granted"
  const each = async (names: string[]) =>
    Object.fromEntries(names.map((name) => [name, of(name)]))
  const notifications = async () => ({
    status: of("notifications"),
    settings: {},
  })
  const set = (name: string, fn: unknown) => {
    permissions[name].mockClear()
    permissions[name].mockImplementation(fn)
  }
  set("check", async (name: string) => of(name))
  set("request", async (name: string) => of(name))
  set("checkMultiple", each)
  set("requestMultiple", each)
  set("checkNotifications", notifications)
  set("requestNotifications", notifications)
  const status = { granted: 1, limited: 2 }[of("notifications") as string] ?? 0
  ;(
    require("@notifee/react-native") as {
      __screenKitPermission: { status: number }
    }
  ).__screenKitPermission.status = status
  ;(
    require("@react-native-firebase/messaging") as {
      __screenKitPermission: { status: number }
    }
  ).__screenKitPermission.status = status
  /* eslint-enable global-require, @typescript-eslint/no-var-requires */
}

/** What a location request answers this row (default: nothing ever arrives). */
const answerLocation = (answer: LocationAnswer = "pending") => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const geolocation = require("@react-native-community/geolocation") as {
    __screenKitLocation: { current: LocationAnswer }
  }
  geolocation.__screenKitLocation.current = answer
}

/** The sheet stand-in's static spies, counted from this row on. */
const clearSheetSpies = () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const { TrueSheet } = require("@lodev09/react-native-true-sheet") as {
    TrueSheet: Record<string, Mocked>
  }
  ;["present", "dismiss", "dismissStack", "resize", "dismissAll"].forEach(
    (name) => TrueSheet[name].mockClear()
  )
}

/**
 * moment's global locale as the app leaves it: the device's. customerapp
 * never sets it (its BootstrapScreen doesn't, unlike proapp's), so it is what
 * shared's setupI18n gave it when locales/i18n loaded: RNLocalize's best tag
 * (the mock's en-US, as an English device). Put back after the screen's
 * modules load, because importing `moment/locale/ar` (MessageComponent does)
 * switches moment's global locale as a side effect (defineLocale), and on
 * the device that import runs only once a chat is first drawn (Metro's
 * inline requires), not when the screen's file loads.
 */
const deviceMomentLocale = () => {
  /* eslint-disable global-require, @typescript-eslint/no-var-requires */
  require("locales/i18n")
  const { deviceLocale } = require("@tappler/shared/src/i18n/setup") as {
    deviceLocale: string
  }
  /* eslint-enable global-require, @typescript-eslint/no-var-requires */
  moment.locale(deviceLocale)
}

const componentOf = (source: ScreenSource): React.ComponentType<any> => {
  const loaded =
    typeof source === "string"
      ? // eslint-disable-next-line global-require, import/no-dynamic-require, @typescript-eslint/no-var-requires
        require(path.isAbsolute(source) ? source : path.join(SRC, source))
      : source()
  if (React.isValidElement(loaded)) {
    throw new Error(
      'screenKit: the loader returned an element; pass `() => require("../MyScreen")`, not the component or <MyScreen />'
    )
  }
  const candidate =
    loaded && typeof loaded === "object" && "default" in (loaded as object)
      ? (loaded as { default: unknown }).default
      : loaded
  const isComponent =
    typeof candidate === "function" ||
    (typeof candidate === "object" &&
      candidate !== null &&
      "$$typeof" in (candidate as object))
  if (!isComponent) {
    throw new Error(
      `screenKit: ${typeof source === "string" ? source : "the loader"} has no component to render (default export)`
    )
  }
  return candidate as React.ComponentType<any>
}

// Real turns of the event loop (setImmediate is left real), so promise
// chains (a fixture's answer, RTK Query's thunks) run to the end.
const flushTurns = async (turns = 4) => {
  for (let i = 0; i < turns; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
  }
}

const STEP_MS = 50

/** Run the clock `ms` in steps, flushing promises each step; then until the backend is quiet. */
const settle = async (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await flushTurns()
      jest.advanceTimersByTime(STEP_MS)
      await flushTurns()
    })
  }
  for (let round = 0; round < 20 && backendBusy(); round += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await flushTurns()
      jest.advanceTimersByTime(STEP_MS)
      await flushTurns()
    })
  }
}

/**
 * How many real turns of the event loop a promise that session.act's
 * function returns gets to settle in, inside act. Anything a fixture
 * answers settles in one (the backend answers in a microtask); one still
 * pending after these waits on the frozen clock or on an answer that never
 * comes, and act would wait for it until jest's timeout.
 */
export const ACT_TURNS = 1000

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  (typeof value === "object" || typeof value === "function") &&
  value !== null &&
  typeof (value as { then?: unknown }).then === "function"

/** What a press was, for an error: its label, or the function's source. */
const pressName = (fn: () => unknown, what?: string) =>
  what ?? String(fn).replace(/\s+/g, " ").trim().slice(0, 240)

/**
 * Await what `fn` returned, as act always has, unless it is a promise still
 * pending after ACT_TURNS turns: then fail at once, naming the press, instead
 * of hanging the row until jest's timeout.
 */
const awaitSettled = async (
  result: unknown,
  fn: () => unknown,
  what?: string
) => {
  if (!isThenable(result)) return
  let settled = false
  const watched = Promise.resolve(result).then(
    () => {
      settled = true
    },
    () => {
      settled = true
    }
  )
  const waited = (async () => {
    for (let turn = 0; turn < ACT_TURNS && !settled; turn += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setImmediate(resolve)
      })
    }
  })()
  await Promise.race([watched, waited])
  if (!settled) {
    throw new Error(
      `screenKit: session.act's function returned a promise still pending after ${ACT_TURNS} turns of the event loop: ${pressName(fn, what)}\n` +
        "act waits for what the function returns, and a handler that waits on a request the backend leaves loading " +
        '(an endpoint with no fixture, or a mutation, whose default is "loading") never settles. Press without ' +
        "returning the handler's promise, `() => { onPress() }`: the settle after act runs what the press started."
    )
  }
  await result
}

export type ScreenSession = {
  /** The normalized host tree right now (hostTreeParity's). */
  tree: () => HostNode | null
  /** Run the clock (and flush) again, after an interaction. */
  settle: (ms?: number) => Promise<void>
  /**
   * Run `fn` inside act, then settle. A press should return nothing
   * (`() => { onPress() }`): act waits for a returned promise, and fails,
   * naming the press (`what`, else fn's source), when that promise is still
   * pending after ACT_TURNS turns (a save whose request never answers).
   */
  act: (
    fn: () => void | Promise<void>,
    settleMs?: number,
    what?: string
  ) => Promise<void>
  /** The test renderer's root, for finding and pressing. */
  root: ReactTestInstance
  store: ScreenStore
  /** Every request the screen sent, in order (backend.ts). */
  requests: () => BackendRequest[]
  /** Every plain fetch the screen made (HERE, SVG art), answered or not. */
  fetches: () => HttpRequest[]
  navigation: NavigationRecord
  /** Unmount, put the clock, the language and the platform switches back. */
  unmount: () => void
}

export const openScreen = async (
  source: ScreenSource,
  options: ScreenOptions
): Promise<ScreenSession> => {
  if (booted !== options.platform) {
    throw new Error(
      `screenKit: a ${options.platform} render in the ${booted} registry (use the kit's openScreen/renderScreen, not the engine)`
    )
  }
  const window = windowOf(options.window)
  const insets = { ...DEFAULT_INSETS[options.platform], ...options.insets }
  const now = new Date(options.now ?? DEFAULT_NOW)

  jest.useFakeTimers({
    now,
    doNotFake: ["nextTick", "setImmediate", "queueMicrotask"],
  })
  let session: ReturnType<typeof renderParity> | null = null
  const restore = () => {
    try {
      session?.unmount()
    } finally {
      setCurrentStore(null)
      jest.useRealTimers()
    }
  }
  try {
    // Module state the app kept from an earlier row is gone (rowState.ts).
    resetRowState()
    // The registry was booted with this window (index.ts); a render puts
    // it back after one that changed it.
    applyWindow(window)
    // MMKV starts empty but for the render's keys (nativeMocks.mmkv).
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    const mmkv = require("react-native-mmkv").__screenKitValues as
      | Map<string, unknown>
      | undefined
    mmkv?.clear()
    Object.entries(options.storage ?? {}).forEach(([key, value]) =>
      mmkv?.set(key, value)
    )
    configureBackend(options.api ?? {}, options.http ?? {})
    answerPermissions(options.permissions)
    answerLocation(options.location)
    clearSheetSpies()
    const state: ScreenState = {
      ...options.state,
      auth: { ...options.state?.auth, language: options.lang },
    }
    const store = createScreenStore(state)
    setCurrentStore(store)
    await seedCache(store, options.cache)

    // The registry's direction (index.ts), which is this row's: a module the
    // screen loads now that reads I18nManager.isRTL at import reads it.
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    const { I18nManager } = require("react-native") as typeof import("react-native")
    if (I18nManager.isRTL !== (options.lang === "ar")) {
      throw new Error(
        `screenKit: a ${options.lang} render in a registry loaded ${I18nManager.isRTL ? "RTL" : "LTR"} (use the kit's openScreen/renderScreen, not the engine)`
      )
    }
    const Screen = componentOf(source)
    // BootstrapScreen's language effect is i18next and RTL (hostTreeParity
    // sets both); moment stays on the device's locale, as in the app.
    deviceMomentLocale()
    const record: NavigationRecord = { actions: [] }
    const extra = options.props ?? {}
    const Content =
      (options.navigation ?? "container") === "container" ? (
        withNavigation(
          Object.keys(extra).length
            ? (screenProps: object) => <Screen {...screenProps} {...extra} />
            : Screen,
          options.route ?? {},
          record
        )
      ) : (
        <Screen {...extra} />
      )
    session = renderParity(<Provider store={store}>{Content}</Provider>, {
      language: options.lang,
      platform: options.platform,
      insets,
    })
    await settle(options.settleMs ?? 1000)
    const live = session
    return {
      tree: () => live.tree(),
      settle: (ms = 500) => settle(ms),
      act: async (fn, settleMs = 500, what) => {
        await act(async () => {
          await awaitSettled(fn(), fn, what)
        })
        await settle(settleMs)
      },
      root: live.renderer.root,
      store,
      requests: backendLog,
      fetches: httpLog,
      navigation: record,
      unmount: restore,
    }
  } catch (error) {
    restore()
    throw error
  }
}

/** Render, settle, read the host tree, unmount. */
export const renderScreen = async (
  source: ScreenSource,
  options: ScreenOptions
) => {
  const session = await openScreen(source, options)
  try {
    return session.tree()
  } finally {
    session.unmount()
  }
}
