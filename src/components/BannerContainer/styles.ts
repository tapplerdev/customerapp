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
  },  // The box: white, and its padding unless the caller's containerStyle
  // gave its own (8 all round otherwise, as `px-[8] py-[8]` was).
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
