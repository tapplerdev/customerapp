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
})

export default styles
