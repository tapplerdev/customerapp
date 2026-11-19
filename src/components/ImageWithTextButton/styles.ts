import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import { RULE_WEIGHT } from "@tappler/shared/src/ds"

export default StyleSheet.create({
  borderBase: {
    borderWidth: RULE_WEIGHT,
    borderRadius: 10,
    overflow: "hidden",
  },
  scaledImage: { transform: [{ scale: 0.7 }] },
  boxSelected: {
    backgroundColor: colors.pink,
  },
  boxNotSelected: {
    backgroundColor: colors.white,
  },
  box: {
    width: 60,
    height: 60,
    backgroundColor: colors.grey29,
  },
})
