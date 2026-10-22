// customerapp's own colour tokens: what customerapp's tailwind.config.js named
// that tappler-shared's palette (@tappler/shared/src/styles/colors) doesn't,
// then colours the app's classes drew that nothing names (provisional names).
//
// Kept by hand. `yarn ds:colors` (scripts/ds-colors.js) generated this file
// from tailwind.config.js; W3.4 deleted both with the rest of the class-era
// tools, and they live on at the archive tag archive/ca-pass1-tools. The six
// values something reads (OfferUpdateCard, ImageViewerModal, CalendarTimePicker
// and MapPinPicker's styles) are pinned by those components' parity trees: a
// changed one fails them. grey55Class and blue1 are read by nothing.
export default {
  red7: "#F76363",
  grey55Class: "#C6C6C6", // the grey55 class's colour; shared's grey55 is #00000091
  blue1: "#4084F5",
  blue2: "#4084F566",
  // Drawn by a class or a DmText style, named by nothing yet: provisional names.
  redAlpha10: "rgba(204, 0, 0, 0.1)", // bg-red/10, CalendarTimePicker
  whiteAlpha20: "rgba(255, 255, 255, 0.2)", // bg-white/20, ImageViewerModal
  whiteAlpha65: "rgba(255,255,255,0.65)", // style color, OfferUpdateCard's struck price
  whiteAlpha90: "rgba(255,255,255,0.9)", // style color, OfferUpdateCard's connector text
}
