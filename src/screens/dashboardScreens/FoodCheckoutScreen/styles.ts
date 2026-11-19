import { I18nManager, StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import { RULE_WEIGHT } from "@tappler/shared/src/ds"

const styles = StyleSheet.create({
  notesBorder: {
    borderWidth: RULE_WEIGHT,
    borderColor: colors.grey14,
    borderRadius: 12,
  },
  notesInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.black,
    textAlign: I18nManager.isRTL ? "right" : "left",
    minHeight: 80,
    textAlignVertical: "top",
  },
  // Matches FiltersScreen / FoodCart / FoodMenu — the upward shadow is what
  // reads as pinned above the content rather than floating in it.
  footerShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 5,
  },
  container: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: colors.pink1,
  },
  textWrap: {
    paddingTop: 7,
    paddingBottom: 7,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: colors.red,
  },
  findOtherProsWrap: {
    paddingTop: 7,
    paddingBottom: 7,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderTopWidth: RULE_WEIGHT,
    borderRightWidth: RULE_WEIGHT,
    borderBottomWidth: RULE_WEIGHT,
    borderLeftWidth: RULE_WEIGHT,
    borderTopColor: colors.red,
    borderRightColor: colors.red,
    borderBottomColor: colors.red,
    borderLeftColor: colors.red,
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
  box2: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopWidth: RULE_WEIGHT,
    borderRightWidth: RULE_WEIGHT,
    borderBottomWidth: RULE_WEIGHT,
    borderLeftWidth: RULE_WEIGHT,
    borderTopColor: colors.grey14,
    borderRightColor: colors.grey14,
    borderBottomColor: colors.grey14,
    borderLeftColor: colors.grey14,
  },
  box3: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 8,
    backgroundColor: colors.grey58,
  },
  text: {
    marginTop: 3,
  },
  list: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 12,
    backgroundColor: colors.grey36,
  },
})

export default styles
