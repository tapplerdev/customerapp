import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import { RULE_WEIGHT } from "@tappler/shared/src/ds"

export default StyleSheet.create({
  box: {
    height: RULE_WEIGHT,
    backgroundColor: colors.grey5,
  },
  list: {
    backgroundColor: colors.white,
  },
  row: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    height: 44,
  },
  row2: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    height: 40,
  },
  container: {
    borderBottomWidth: RULE_WEIGHT,
    borderBottomColor: colors.grey5,
  },
})
