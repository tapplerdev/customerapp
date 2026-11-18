import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import { RULE_WEIGHT } from "@tappler/shared/src/ds"

export default StyleSheet.create({
  text: {
    marginTop: 5,
  },
  box: {
    height: RULE_WEIGHT,
    backgroundColor: colors.grey19,
  },
})
