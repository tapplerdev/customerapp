import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

export default StyleSheet.create({
  rowContainer: {
    marginTop: 4,
    height: 16,
    justifyContent: "center",
  },
  postedRow: {
    marginTop: 4,
    minHeight: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  offersBadge: {
    backgroundColor: "#EBEBEB",
    paddingHorizontal: 10,
    paddingVertical: 3,
    position: "absolute",
    right: 0,
  },
  row: {
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  offers: {
    marginRight: 5,
  },
  textWrap: {
    width: 20,
    height: 20,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.red,
  },
  row2: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 4,
  },
  leaveReviewWrap: {
    paddingTop: 5,
    paddingBottom: 5,
  },
  box: {
    height: 0.5,
    backgroundColor: colors.grey19,
  },
  safeArea: {
    backgroundColor: colors.white,
  },
  box2: {
    height: 0.7,
    backgroundColor: colors.grey19,
  },
})

export const talabatiSkeletonStyles = StyleSheet.create({
  box: {
    height: 0.5,
    backgroundColor: colors.grey19,
  },
})
