import { Dimensions, StyleSheet } from "react-native"

const SCREEN_WIDTH = Dimensions.get("window").width

export default StyleSheet.create({
  avatar: { width: 40, height: 40 },
  thumbnail: { width: 20, height: 20 },
  archiveAction: { width: SCREEN_WIDTH },
  italic: { fontStyle: "italic" },
})
