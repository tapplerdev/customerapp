import { StyleSheet } from "react-native"

const THUMB = 88

const styles = StyleSheet.create({
  thumb: {
    width: THUMB,
    height: THUMB,
  },
  // Same width as the thumbnail it sits under, so the two line up as one
  // column instead of the stepper overhanging the image by 16.
  stepper: {
    width: THUMB,
  },
  // Matches FiltersScreen's "Show results" footer — an upward shadow is what
  // makes it read as pinned above the content rather than floating in it.
  footerShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 5,
  },
})

export default styles
