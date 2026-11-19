import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import { RULE_WEIGHT } from "@tappler/shared/src/ds"

export default StyleSheet.create({
  safeArea: {
    backgroundColor: colors.white,
  },
  hiThere: {
    color: colors.black1,
  },
  row: {
    height: 51,
    backgroundColor: colors.red,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderBottomLeftRadius: 28,
  },
  row2: {
    height: 51,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderBottomLeftRadius: 28,
    borderTopWidth: RULE_WEIGHT,
    borderRightWidth: RULE_WEIGHT,
    borderBottomWidth: RULE_WEIGHT,
    borderLeftWidth: RULE_WEIGHT,
    borderTopColor: colors.red,
    borderRightColor: colors.red,
    borderBottomColor: colors.red,
    borderLeftColor: colors.red,
  },
})
