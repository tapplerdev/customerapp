import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

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
  rescueCard: {
    borderWidth: 1,
    borderColor: "#ECECEF",
    borderRadius: 14,
    padding: 14,
  },
  rescueIconTile: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: "#FFF8F8",
  },
  rescuePill: {
    backgroundColor: "#CC0000",
  },
  box: {
    width: 85,
    height: 85,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    borderBottomLeftRadius: 2,
    backgroundColor: colors.grey8,
  },
  boxWrap: {
    top: -8,
  },
  featuredWrap: {
    height: 18,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    borderBottomLeftRadius: 5,
    backgroundColor: colors.yellow,
  },
  featured: {
    textTransform: "uppercase",
  },
  offerAmountWrap: {
    paddingTop: 3,
    paddingBottom: 3,
  },
  textWrap: {
    top: -8,
    right: -8,
    width: 18,
    height: 18,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.red,
  },
  box2: {
    height: 0.5,
    backgroundColor: colors.grey19,
  },
  safeArea: {
    backgroundColor: colors.white,
  },
  iconWrap: {
    width: 32,
    height: 32,
  },
  box3: {
    backgroundColor: colors.black,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    width: 5,
    height: 5,
    marginLeft: 1,
    marginRight: 1,
  },
  mainModalTitle: {
    marginTop: 17,
  },
  mainModalBtns: {
    height: 40,
  },
  mainModalBtnsWrapper: {
    marginLeft: 15,
    marginRight: 15,
  },
  mainModalModal: {
    paddingLeft: 17,
    paddingRight: 17,
  },
  textWrap2: {
    top: -12,
    backgroundColor: colors.red,
    paddingTop: 3,
    paddingBottom: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    borderBottomLeftRadius: 3,
    zIndex: 10,
  },
  textWrap3: {
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    paddingTop: 9,
    paddingBottom: 9,
  },
  textWrap4: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 10,
  },
})
