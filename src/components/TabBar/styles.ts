import { Dimensions, StyleSheet } from "react-native"

const SCREEN_WIDTH = Dimensions.get("window").width
const itemWidth = (SCREEN_WIDTH - 48) / 4

const styles = StyleSheet.create({
  item: {
    width: itemWidth,
  },
  // Consumed by <DropShadow> in TabBar.tsx, which honours shadowOffset on
  // BOTH platforms. No `elevation`: Android's elevation ignores the offset and,
  // inside the tab navigator, did not render at all (see TabBar.tsx).
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
})

export default styles
