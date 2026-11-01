import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

const styles = StyleSheet.create({
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
  container: {
    marginBottom: 36.5,
  },
  safeArea: {
    backgroundColor: colors.white,
  },
  row: {
    backgroundColor: colors.white,
    borderBottomColor: colors.grey19,
  },
  iconWrap: {
    width: 32,
    height: 32,
  },
  box: {
    width: 32,
  },
  boxWrap: {
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
  },
  box2: {
    height: 50,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: colors.red,
  },
  textWrap: {
    width: 30,
    height: 30,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    borderBottomLeftRadius: 5,
    backgroundColor: colors.white,
  },
})

export default styles
