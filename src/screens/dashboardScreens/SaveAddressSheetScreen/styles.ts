import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

export default StyleSheet.create({
  addressPreviewBg: { backgroundColor: "#F8F8F8" },
  container: {
    backgroundColor: colors.white,
  },
  box: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 10,
  },
  text: {
    marginTop: 3,
  },
})
