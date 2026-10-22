/*
 * `yarn test:parity:reverse` (jest -c jest.parity.reverse.config.js): the
 * parity suite again, every file's rows in reverse order
 * (src/testing/screenKit/reverseEnvironment.js). A gate beside
 * `yarn test:parity`: a row whose tree depends on the rows before it (module
 * state nobody resets, review M6; a refresh that outlived its row, H1) passes
 * in file order against a fixture captured in file order, and fails here.
 * Compare only; it refuses a capture run.
 */
const parity = require("./jest.parity.config")

module.exports = {
  ...parity,
  displayName: "parity-reverse",
  testEnvironment: "<rootDir>/src/testing/screenKit/reverseEnvironment.js",
}
