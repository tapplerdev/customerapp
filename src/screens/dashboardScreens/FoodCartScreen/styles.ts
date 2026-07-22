import { I18nManager, StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

const styles = StyleSheet.create({
  lineImage: {
    width: 54,
    height: 54,
  },
  notesBorder: {
    borderWidth: 1,
    borderColor: colors.grey5,
    borderRadius: 10,
  },
  notesInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.black,
    textAlign: I18nManager.isRTL ? "right" : "left",
    minHeight: 90,
    textAlignVertical: "top",
  },
})

export default styles
