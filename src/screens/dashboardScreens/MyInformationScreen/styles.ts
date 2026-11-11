import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import { color, radius } from "@tappler/shared/src/ds"

/** The photo tile in My Information: a square, 96 across. */
const PHOTO = 96

export default StyleSheet.create({
  photoTile: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: radius.r12,
    backgroundColor: color.brand.tint,
    overflow: "hidden",
  },
  photo: { width: PHOTO, height: PHOTO },
  photoBusy: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.surface.screen,
    opacity: 0.7,
  },
  sheetIcon: { width: 24 },
  safeArea: {
    backgroundColor: colors.white,
  },
  iconWrap: {
    width: 32,
    height: 32,
  },
  box: {
    width: 32,
  },
  box2: {
    height: 0.7,
    backgroundColor: colors.grey19,
  },
  input: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.black,
    borderBottomWidth: 0.7,
    borderBottomColor: colors.grey19,
  },
  text: {
    color: colors.grey15,
    borderBottomWidth: 0.7,
    borderBottomColor: colors.grey19,
  },
})
