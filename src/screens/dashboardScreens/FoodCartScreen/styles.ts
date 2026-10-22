import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

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
  container: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grey14,
  },
  text: {
    marginTop: 3,
  },
  preOrderWrap: {
    backgroundColor: colors.red2,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 4,
    paddingTop: 3,
    paddingBottom: 3,
  },
  imageWrap: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 8,
  },
  eGP: {
    textDecorationLine: "line-through",
  },
  row: {
    borderTopColor: colors.grey14,
    borderRightColor: colors.grey14,
    borderBottomColor: colors.grey14,
    borderLeftColor: colors.grey14,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 8,
    height: 34,
  },
  iconWrap: {
    width: 24,
    height: 34,
  },
  safeArea: {
    backgroundColor: colors.white,
  },
  row2: {
    backgroundColor: colors.white,
    borderBottomColor: colors.grey19,
  },
  iconWrap2: {
    width: 32,
    height: 32,
  },
  box: {
    width: 32,
  },
  box2: {
    height: 0.7,
    backgroundColor: colors.grey14,
  },
})

export default styles
