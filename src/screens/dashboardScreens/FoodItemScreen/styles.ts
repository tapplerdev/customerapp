import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

const styles = StyleSheet.create({
  closeButton: {
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  photo: {
    height: 286,
    backgroundColor: colors.grey4,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  footerShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 8,
  },
  container: {
    marginTop: 16.5,
  },
  textWrap: {
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 15,
    paddingRight: 15,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 14,
    backgroundColor: colors.pink1,
  },
  textWrapNotRequired: {
    backgroundColor: colors.grey36,
  },
  eGPChoice: {
    textDecorationLine: "line-through",
  },
  // The struck full price beside the discounted one (the 17 has no atom).
  eGPStruck: {
    marginLeft: 17,
    textDecorationLine: "line-through",
  },
  safeArea: {
    backgroundColor: colors.white,
  },
  iconWrap: {
    left: 18,
    width: 28,
    height: 28,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.white,
  },
  row: {
    paddingTop: 9,
    paddingBottom: 9,
    borderTopColor: colors.grey35,
    borderBottomColor: colors.grey35,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
  },
  button: {
    alignSelf: "auto",
  },
  itemPreparedOnOrderOnly: {
    marginLeft: 7,
  },
  iconWrap2: {
    width: 23,
    height: 23,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  iconWrapCount: {
    opacity: 0.4,
  },
  iconWrap3: {
    width: 23,
    height: 23,
    borderTopColor: colors.red,
    borderRightColor: colors.red,
    borderBottomColor: colors.red,
    borderLeftColor: colors.red,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  button2: {
    marginTop: 23,
  },
})

export default styles
