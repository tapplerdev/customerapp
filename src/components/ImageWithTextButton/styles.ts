import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

export default StyleSheet.create({
  borderBase: {
    borderWidth: 0.75,
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
