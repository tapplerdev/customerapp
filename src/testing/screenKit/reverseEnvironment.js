/**
 * Jest only: the test environment of `yarn test:parity:reverse`
 * (jest.parity.reverse.config.js). React Native's own environment, with every
 * describe block's tests and blocks run in reverse order, the file's top
 * level included.
 *
 * Why (review M6): the kit reuses a module registry for every row of a
 * platform, direction and window, so a module that keeps state and that
 * nobody listed in rowState's PER_ROW leaks from one row into the next. A
 * fixture captured in file order then holds the leak, and a compare in the
 * same order passes it: with shared's dimProgress taken off the reset list,
 * FoodCheckout's rows captured with the leak compared 8/8 in order and
 * failed 4/4 alone. Reversed, every row runs after the rows that ran after
 * it before, so a row whose tree depended on an earlier one differs from its
 * fixture and fails: a module nobody has listed, a refresh that outlived its
 * row (H1), anything else a row hands the next.
 *
 * Compare runs only: a capture in reverse order would hold the same leak the
 * other way round.
 */
const ReactNativeEnv = require("@react-native/jest-preset/jest/react-native-env.js")

class ReverseRowsEnvironment extends ReactNativeEnv {
  constructor(config, context) {
    super(config, context)
    if (process.env.DS_PARITY_CAPTURE) {
      throw new Error(
        "test:parity:reverse only compares: capture in file order, with yarn ds:parity:capture"
      )
    }
    // For the kit's own test of the order (rowOrder.parity.tsx).
    this.global.__screenKitRowOrder = "reverse"
  }

  // jest-circus runs a block's children in this array's order, right after
  // this event (jest-circus/build/run.js, _runTestsForDescribeBlock).
  handleTestEvent(event) {
    if (event.name === "run_describe_start") {
      event.describeBlock.children.reverse()
    }
  }
}

module.exports = ReverseRowsEnvironment
