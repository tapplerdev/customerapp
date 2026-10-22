/* eslint-disable global-require -- a jest.mock factory MUST require lazily:
   it is hoisted above every import and runs when the module is first
   requested, so a top-level require would load the real module before the
   mock exists. This is the shape https://sheet.lodev09.com/guides/jest shows. */

// The native sheet, swapped for the jest kit's stand-in
// (src/testing/trueSheet.tsx) rather than the library's own mock: theirs
// draws header + children + footer into a plain View UNCONDITIONALLY and
// hands it only `style`, so an open sheet, a closed one and one whose props
// changed all drew the same tree. The stand-in draws a `TrueSheet` host with
// every prop and the state it is in (`presented`, `detentIndex`), and mounts
// the content only while the library would.
//
// What stays as theirs: present/dismiss/resize are jest.fn()s on the
// COMPOSITE instance (the one a consumer's ref holds), and the statics act on
// the sheet registered under `name`.
//
// Note this mock is needed by any file that TRANSITIVELY imports the sheet, not
// just one that renders it: without it the import itself throws at module load.
jest.mock("@lodev09/react-native-true-sheet", () =>
  require("./src/testing/trueSheet").trueSheet()
)

// The sheet's OWN reanimated entry, mocked separately: it is a different
// module specifier, so the mock above does not cover it, and the real one
// drags in ReanimatedTrueSheet + its provider. tappler-shared's NativeSheet
// imports useReanimatedPositionChangeHandler from it (NativeSheet.tsx:4).
//
// NOTE what this costs. Their mock returns a bare jest.fn() for
// useReanimatedPositionChangeHandler, so THE WORKLET BODY NEVER RUNS under
// test — nothing here can assert that a drag moves the dim.
jest.mock("@lodev09/react-native-true-sheet/reanimated", () =>
  require("@lodev09/react-native-true-sheet/reanimated/mock")
)

// react-native-reanimated 4 cannot be imported under jest at all: its index
// pulls native initializers, and its OWN shipped mock re-enters that same
// index, so it does not stand alone either. Mocked at the boundary with the
// jest kit's stand-in (src/testing/screenKit/nativeMocks.ts): Animated.View,
// Text, ScrollView, FlatList, Image and createAnimatedComponent, with
// `entering`/`exiting`/`layout` dropped as the library drops them, shared
// values, and the animation functions answering with their end value.
// NativeSheet's `Animated.createAnimatedComponent(TrueSheet)` hands its ref
// through to the sheet's own instance, where the tests look for it.
jest.mock("react-native-reanimated", () =>
  require("./src/testing/screenKit/nativeMocks").reanimated()
)
jest.mock("react-native-worklets", () =>
  require("./src/testing/screenKit/nativeMocks").worklets()
)
