/**
 * Jest only. A render's platform, decided before any module of the render
 * loads.
 *
 * Under jest every module resolves through haste's default platform (iOS),
 * and ten app files read `Platform.OS` at import (FoodMenuSectionMenuItem,
 * PaymobCardEntrySheet, helpers/layoutAnimation, the two map pickers,
 * MessagesDetailsScreen's styles, MyServiceWorkPhotoAdjustScreen,
 * LeadDetailScreen, OpportunityDetailScreen, utils/haptics), so swapping
 * Platform.OS at render time leaves them on iOS. The kit instead loads each
 * platform's render into a module registry of its own (jest.resetModules,
 * index.ts), and before anything loads in an Android registry it points
 * every module that has an `.android` file at that file, the way Metro and
 * haste would for an Android bundle: React Native's own Platform,
 * BackHandler, PlatformColorValueTypes, ToastAndroid and the rest, and the
 * same in the libraries that ship platform files and aren't mocked. An iOS
 * registry puts them back.
 */
import fs from "fs"
import path from "path"
import { jest } from "@jest/globals"

export type KitPlatform = "ios" | "android"

const ROOT = path.resolve(__dirname, "../../..")
const NODE_MODULES = path.join(ROOT, "node_modules")

/**
 * Where to look for `.android` files: React Native's Libraries, and the
 * libraries a screen loads as they are (the ones nativeMocks.ts replaces
 * never load).
 */
const PLATFORM_DIRS = [
  "react-native/Libraries",
  "react-native-gesture-handler/lib/commonjs",
  "react-native-screens/lib/commonjs",
  "react-native-safe-area-context/lib/commonjs",
  "react-native-keyboard-controller/lib/commonjs",
]

/** Modules React Native's jest setup already replaces (its Image mock). */
const MOCKED_BY_PRESET = new Set([
  path.join(NODE_MODULES, "react-native/Libraries/Image/Image"),
])

let twins: { base: string; android: string }[] | null = null

const walk = (dir: string, out: string[]) => {
  if (!fs.existsSync(dir)) return out
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!["__tests__", "__mocks__", "__fixtures__"].includes(entry.name)) {
        walk(full, out)
      }
    } else if (/\.android\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      out.push(full)
    }
  })
  return out
}

/** Every module with an `.android` file, and that file. */
export const androidTwins = () => {
  if (!twins) {
    twins = PLATFORM_DIRS.flatMap((dir) =>
      walk(path.join(NODE_MODULES, dir), [])
    )
      .map((android) => ({
        base: android.replace(/\.android\.(js|jsx|ts|tsx)$/, ""),
        android,
      }))
      .filter(({ base }) => !MOCKED_BY_PRESET.has(base))
  }
  return twins
}

/** What a device of each platform reports as its constants (Platform.constants). */
export const PLATFORM_CONSTANTS: Record<
  KitPlatform,
  Record<string, unknown>
> = {
  ios: {
    forceTouchAvailable: false,
    interfaceIdiom: "phone",
    isTesting: true,
    isMacCatalyst: false,
    osVersion: "18.4",
    reactNativeVersion: { major: 0, minor: 86, patch: 3, prerelease: null },
    systemName: "iOS",
  },
  android: {
    isTesting: true,
    reactNativeVersion: { major: 0, minor: 86, patch: 3, prerelease: null },
    Version: 35,
    Release: "15",
    Serial: "unknown",
    Fingerprint: "parity",
    Model: "Pixel 8",
    Manufacturer: "Google",
    Brand: "google",
    uiMode: "normal",
  },
}

/**
 * Make the next module registry the platform's: on Android every twin's
 * base path loads its `.android` file; on iOS the default resolution comes
 * back. Call it right after jest.resetModules(), before anything is
 * required.
 */
export const preparePlatform = (platform: KitPlatform) => {
  androidTwins().forEach(({ base, android }) => {
    // An Android-only module with no default file (react-native-screens'
    // StackHeaderSubview) resolves nowhere under iOS haste: virtual.
    const resolvable = [".ios.js", ".native.js", ".js", ".ts", ".tsx"].some(
      (ext) => fs.existsSync(base + ext)
    )
    if (platform === "android") {
      jest.doMock(base, () => jest.requireActual(android), {
        virtual: !resolvable,
      })
    } else if (resolvable) {
      jest.dontMock(base)
    }
  })
}

/**
 * The registry's Platform, set to report the platform's device constants
 * (React Native's jest mock reports a bare version for both). Call it in
 * the new registry before the render's modules load.
 */
export const bootPlatform = (platform: KitPlatform) => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const { Platform } = require("react-native") as typeof import("react-native")
  if (Platform.OS !== platform) {
    throw new Error(
      `screenKit: the ${platform} registry loaded Platform.OS "${Platform.OS}"`
    )
  }
  ;(Platform as unknown as { __constants: unknown }).__constants = {
    ...PLATFORM_CONSTANTS[platform],
  }
  return Platform
}
