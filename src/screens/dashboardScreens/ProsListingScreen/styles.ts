import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

export default StyleSheet.create({
  root: { flex: 1 },
  screenBg: { backgroundColor: "#FFFFFF" },
  searchPill: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  continueContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 50,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  row: {
    backgroundColor: colors.white,
  },
  iconWrap: {
    width: 32,
    height: 32,
  },
  row2: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    height: 38,
  },
  box: {
    height: 0.7,
    backgroundColor: colors.grey19,
  },
  shortlistUpdatedNoticeWrap: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 10,
  },
})
