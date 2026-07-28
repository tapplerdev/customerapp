import { StyleSheet } from "react-native"

const THUMB = 88

const styles = StyleSheet.create({
  thumb: {
    width: THUMB,
    height: THUMB,
  },
  stepper: {
    width: 104,
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
