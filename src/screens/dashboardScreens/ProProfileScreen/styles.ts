import { StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import { color } from "@tappler/shared/src/ds"

export default StyleSheet.create({
  headerZIndex: { zIndex: 3 },
  heroZIndex: { zIndex: 5 },
  // The account type's grey pill (#522): its icon and label, 8 in from each
  // side, 4 above and below.
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 4,
    paddingBottom: 4,
    borderRadius: 5,
    backgroundColor: color.divider,
  },
  fullSize: { width: "100%", height: "100%" },
  modalOverlay: { backgroundColor: "#000000A6" },
  thumbnailSize: { width: 60, height: 60 },
  // Mirrors proapp's videoThumbnailOverlay so a video reads the same way in
  // both apps' viewers.
  thumbnailOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailBase: {
    width: 60,
    height: 60,
    marginHorizontal: 4,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
  },
  floatingButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 20,
  },
  safeArea: {
    backgroundColor: colors.white,
  },
  animated: {
    backgroundColor: colors.white,
    borderBottomWidth: 0.3,
    borderTopColor: colors.grey2,
    borderRightColor: colors.grey2,
    borderBottomColor: colors.grey2,
    borderLeftColor: colors.grey2,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.white,
  },
  text: {
    flexShrink: 1,
  },
  iconWrap2: {
    left: 18,
    width: 28,
    height: 28,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.white,
  },
  textWrap: {
    backgroundColor: colors.grey8,
  },
  // The rule above each section (About me, Photos, Working Hours, Accepted
  // Payments, Social Media): half a point, down from the full point
  // `border-t-1` drew. Its colour is each section's own grey53. Mirrors
  // proapp's preview of this page: keep in sync.
  sectionRule: { borderTopWidth: 0.5 },
  boxWrap: {
    paddingTop: 11,
    borderTopColor: colors.grey53,
    borderRightColor: colors.grey53,
    borderBottomColor: colors.grey53,
    borderLeftColor: colors.grey53,
  },
  box: {
    paddingLeft: 15,
    paddingRight: 19,
  },
  text2: {
    marginTop: 11,
  },
  box2: {
    paddingTop: 15,
    borderTopColor: colors.grey53,
    borderRightColor: colors.grey53,
    borderBottomColor: colors.grey53,
    borderLeftColor: colors.grey53,
  },
  containerIndex: {
    marginLeft: 15,
  },
  boxWrap2: {
    paddingTop: 17,
    paddingBottom: 17,
    borderTopColor: colors.grey53,
    borderRightColor: colors.grey53,
    borderBottomColor: colors.grey53,
    borderLeftColor: colors.grey53,
  },
  box3: {
    width: 8,
    height: 8,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.red,
  },
  textWrapAr: {
    width: 60,
  },
  textWrapNotAr: {
    width: 45,
  },
  boxWrap3: {
    paddingTop: 15,
    paddingBottom: 13,
    borderTopColor: colors.grey53,
    borderRightColor: colors.grey53,
    borderBottomColor: colors.grey53,
    borderLeftColor: colors.grey53,
  },
  text3: {
    textTransform: "capitalize",
  },
})
