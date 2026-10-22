import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

export default StyleSheet.create({
  tabRadius: {
    borderTopRightRadius: 6,
    borderTopLeftRadius: 6,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
  },
  textWrap: {
    backgroundColor: colors.red,
  },  // The box: bg-white, and its padding unless the caller's class or style
  // gave its own (`containerClassName || "px-[8] py-[8]"`).
  box: {
    backgroundColor: colors.white,
  },
  boxPadded: {
    backgroundColor: colors.white,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
})
