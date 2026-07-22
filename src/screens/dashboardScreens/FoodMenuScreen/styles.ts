import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

const styles = StyleSheet.create({
  tabsWrapper: {
    paddingVertical: 9,
    backgroundColor: colors.white,
    position: "relative",
    borderBottomWidth: 0.5,
    borderBottomColor: colors.grey14,
  },
  tabsLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  basketShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
})

export default styles
