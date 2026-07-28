import { StyleSheet } from "react-native"

export default StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  // Same 80pt white fade the regular-service review screen uses to land its
  // map hero on the page.
  fade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
})
