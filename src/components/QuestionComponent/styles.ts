import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

export default StyleSheet.create({
  inputBorder: {
    borderWidth: 1,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  containerNotHideBorders: {
    borderBottomWidth: 1,
    borderTopColor: colors.grey29,
    borderRightColor: colors.grey29,
    borderBottomColor: colors.grey29,
    borderLeftColor: colors.grey29,
  },
  container: {
    marginBottom: 25,
  },
  inputWrap: {
    backgroundColor: colors.white,
  },
})
