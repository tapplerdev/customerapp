import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

const styles = StyleSheet.create({
  tabsWrapper: {
    paddingVertical: 9,
    backgroundColor: colors.white,
    position: "relative",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grey14,
  },
  tabsLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  // Matches FiltersScreen's footer: the shadow casts UPWARD onto the content
  // it covers, which is what makes it read as a pinned bar rather than a
  // floating pill.
  // Spans the full bar so the label centres on the BAR, not on the gap left
  // between the count badge and the total (those differ in width).
  basketLabel: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  basketShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 5,
  },
})

export default styles
