import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

const styles = StyleSheet.create({
  closeButton: {
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  photo: {
    height: 286,
    backgroundColor: colors.grey4,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  footerShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 8,
  },
})

export default styles
