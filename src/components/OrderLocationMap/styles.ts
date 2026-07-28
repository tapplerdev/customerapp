import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

export default StyleSheet.create({
  frame: {
    borderWidth: 0.7,
    borderColor: colors.grey19,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
})
