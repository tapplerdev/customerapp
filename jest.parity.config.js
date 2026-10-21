/*
 * `yarn test:parity` (jest -c jest.parity.config.js): the screen kit's runs,
 * every `*.parity.tsx` under src. The default config never picks them up.
 *
 * The app's config, plus what rendering a whole screen needs
 * (src/testing/screenKit, README in src/testing):
 * - the transform allowlist grown by the ESM packages a screen reaches
 *   (react-redux, React Navigation, rn-tourguide, the svg-drawn libraries...)
 * - an SVG icon module as a host element named after its file
 *   (`svg:close`), carrying its props
 * - the kit's setup after the app's jest.setup.js: native modules and views
 *   mocked, the network shut, the store and the backend the kit's
 * - the time zone, Egypt's
 */
const base = require("./jest.config")

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
  "react-native-keyboard-controller",
  "@react-navigation",
  "rn-tourguide",
  "react-native-circular-progress",
  "react-native-dots-pagination",
  "react-native-shadow-2",
  "react-native-svg",
  "react-native-autolink",
  "autolinker",
  "@marceloterreiro/flash-calendar",
  "react-native-safe-area-context",
  "react-native-screens",
  "react-native-gesture-handler",
  "use-debounce",
]

module.exports = {
  ...base,
  displayName: "parity",
  // A file's first render in each platform's registry loads the app into it,
  // and on a cold transform cache that alone is slow: HomeScreen's took 39 s
  // (2026-10-21, load average 11 on 14 cores), most screens 5 to 9 s. Under
  // jest's default 5 s that row failed, and the rows after it with it (36 of
  // My Account's 76). 120 s is three times the slowest seen; a row that hangs
  // on a press's promise fails at once anyway (the kit's session.act).
  testTimeout: 120000,
  testMatch: ["<rootDir>/src/**/*.parity.tsx"],
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
