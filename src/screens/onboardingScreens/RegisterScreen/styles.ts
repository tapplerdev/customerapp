import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

export default StyleSheet.create({
  inputHeight: { height: 44 },
  safeArea: {
    backgroundColor: colors.white,
  },
  iconWrap: {
    width: 32,
    height: 32,
  },
  box: {
    width: 32,
  },
  box2: {
    height: 0.7,
    backgroundColor: colors.grey19,
  },
  box3: {
    paddingLeft: 19,
    paddingRight: 19,
  },
  box4: {
    height: 0.7,
    backgroundColor: colors.grey1,
  },
  box5: {
    borderBottomWidth: 0.5,
    borderTopColor: colors.grey1,
    borderRightColor: colors.grey1,
    borderBottomColor: colors.grey1,
    borderLeftColor: colors.grey1,
  },
  box6: {
    width: 22,
    height: 22,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    borderTopColor: colors.grey1,
    borderRightColor: colors.grey1,
    borderBottomColor: colors.grey1,
    borderLeftColor: colors.grey1,
  },
  box7: {
    width: 12,
    height: 12,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.red,
  },
  buttonWrap: {
    paddingLeft: 53,
    paddingRight: 53,
  },
})
