import { I18nManager, StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

const styles = StyleSheet.create({
  notesBorder: {
    borderWidth: 0.5,
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
    borderTopWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderLeftWidth: 0.5,
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
    borderTopWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderLeftWidth: 0.5,
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
  box4: {
    height: 0.5,
    backgroundColor: colors.grey14,
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
  box5: {
    height: 0.7,
    backgroundColor: colors.grey14,
  },
})

export default styles
