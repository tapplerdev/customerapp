import { StyleSheet } from "react-native"

export default StyleSheet.create({
  profilePhoto: { width: 85, height: 85 },
  featuredBadgeBorder: {
    borderWidth: 0.5,
    borderColor: "#707070",
  },
  nameMarginTop: { marginTop: -2 },
  offerBadgeBorder: {
    borderWidth: 0.5,
    borderRadius: 12,
  },
  tabsWrapper: { width: 308 },
  offersBadgeShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 3,
  },
  tabContainer: {
    height: 34,
    borderRadius: 5,
    backgroundColor: "#EBEBEB",
  },
  bannerTriangleBase: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
})
