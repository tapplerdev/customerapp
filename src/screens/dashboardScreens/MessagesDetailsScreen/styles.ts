import { StyleSheet } from "react-native"

export default StyleSheet.create({
  textCenter: { textAlign: "center" },
  relative: { position: "relative" },
  emptyBg: { backgroundColor: "#F5F5F5" },
  italic: { fontStyle: "italic" },
  plusHorizontal: { width: 14, height: 1.5 },
  plusVertical: { height: 14, width: 1.5 },
  composerCard: {
    paddingVertical: 7,
  },
  composerCardFocused: {
    paddingTop: 14,
    paddingBottom: 4,
  },
  toolbarRow: {
    marginTop: 18,
  },
  sendButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    maxHeight: 100,
    marginHorizontal: 8,
    paddingTop: 0,
    paddingBottom: 0,
    textAlignVertical: "center",
  },
  // Focused layout: the text row has no sibling circles, so drop the gap
  // margins — the text's left edge lines up flush with the + button below it
  // (the Airbnb alignment).
  textInputFocused: {
    marginHorizontal: 0,
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
    ...StyleSheet.absoluteFillObject,
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
})
