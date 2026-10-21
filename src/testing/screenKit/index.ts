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
 * loader). Rows of one platform and one window share a registry; switching
 * either resets it (rowsByPlatform orders a table so that happens once per
 * platform). A row's `window` is applied before anything loads too, so a
 * module that reads Dimensions as it loads (shared's isSmallPhone) reads the
 * row's; a row without one loads as it always has (LOADED_AS_BEFORE).
 *
 * What a render sets up (engine.tsx): the language (i18next, RTL, the ds
 * provider, moment's locale, the store's auth.language), the platform, the
 * Latin faces index.js registers, safe-area insets, the window, a frozen
 * clock, a fresh store from the app's reducers with the render's state
 * (store.ts), the backend's answers by endpoint (backend.ts), MMKV's keys,
 * and a real NavigationContainer around the screen (navigation.tsx). Then it
 * runs the clock for `settleMs` so effects, timers and answers land.
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
  copy,
  enterCode,
  fields,
  only,
  pressText,
  pressTitled,
  typeInto,
  wait,
  type PressOptions,
  type PressTextOptions,
  type Step,
} from "./interact"

export type { KitPlatform } from "./platform"
export type { ScreenSource, ScreenSession } from "./engine"
export { DEFAULT_WINDOW, type ScreenWindow } from "./window"
export type {
  BackendFixtures,
  BackendRequest,
  EndpointAnswer,
  EndpointFixture,
} from "./backend"
export type { CacheSeed, ScreenState } from "./store"
export type { NavigationRecord, ScreenRoute } from "./navigation"
export { networkAttempts } from "./backend"

export type RenderScreenOptions = Omit<
  Engine.ScreenOptions,
  "lang" | "platform"
> & {
  /** Default `en`. */
  lang?: ParityLanguage
  /** Default `ios`. */
  platform?: KitPlatform
}

let loaded: {
  platform: KitPlatform
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

/**
 * The engine in the registry of the platform and the window: the current
 * one, or a fresh one. A row that gives `window` gets it applied before
 * anything loads, so a module that reads Dimensions as it loads (shared's
 * isSmallPhone, SCREEN_WIDTH) reads the row's; one that doesn't loads
 * LOADED_AS_BEFORE.
 */
const engineFor = (
  platform: KitPlatform,
  window: Partial<ScreenWindow> | undefined
): typeof Engine => {
  const key = window ? windowKey(windowOf(window)) : LOADED_AS_BEFORE
  if (loaded && loaded.platform === platform && loaded.window === key) {
    return loaded.engine
  }
  jest.resetModules()
  preparePlatform(platform)
  if (window) applyWindow(windowOf(window))
  const engine = require("./engine") as typeof Engine
  engine.boot(platform)
  loaded = { platform, window: key, engine }
  return engine
}

const withDefaults = (options: RenderScreenOptions): Engine.ScreenOptions => ({
  ...options,
  lang: options.lang ?? "en",
  platform: options.platform ?? "ios",
})

const engineOf = (options: Engine.ScreenOptions) =>
  engineFor(options.platform, options.window)

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
 * A table of rows ordered platform by platform (all iOS rows, then all
 * Android), so a file switches registries once. Each row carries its env.
 */
export const rowsByPlatform = <T extends object>(
  cases: readonly T[],
  matrix: readonly ParityEnv[]
): (T & { env: ParityEnv })[] => {
  const rows = cases.flatMap((entry) =>
    matrix.map((env) => ({ ...entry, env }))
  )
  const order = (env: ParityEnv) => ((env.platform ?? "ios") === "ios" ? 0 : 1)
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => order(a.row.env) - order(b.row.env) || a.index - b.index)
    .map(({ row }) => row)
}

/** Which platform's registry is loaded (for the kit's own tests). */
export const loadedPlatform = () => loaded?.platform ?? null

/**
 * Which window the loaded registry was booted with (for the kit's own
 * tests): a window's key, or LOADED_AS_BEFORE.
 */
export const loadedWindow = () => loaded?.window ?? null
