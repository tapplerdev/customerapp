import { StyleSheet } from "react-native"

export default StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative",
  },
  skeleton: {
    width: "100%",
    height: "100%",
  },
  shimmerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
  },
  shimmer: {
    width: "100%",
    height: "100%",
    shadowColor: "#FFFFFF",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
})
