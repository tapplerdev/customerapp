/**
 * The parity runs draw through src/testing/hostTreeParity.ts, the helper P3
 * proves its conversions with (real NativeWind runtime; i18next, the ds
 * language provider, I18nManager.isRTL and Platform set per environment;
 * the app's Latin faces (Montserrat here); insets through the safe-area
 * contexts; the tree
 * normalized: styles flattened, text runs joined, SafeAreaViews resolved to
 * the padding they lay out with, the pixel-free accessibility props left
 * out). This file only fixes the environment the codemod's runs use and
 * re-exports the comparison.
 */
const {
  hostTree,
  withoutAccessibility,
} = require("../../../src/testing/hostTreeParity")
const { allowButtonHeight, diffTrees } = require("./compare")

// Read through globalThis: babel here (react-native-dotenv) inlines a
// literal `process.env.NAME` at transform time, and jest caches the result.
const ENV = globalThis.process.env

/** A notch and a home indicator, so a SafeAreaView's resolved padding shows. */
const INSETS = { top: 62, bottom: 34, left: 0, right: 0 }

/**
 * The host tree of `element` in `lang`, on the platform this jest run was
 * started for (DS_PARITY_PLATFORM also picks the .ios/.android files, in
 * jest.config.js), as plain data.
 */
// hostTreeParity keeps the accessibility props since 2026-10-21 (the W1.5
// review's S5). This comparer accepts Button's deltas only on its root and
// has no accessibility allowance, so it reads the trees as it always has,
// without those three props on any node; both sides alike.
const renderTree = async (element, lang) =>
  withoutAccessibility(
    hostTree(element, {
      language: lang,
      platform: ENV.DS_PARITY_PLATFORM || "ios",
      insets: INSETS,
    })
  )

module.exports = { allowButtonHeight, diffTrees, renderTree, INSETS }
