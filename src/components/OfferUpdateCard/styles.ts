import { StyleSheet } from "react-native"
import { color } from "@tappler/shared/src/ds"

export default StyleSheet.create({
  row: {
    alignItems: "baseline",
    marginTop: 3,
  },
  previous: {
    textDecorationLine: "line-through",
    textDecorationColor: color.text.muted,
  },
  time: {
    marginTop: 3,
  },
  left: {
    textAlign: "left",
  },
})
