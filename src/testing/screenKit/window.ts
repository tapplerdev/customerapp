/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   react-native is required at call time, in whichever module registry is
   current (the kit applies the window in a fresh one). */
/**
 * Jest only. The window a render's Dimensions report. It is part of the
 * render's module registry (index.ts), applied before anything of the app
 * loads, because some modules read Dimensions once, when they load:
 * tappler-shared's helpers (SCREEN_WIDTH, SCREEN_HEIGHT, isSmallPhone,
 * isSmallPhoneHeight, isLittlePhone, isBigPhone) and MediaViewer's styles,
 * and customerapp's ReviewFormScreen:24, MessagesComponent:18 and its
 * styles:3, MessageComponent:32 and its styles:3, TabBar/styles:3,
 * FoodMenuItemRow/styles:4, OffersSection:21, ImageViewerModal:10. Set at
 * render time only, they would keep whatever the registry loaded with.
 */
export type ScreenWindow = {
  width: number
  height: number
  scale: number
  fontScale: number
}

/** An iPhone 16 Pro's: 402 x 874 points at 3x. */
export const DEFAULT_WINDOW: ScreenWindow = {
  width: 402,
  height: 874,
  scale: 3,
  fontScale: 1,
}

/** A row's window over the default. */
export const windowOf = (window?: Partial<ScreenWindow>): ScreenWindow => ({
  ...DEFAULT_WINDOW,
  ...window,
})

/** What tells one registry's window from another's. */
export const windowKey = (window: ScreenWindow) =>
  `${window.width}x${window.height}@${window.scale}x/${window.fontScale}`

/** Dimensions' window and screen, in the current registry. */
export const applyWindow = (window: ScreenWindow) => {
  const { Dimensions } = require("react-native") as typeof import("react-native")
  const dims = { ...window }
  Dimensions.set({ window: dims, screen: dims })
}
