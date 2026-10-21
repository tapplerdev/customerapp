/**
 * The parity runs' jest config: the app's own (jest.config.js) with the
 * fixture-aware transformer, SVG icons as host stubs, the platform from
 * DS_PARITY_PLATFORM (ios or android, through haste, so Platform.OS and the
 * .ios/.android files are the real ones), and the mocks every screen needs
 * (setup.js). Only *.parity.js files run here; the normal `jest` run never
 * sees them.
 */
const path = require("path")

const ROOT = path.resolve(__dirname, "..", "..", "..")
// eslint-disable-next-line import/no-dynamic-require
const base = require(path.join(ROOT, "jest.config.js"))

const platform = process.env.DS_PARITY_PLATFORM || "ios"
if (!["ios", "android"].includes(platform))
  throw new Error(`DS_PARITY_PLATFORM must be ios or android, got ${platform}`)

module.exports = {
  ...base,
  rootDir: ROOT,
  roots: [
    "<rootDir>/scripts/ds-codemod/parity",
    "<rootDir>/src",
    "<rootDir>/scripts/__fixtures__",
  ],
  testMatch: ["<rootDir>/scripts/ds-codemod/parity/**/*.parity.js"],
  haste: { defaultPlatform: platform, platforms: ["android", "ios", "native"] },
  // The app's allowlist plus the ESM packages the parity targets reach
  // (navigation, FlashList through the scroll wrappers, the gradient under
  // JobLocationMap, and customerapp's calendars, swipe gestures and
  // keyboard-aware scroll view with its iPhone X helper).
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|@reduxjs/toolkit|immer|reselect|redux|redux-thunk|@lodev09/react-native-true-sheet|@react-navigation|@shopify/flash-list|react-native-linear-gradient|react-native-calendars|react-native-swipe-gestures|react-native-keyboard-aware-scroll-view|react-native-iphone-x-helper)/)",
  ],
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$":
      "<rootDir>/scripts/ds-codemod/parity/transformer.js",
    "^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|webp)$": require.resolve(
      "@react-native/jest-preset/jest/assetFileTransformer.js"
    ),
  },
  moduleNameMapper: {
    "\\.svg$": "<rootDir>/scripts/ds-codemod/parity/svgStub.js",
  },
  setupFilesAfterEnv: [
    ...(base.setupFilesAfterEnv || []),
    "<rootDir>/scripts/ds-codemod/parity/setup.js",
  ],
}
