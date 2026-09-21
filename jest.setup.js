// Swap the native sheet for the library's own mock, per
// https://sheet.lodev09.com/guides/jest — without it any test that reaches a
// sheet dies trying to resolve a Fabric component in node.
//
// WHAT THE MOCK DOES AND DOES NOT DO, because it shapes what a test can assert.
// It renders header + children + footer into a plain View UNCONDITIONALLY, so
// "the sheet is closed" is NOT expressible as "the content is absent" — a
// visibility test written that way passes while the thing is broken.
//
// What IS real: present/dismiss/resize are jest.fn()s on the mock's COMPOSITE
// instance (the same ones a consumer's ref holds), and the lifecycle props sit
// on that composite element too — not on the View it renders, which receives
// only `style`. Find the composite, not the host node.
//
// Note this mock is needed by any file that TRANSITIVELY imports the sheet, not
// just one that renders it: without it the import itself throws at module load.
jest.mock("@lodev09/react-native-true-sheet", () =>
  require("@lodev09/react-native-true-sheet/mock")
)
