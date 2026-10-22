/*
 * `yarn test:parity:fresh` (jest -c jest.parity.fresh.config.js): the parity
 * suite again, every row in a module registry of its own
 * (src/testing/screenKit/freshEnvironment.js), as if each ran alone. A gate
 * for the wave merges, beside `yarn test:parity` and
 * `yarn test:parity:reverse`: a row whose tree came from an earlier row's
 * module state passes in file order against a fixture captured in file
 * order, and in reverse too when the state has a source on both sides of it
 * (review-ca-w0, the K re-check); here it fails. Compare only; it refuses a
 * capture run.
 */
const parity = require("./jest.parity.config")

module.exports = {
  ...parity,
  displayName: "parity-fresh",
  testEnvironment: "<rootDir>/src/testing/screenKit/freshEnvironment.js",
}
