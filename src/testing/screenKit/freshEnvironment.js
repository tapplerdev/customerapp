/**
 * Jest only: the test environment of `yarn test:parity:fresh`
 * (jest.parity.fresh.config.js). React Native's own environment, with every
 * row (every test) in a module registry of its own: the kit (index.ts)
 * makes a new one at a row's first render, as if the row ran alone.
 *
 * Why (review-ca-w0, the K re-check): the reverse pass sees a leak only when
 * the rows before a row change with the order. A leak with a source on both
 * sides of a row doesn't: with shared's dimProgress off the reset list and
 * three rows per registry (the address sheet open, then idle, then open
 * again), the idle row follows an open sheet in file order and reversed, so
 * a capture with the leak in passed 12/12 both ways, and the idle rows run
 * alone failed 4/4. Here every row starts from a registry nothing ran in, so
 * a row whose tree came from an earlier row's module state differs from its
 * fixture and fails, whatever the order.
 *
 * What it doesn't renew: anything outside the module registry, which the
 * whole file shares (the globals, jest's timers, a module the test file
 * imports at its top). The reverse pass still covers those, one-way.
 *
 * A row's renders share its registry (the kit's sweep loads every file and
 * then draws them in one test). Compare runs only: a capture is made in file
 * order, with `yarn ds:parity:capture`.
 */
const ReactNativeEnv = require("@react-native/jest-preset/jest/react-native-env.js")

class FreshRowsEnvironment extends ReactNativeEnv {
  constructor(config, context) {
    super(config, context)
    if (process.env.DS_PARITY_CAPTURE) {
      throw new Error(
        "test:parity:fresh only compares: capture in file order, with yarn ds:parity:capture"
      )
    }
    // The row the file is on, read by index.ts's engineFor: a new number is
    // a new registry. 0 until the first row starts.
    this.global.__screenKitFreshRow = 0
  }

  // jest-circus sends test_start before a test's beforeEach hooks and body
  // (jest-circus/build/run.js, _runTest).
  handleTestEvent(event) {
    if (event.name === "test_start") this.global.__screenKitFreshRow += 1
  }
}

module.exports = FreshRowsEnvironment
