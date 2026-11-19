import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import { RULE_WEIGHT } from "@tappler/shared/src/ds"

export default StyleSheet.create({
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
  input: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.black,
    borderBottomWidth: RULE_WEIGHT,
    borderBottomColor: colors.grey19,
  },
})
