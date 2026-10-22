import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

export default StyleSheet.create({
  borderBase: {
    borderWidth: 0.75,
    borderRadius: 10,
  },
  checkmarkText: { color: "#CC0000", fontSize: 16, fontWeight: "bold" },
  imageContainer: {
    width: 100,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  boxWrapSelected: {
    backgroundColor: colors.pink,
  },
  boxWrapNotSelected: {
    backgroundColor: colors.white,
  },
  box: {
    width: 60,
    height: 60,
    backgroundColor: colors.grey29,
  },
  // NativeWind's `gap-[8]` on the answer's row: the row pulled back 8 left and
  // top, each child pushed 8 left and top (physical sides, as NativeWind wrote
  // them).
  gapRow: {
    marginLeft: -8,
    marginTop: -8,
  },
  gapChild: {
    marginLeft: 8,
    marginTop: 8,
  },
})
