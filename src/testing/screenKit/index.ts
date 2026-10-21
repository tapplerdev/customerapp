/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the engine is loaded into each platform's module registry on demand. */
/**
 * Jest only, and only under jest.parity.config.js (`*.parity.tsx` files).
 * The screen kit: render a screen the way the app renders it, with mocked
 * data and native modules, real everything else, and read its host tree.
 *
 *   const tree = await renderScreen(() => require("../MyScreen"), {
 *     lang: "ar", platform: "android", api: DATA, route: { params: {...} },
 *   })
 *   expectParity(parityName("data", env), tree)
 *
 * Each platform's renders load in a module registry of their own, decided
 * before anything loads (platform.ts), so a module that reads Platform.OS at
 * import gets the row's platform. That is why the screen is passed as a
 * loader (or a path under src): it has to load in that registry, and so does
 * anything in the test that calls hooks (put a harness component inside the
 * loader). The layout direction is part of the registry too, as it is of an
 * app session (the language switch restarts the app): an Arabic row's modules
 * load with I18nManager.isRTL already true, so one that reads it at import
 * (FoodCheckoutScreen/styles.ts:15) draws its Arabic branch, which proapp's
 * kit never could. Rows of one platform, one direction and one window share
 * a registry; switching any resets it (rowsByPlatform orders a table so that
 * happens once per platform and direction). A row's `window` is applied
 * before anything loads too, so a module that reads Dimensions as it loads
 * (shared's isSmallPhone) reads the row's; a row without one loads as it
 * always has (LOADED_AS_BEFORE).
 *
 * What a render sets up (engine.tsx): the app's module state fresh
 * (rowState.ts), the language (i18next, RTL, the ds provider, the store's
 * auth.language; moment stays on the device's locale, as in the app), the
 * platform, the Latin faces customerapp draws (Montserrat), safe-area insets,
 * the window, a frozen clock, a fresh store from the app's reducers with the
 * render's state and cache (store.ts), the backend's answers by endpoint and
 * the plain fetches' by URL (backend.ts), the device's permission and
 * location answers, MMKV's keys, and a real NavigationContainer around the
 * screen (navigation.tsx). Then it runs the clock for `settleMs` so effects,
 * timers and answers land.
 */
import { jest } from "@jest/globals"

import type {
  HostNode,
  ParityEnv,
  ParityLanguage,
} from "testing/hostTreeParity"

import type * as Engine from "./engine"
import type { Step } from "./interact"
import { preparePlatform, type KitPlatform } from "./platform"
import {
  applyWindow,
  windowKey,
  windowOf,
  type ScreenWindow,
} from "./window"

export {
  BOTTOM_GAP_INSETS,
  closeSheetAsUser,
  copy,
  fields,
  fireHost,
  only,
  presentedSheets,
  pressIcon,
  pressText,
  pressTitled,
  typeInto,
  wait,
  type CloseSheetOptions,
  type FireOptions,
  type PressIconOptions,
  type PressOptions,
  type PressTextOptions,
  type Step,
} from "./interact"

export type { KitPlatform } from "./platform"
export type { PermissionAnswer, ScreenSource, ScreenSession } from "./engine"
export type { LocationAnswer } from "./nativeMocks"
export { PER_ROW } from "./rowState"
export { DEFAULT_WINDOW, type ScreenWindow } from "./window"
export type {
  BackendFixtures,
  BackendRequest,
  EndpointAnswer,
  EndpointFixture,
  HttpAnswer,
  HttpFixtures,
  HttpRequest,
} from "./backend"
export type { CacheSeed, ScreenState } from "./store"
export type { NavigationRecord, ScreenRoute } from "./navigation"
export {
  AUTH_REFRESH,
  REFRESH_TIMED_OUT,
  httpKey,
  networkAttempts,
} from "./backend"

export type RenderScreenOptions = Omit<
  Engine.ScreenOptions,
  "lang" | "platform"
> & {
  /** Default `en`. */
  lang?: ParityLanguage
  /** Default `ios`. */
  platform?: KitPlatform
}

/** The layout direction a registry's modules load under. */
export type KitDirection = "ltr" | "rtl"

let loaded: {
  platform: KitPlatform
  direction: KitDirection
  window: string
  engine: typeof Engine
} | null = null

/**
 * The registry a row without a `window` loads in: as it always has, with
 * the window jest starts Dimensions on (750 x 1334) while the app loads, and
 * the default window (402 x 874) set at render. The fixtures captured so far
 * hold what that draws: VerifyCodeInput's boxes are sized from shared's
 * SCREEN_WIDTH at load, so they come out 143.75 wide, not 56.75.
 */
export const LOADED_AS_BEFORE = "as before"

