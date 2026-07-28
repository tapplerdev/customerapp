import { StyleSheet } from "react-native"

export default StyleSheet.create({
  // Same pinned-footer shadow as the cart, menu and checkout.
  footerShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 5,
  },
})
