import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

export default StyleSheet.create({
  container: {
    backgroundColor: colors.white,
  },
  boxWrap: {
    top: 12,
    right: 16,
    zIndex: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.grey5,
  },
  lucideSendWrap: {
    width: 72,
    height: 72,
  },
  box: {
    width: 40,
    height: 40,
  },
  signUpWrap: {
    height: 52,
    backgroundColor: colors.red,
  },
  logInWrap: {
    height: 52,
    backgroundColor: colors.white,
    borderTopColor: colors.red,
    borderRightColor: colors.red,
    borderBottomColor: colors.red,
    borderLeftColor: colors.red,
  },
})
