import { Dimensions, StyleSheet } from "react-native"

const SCREEN_WIDTH = Dimensions.get("window").width
const itemWidth = (SCREEN_WIDTH - 48) / 4

const styles = StyleSheet.create({
  item: {
    width: itemWidth,
  },
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
})

export default styles
