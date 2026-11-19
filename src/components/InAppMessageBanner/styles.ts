import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import { RULE_WEIGHT } from "@tappler/shared/src/ds"

export default StyleSheet.create({
  boxWrap: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopWidth: RULE_WEIGHT,
    borderRightWidth: RULE_WEIGHT,
    borderBottomWidth: RULE_WEIGHT,
    borderLeftWidth: RULE_WEIGHT,
    borderTopColor: colors.grey5,
    borderRightColor: colors.grey5,
    borderBottomColor: colors.grey5,
    borderLeftColor: colors.grey5,
  },
  imageWrap: {
    width: 40,
    height: 40,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  textWrap: {
    width: 40,
    height: 40,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.red,
  },
})
