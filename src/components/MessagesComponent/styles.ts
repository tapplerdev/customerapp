import { Dimensions, StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

const SCREEN_WIDTH = Dimensions.get("window").width

export default StyleSheet.create({
  avatar: { width: 40, height: 40 },
  thumbnail: { width: 20, height: 20 },
  archiveAction: { width: SCREEN_WIDTH },
  italic: { fontStyle: "italic" },
  container: {
    backgroundColor: colors.red,
  },
  box: {
    backgroundColor: colors.white,
  },
  boxWrap: {
    paddingLeft: 15,
    paddingRight: 15,
    paddingBottom: 13,
  },
  imageWrap: {
    width: 40,
    height: 40,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  textWrap: {
    width: 40,
    height: 40,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.red,
  },
  text: {
    marginRight: 5,
  },
  textWrap2: {
    backgroundColor: colors.red,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    width: 24,
    height: 24,
  },
  container2: {
    width: 20,
    height: 20,
  },
  iconWrap: {
    marginRight: 3,
  },
  box2: {
    marginRight: 15,
    borderTopColor: colors.grey4,
    borderRightColor: colors.grey4,
    borderBottomColor: colors.grey4,
    borderLeftColor: colors.grey4,
  },
})
