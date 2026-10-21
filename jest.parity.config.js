/*
 * `yarn test:parity` (jest -c jest.parity.config.js): the screen kit's runs,
 * every `*.parity.tsx` under src (and the App smoke test in __tests__). The
 * default config never picks them up.
 *
 * The app's config, plus what rendering a whole screen needs
 * (src/testing/screenKit, README in src/testing):
 * - the transform allowlist grown by the ESM packages a screen reaches
 *   (react-redux, React Navigation, rn-tourguide, react-native-calendars, the
 *   keyboard-aware scroll view, the svg-drawn libraries...)
 * - an SVG icon module as a host element named after its file
 *   (`svg:close`), carrying its props
 * - the kit's setup after the app's jest.setup.js: native modules and views
 *   mocked, the network shut, the store and the backend the kit's, the app's
 *   module state fresh per row
 * - the time zone, Egypt's
 */
const fs = require("fs")
const path = require("path")
const base = require("./jest.config")

// With a symlinked ../tappler-shared, jest drew shared's components WITHOUT
// their NativeWind styles, so parity passed for the wrong reason (a trap
// proapp hit: STATE "Traps", W2-CARD); tailwind.config.js's `content` reads
// ../tappler-shared/src too. Refuse anything but a real sibling.
const shared = path.join(__dirname, "..", "tappler-shared")
if (!fs.existsSync(shared) || fs.lstatSync(shared).isSymbolicLink()) {
  throw new Error(
    `jest.parity.config.js: ${shared} must be a real sibling worktree, not ${
      fs.existsSync(shared) ? "a symlink" : "missing"
    } (NativeWind compiles shared's classes from it)`
  )
}

// Every date a screen formats comes out as it does in Egypt, on any machine
// (the workers inherit it). The kit's clock is frozen too (engine.tsx).
process.env.TZ = "Africa/Cairo"

const ESM_PACKAGES = [
  "(jest-)?react-native",
  "@react-native(-community)?",
  "@reduxjs/toolkit",
  "immer",
  "reselect",
  "redux",
  "redux-thunk",
  "redux-persist",
  "react-redux",
  "@lodev09/react-native-true-sheet",
  "@react-navigation",
  "rn-tourguide",
  "react-native-svg",
  "react-native-autolink",
  "autolinker",
  "react-native-safe-area-context",
  "react-native-screens",
  "react-native-gesture-handler",
  "react-native-calendars",
  "react-native-swipe-gestures",
  "react-native-keyboard-aware-scroll-view",
  "react-native-iphone-x-helper",
]

module.exports = {
  ...base,
  displayName: "parity",
  // A file's first render in each platform's registry loads the app into it,
  // and on a cold transform cache that alone is slow (proapp's HomeScreen took
  // 39 s, most screens 5 to 9 s). Under jest's default 5 s such a row failed,
  // and the rows after it with it. 120 s is three times the slowest seen; a
  // row that hangs on a press's promise fails at once anyway (session.act).
  testTimeout: 120000,
  testMatch: [
    "<rootDir>/src/**/*.parity.tsx",
    "<rootDir>/__tests__/**/*.parity.tsx",
  ],
  testPathIgnorePatterns: ["/node_modules/"],
  transformIgnorePatterns: [`node_modules/(?!(${ESM_PACKAGES.join("|")})/)`],
  transform: {
    "^.+\\.(js|ts|tsx)$": "babel-jest",
    "^.+\\.svg$": "<rootDir>/src/testing/screenKit/svgTransformer.js",
    "^.+\\.(bmp|gif|jpg|jpeg|mp4|png|psd|webp)$": require.resolve(
      "@react-native/jest-preset/jest/assetFileTransformer.js"
    ),
  },
  setupFilesAfterEnv: [
    ...base.setupFilesAfterEnv,
    "<rootDir>/src/testing/screenKit/setup.ts",
  ],
}
