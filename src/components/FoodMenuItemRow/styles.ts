import { Dimensions, StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

const imageSize = Dimensions.get("window").width / 3.23

const styles = StyleSheet.create({
  img: {
    width: imageSize,
    height: imageSize,
    backgroundColor: colors.grey4,
    borderRadius: 5,
  },
  outOfStock: {
    opacity: 0.45,
  },
})

export default styles
