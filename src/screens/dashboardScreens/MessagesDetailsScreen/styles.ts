import { Platform, StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"

export default StyleSheet.create({
  textCenter: { textAlign: "center" },
  relative: { position: "relative" },
  emptyBg: { backgroundColor: "#F5F5F5" },
  italic: { fontStyle: "italic" },
  plusHorizontal: { width: 14, height: 1.5 },
  plusVertical: { height: 14, width: 1.5 },
  // The + / field / send row (WhatsApp-style). 4 above and below keeps the bar
  // as tall as the old 30-pt single row was: 4 + 36 + 4 = 7 + 30 + 7.
  composerCard: {
    paddingVertical: 4,
  },
  // The buttons are 32 against the field's 36-pt single line; 2 under them
  // centres them on it, and the bottom-aligned row keeps them on the last line
  // as the field grows.
  plusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 2,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    // WhatsApp's field: one line tall while the text fits (21 + 2 × 6.5
    // padding + 2 × 1 border = 36), a line taller per wrapped line, and
    // scrolling once it holds six. Android rounds every line up to whole
    // pixels, so six lines need a few dp more there than the exact sum.
    minHeight: 36,
    maxHeight: 21 * 6 + 2 * 6.5 + 2 + (Platform.OS === "android" ? 4 : 0),
    marginHorizontal: 8,
    paddingHorizontal: 14,
    paddingTop: 6.5,
    paddingBottom: 6.5,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3E3E3", // grey32
    textAlignVertical: "center",
  },
  photoStripItem: {
    width: 70,
    height: 70,
  },
  photoStripImage: {
    width: 70,
    height: 70,
    borderRadius: 6,
  },
  pendingWrapper: {
    width: 70,
    height: 70,
    marginRight: 5,
  },
  pendingThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 5,
  },
  pendingImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  pendingClose: {
    top: 0,
    right: 5,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  sheetAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  glanceMap: {
    flex: 1,
  },
  // Full-request sheet's map hero — inset rounded card, Airbnb photo-hero slot.
  requestHero: {
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#EFEFEF",
  },
  // 1c hero: map fills, gradient + title overlay on top (sheetCardInner clips).
  glanceHero: {
    height: 170,
    backgroundColor: "#EFEFEF",
  },
  glanceHeroFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  glanceHeroText: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 12,
  },
  glanceTitleOnMap: {
    fontSize: 16,
    lineHeight: 20,
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  glanceOfferOnMap: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 17,
    color: "rgba(255,255,255,0.9)",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowRadius: 3,
    textShadowOffset: { width: 0, height: 1 },
  },
  glanceOfferAmtOnMap: {
    fontSize: 13,
    color: "#FFFFFF",
  },
  // Content root of the More sheet — matches the native TapplerSheet's 24pt
  // clip (24 is not in the tailwind borderRadius scale, so it lives here).
  sheetContentRound: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  // Airbnb-style floating card inside the More sheet: soft shadow, no border.
  // Shadow lives on the OUTER view; the inner view clips the map hero to the
  // radius (overflow:hidden on the shadow view would kill the iOS shadow).
  sheetCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  sheetCardInner: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  // The OUTER composer sheet (full-width white bar): Airbnb-style rounded top
  // corners + soft hairline tracing them (no bottom edge), on top of the soft
  // lift shadow. This is the parent that was previously left sharp.
  inputBarSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 0.5,
    borderBottomWidth: 0,
    borderColor: "#EBEBEB",
  },
  inputBarShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  sheetHandle: {
    backgroundColor: "#D1D1D6",
    width: 40,
  },
  // Matches the native TapplerSheet's 24pt top rounding (Airbnb-scale).
  sheetBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  scrollFab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  iconWrap: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 6,
    backgroundColor: colors.grey36,
  },
  container: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 6,
  },
  textWrap: {
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.red,
  },
  box: {
    height: 0.7,
    backgroundColor: colors.grey19,
  },
  box2: {
    backgroundColor: colors.grey26,
  },
  box3: {
    backgroundColor: colors.grey2,
  },
  box4: {
    backgroundColor: colors.white,
  },
  text: {
    marginTop: 3,
  },
  textWrap2: {
    backgroundColor: colors.red,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    paddingTop: 3,
    paddingBottom: 3,
  },
  row: {
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    borderBottomRightRadius: 13,
    borderBottomLeftRadius: 13,
    backgroundColor: colors.grey58,
  },
  iconWrap2: {
    width: 36,
    height: 36,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.white,
  },
  containerLength: {
    paddingTop: 11,
    paddingBottom: 11,
    borderBottomWidth: 0.5,
    borderTopColor: colors.grey29,
    borderRightColor: colors.grey29,
    borderBottomColor: colors.grey29,
    borderLeftColor: colors.grey29,
  },
  containerNotLength: {
    paddingTop: 11,
    paddingBottom: 11,
  },
  iconWrapRtl: {
    transform: [{ rotate: "180deg" }],
  },
  imageWrap: {
    width: 36,
    height: 36,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  textWrap3: {
    width: 36,
    height: 36,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.red,
  },
  row2: {
    height: 30,
  },
  box5: {
    backgroundColor: colors.black,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    width: 6,
    height: 6,
    marginLeft: 1,
    marginRight: 1,
  },
  row3: {
    marginLeft: 55,
    borderTopWidth: 0.3,
    borderRightWidth: 0.3,
    borderBottomWidth: 0.3,
    borderLeftWidth: 0.3,
    borderTopColor: colors.black,
    borderRightColor: colors.black,
    borderBottomColor: colors.black,
    borderLeftColor: colors.black,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    borderBottomLeftRadius: 5,
    height: 38,
  },
  offerWrap: {
    width: "40%",
    backgroundColor: colors.red5,
  },
  offer: {
    letterSpacing: 0.3,
  },
  row4: {
    width: "60%",
  },
  row5: {
    justifyContent: "space-around",
  },
  call: {
    marginLeft: 5,
    marginRight: 5,
  },
  row6: {
    borderTopWidth: 0.5,
    borderTopColor: colors.grey4,
    borderRightColor: colors.grey4,
    borderBottomColor: colors.grey4,
    borderLeftColor: colors.grey4,
  },
  box6: {
    borderBottomWidth: 0.5,
    borderTopColor: colors.grey4,
    borderRightColor: colors.grey4,
    borderBottomColor: colors.grey4,
    borderLeftColor: colors.grey4,
  },
  requestSentToProInfoWrap: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 12,
  },
  iconWrap3: {
    bottom: 16,
    right: 16,
    width: 36,
    height: 36,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.white,
  },
  tapToDismissWrap: {
    backgroundColor: colors.red,
  },
  iconWrap4: {
    backgroundColor: colors.grey4,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 8,
  },
  iconWrap5: {
    width: 18,
    height: 18,
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    borderTopColor: colors.grey2,
    borderRightColor: colors.grey2,
    borderBottomColor: colors.grey2,
    borderLeftColor: colors.grey2,
    backgroundColor: colors.white,
  },
  box7: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
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
})
