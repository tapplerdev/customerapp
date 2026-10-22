import { Dimensions, StyleSheet } from "react-native"

const SCREEN_WIDTH = Dimensions.get("window").width
const BUBBLE_MAX_WIDTH = SCREEN_WIDTH - 129

export default StyleSheet.create({
  textCenter: { textAlign: "center" },
  bubbleMaxWidth: { maxWidth: BUBBLE_MAX_WIDTH },
  messageText: { fontSize: 13, lineHeight: 20 },
  timeText: { fontSize: 10, lineHeight: 13 },
})

export const messageComponentStyles = StyleSheet.create({
  textWrapOwnActionAr: {
    alignItems: "flex-start",
    paddingLeft: 49,
  },
  textWrapOwnActionNotAr: {
    alignItems: "flex-end",
    paddingRight: 49,
  },
  systemEventBubbleWrap: {
    display: "flex",
  },
  systemEventBubbleWrapProActionAr: {
    alignItems: "flex-end",
    paddingRight: 49,
    marginLeft: 80,
  },
  systemEventBubbleWrapProActionNotAr: {
    alignItems: "flex-start",
    paddingLeft: 49,
    marginRight: 80,
  },
  textWrapNotMyMessageAr: {
    alignItems: "flex-end",
    paddingRight: 53,
  },
  textWrapNotMyMessageNotAr: {
    alignItems: "flex-start",
    paddingLeft: 53,
  },
  boxWrapNotMyMessageAr: {
    alignItems: "flex-end",
    paddingRight: 53,
    paddingLeft: 80,
  },
  boxWrapNotMyMessageNotAr: {
    alignItems: "flex-start",
    paddingLeft: 53,
    paddingRight: 80,
  },
  readByWrap: {
    paddingTop: 3,
  },
})