/** I18nManager's direction in the current registry, before the app loads. */
const applyDirection = (direction: KitDirection) => {
  const { I18nManager } = require("react-native") as typeof import("react-native")
  const isRTL = direction === "rtl"
  ;(I18nManager as { isRTL: boolean }).isRTL = isRTL
  // getConstants() hands back one shared object; keep it in step.
  ;(I18nManager.getConstants() as { isRTL: boolean }).isRTL = isRTL
}

/**
 * The engine in the registry of the platform, the direction and the window:
 * the current one, or a fresh one. The direction is applied before anything
 * loads, so a module that reads I18nManager.isRTL as it loads reads the
 * row's. A row that gives `window` gets it applied before anything loads, so
 * a module that reads Dimensions as it loads (shared's isSmallPhone,
 * SCREEN_WIDTH) reads the row's; one that doesn't loads LOADED_AS_BEFORE.
 */
const engineFor = (
  platform: KitPlatform,
  direction: KitDirection,
  window: Partial<ScreenWindow> | undefined
): typeof Engine => {
  const key = window ? windowKey(windowOf(window)) : LOADED_AS_BEFORE
  if (
    loaded &&
    loaded.platform === platform &&
    loaded.direction === direction &&
    loaded.window === key
  ) {
    return loaded.engine
  }
  jest.resetModules()
  preparePlatform(platform)
  applyDirection(direction)
  if (window) applyWindow(windowOf(window))
  const engine = require("./engine") as typeof Engine
  engine.boot(platform)
  // It stays the registry's: every row in it has this direction, the engine
  // asserts it before the screen's modules load, and hostTreeParity's render
  // sets it again and puts it back.
  loaded = { platform, direction, window: key, engine }
  return engine
}

const withDefaults = (options: RenderScreenOptions): Engine.ScreenOptions => ({
  ...options,
  lang: options.lang ?? "en",
  platform: options.platform ?? "ios",
})

const engineOf = (options: Engine.ScreenOptions) =>
  engineFor(
    options.platform,
    options.lang === "ar" ? "rtl" : "ltr",
    options.window
  )

/** Render, settle, and the normalized host tree (hostTreeParity's), unmounted. */
export const renderScreen = (
  source: Engine.ScreenSource,
  options: RenderScreenOptions = {}
): Promise<HostNode | null> => {
  const resolved = withDefaults(options)
  return engineOf(resolved).renderScreen(source, resolved)
}

/**
 * Render and settle, and keep it mounted: press, type, settle, read, unmount.
 * A press goes through `session.act(() => { onPress() })`, braces and all:
 * act waits for a returned promise, and fails when it never settles.
 */
export const openScreen = (
  source: Engine.ScreenSource,
  options: RenderScreenOptions = {}
): Promise<Engine.ScreenSession> => {
  const resolved = withDefaults(options)
  return engineOf(resolved).openScreen(source, resolved)
}

/**
 * Open the screen, take each step inside act (the kit settles after each,
 * `step.settleMs` or 500 ms), read the host tree, unmount. A step that hands
 * act a promise that never settles fails at once, named by its place in the
 * list and its source.
 */
export const treeAfter = async (
  load: Engine.ScreenSource,
  options: RenderScreenOptions,
  env: ParityEnv,
  steps: readonly Step[] = []
): Promise<HostNode | null> => {
  const session = await openScreen(load, options)
  try {
    for (const [index, step] of steps.entries()) {
      // eslint-disable-next-line no-await-in-loop
      await session.act(
        () => step(session.root, env),
        step.settleMs,
        `treeAfter's step ${index + 1} of ${steps.length}, ${String(step).replace(/\s+/g, " ").slice(0, 200)}`
      )
    }
    return session.tree()
  } finally {
    session.unmount()
  }
}

/**
 * A table of rows ordered platform by platform, and within a platform
 * English before Arabic (each its own registry), so a file switches
 * registries once per platform and direction. Each row carries its env.
 */
export const rowsByPlatform = <T extends object>(
  cases: readonly T[],
  matrix: readonly ParityEnv[]
): (T & { env: ParityEnv })[] => {
  const rows = cases.flatMap((entry) =>
    matrix.map((env) => ({ ...entry, env }))
  )
  const order = (env: ParityEnv) =>
    ((env.platform ?? "ios") === "ios" ? 0 : 2) + (env.language === "ar" ? 1 : 0)
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => order(a.row.env) - order(b.row.env) || a.index - b.index)
    .map(({ row }) => row)
}

/** Which platform's registry is loaded (for the kit's own tests). */
export const loadedPlatform = () => loaded?.platform ?? null

/** Which direction the loaded registry's modules loaded under (the kit's own tests). */
export const loadedDirection = () => loaded?.direction ?? null

/**
 * Which window the loaded registry was booted with (for the kit's own
 * tests): a window's key, or LOADED_AS_BEFORE.
 */
export const loadedWindow = () => loaded?.window ?? null
