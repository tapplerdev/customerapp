/*
 * `yarn test:pass1-tools` (jest -c jest.pass1.config.js): every
 * `*.pass1.test.*` under src and scripts, the suites that need NativeWind.
 * `yarn test` never picks them up (jest.config.js), so it passes with the
 * plugin gone from babel.config.js (W3.2).
 * - The class-era tools: nw-resolve, nw-wrap-probe, the codemod, ds-colors,
 *   tsc-nonw. They read babel.config.js by path, NativeWind's internals,
 *   tailwind.config.js or declarations.d.ts's nativewind/types line.
 * - The live halves of the frozen pins and look proofs (W3.1): each compares
 *   its JSON in `__parity__` with what NativeWind, nw-resolve, the
 *   translator or a live DmText/ActionBtn draws today, and writes it under
 *   DS_FREEZE_PINS=1. The halves in `yarn test` read only the JSON.
 * Green while NativeWind is in babel.config.js (up to W3.2); afterwards they
 * live on at the archive tag `archive/ds-pass1-tools`, where this runs them.
 */
const base = require("./jest.config")

module.exports = {
  ...base,
  displayName: "pass1-tools",
  testMatch: [
    "<rootDir>/src/**/*.pass1.test.[jt]s?(x)",
    "<rootDir>/scripts/**/*.pass1.test.[jt]s?(x)",
  ],
  testPathIgnorePatterns: ["/node_modules/"],
}
