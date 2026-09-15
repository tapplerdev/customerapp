// Moved to @tappler/shared so both apps get one bottom sheet, one dim rule and
// one dismissal contract. Kept as a re-export because five call sites import
// from this path.
//
// The Platform branch that used to live here — react-native-modal on Android —
// is gone. Android now presents Material's BottomSheetDialog through the same
// native view iOS uses.
export { default } from "@tappler/shared/src/components/NativeActionSheet/NativeActionSheet"
