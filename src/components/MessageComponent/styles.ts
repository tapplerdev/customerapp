import { Dimensions, StyleSheet } from "react-native"

const SCREEN_WIDTH = Dimensions.get("window").width
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH - 129

export default StyleSheet.create({
  textCenter: { textAlign: "center" },
  bubbleMaxWidth: { maxWidth: BUBBLE_MAX_WIDTH },
  messageText: { fontSize: 13, lineHeight: 20 },
  timeText: { fontSize: 10, lineHeight: 13 },
})
