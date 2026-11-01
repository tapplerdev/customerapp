import { Platform, StyleSheet } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import { TRUST_STICKER_GAP } from "@tappler/shared/src/constants/trustSticker"

export default StyleSheet.create({
  cardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  featuredBadgeBorder: {
    borderWidth: 0.5,
    borderColor: "#707070",
  },
  /**
   * Chat / Select-me. A downward shadow on iOS; on Android just the border.
   *
   * `elevation: 3` here produced the grey block around the chat button. Two
   * reasons, and the first is the ugly one: Android derives a shadow outline
   * from the view's BACKGROUND, and the chat button sets none (Select-me sets
   * one, which is why only the chat button looked boxed) — with a transparent
   * background it falls back to the raw rectangular bounds and paints that.
   * Second, elevation ignores shadowOffset entirely and casts on all four
   * sides, so even the button that has a background got a halo rather than the
   * downward shadow this style is asking for.
   *
   * The 0.3 border already separates both buttons from the white card, so
   * Android simply drops the shadow instead of faking a directional one.
   */
  buttonShadow: {
    borderWidth: 0.3,
    borderColor: "#707070",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.16,
        shadowRadius: 3,
      },
      default: {},
    }),
  },
  profilePhoto: { width: 85, height: 85 },
  list: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: 15,
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
  text: {
    flexShrink: 1,
  },
  row: {
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
    backgroundColor: colors.grey16,
  },
  container: {
    borderTopLeftRadius: 9999,
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    borderBottomLeftRadius: 9999,
  },
  containerAccent: {
    backgroundColor: colors.red2,
  },
  containerNotAccent: {
    backgroundColor: colors.grey16,
  },
  iconWrap: {
    height: 34,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 10,
  },
  // The trust stickers, from the start edge, 10pt apart, wrapping (#522).
  trustRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: TRUST_STICKER_GAP,
    rowGap: 6,
  },
})

export const tooltipComponentStyles = StyleSheet.create({
  howToGetBestDeal: {
    marginTop: -10,
  },
  box: {
    width: 18,
    height: 18,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    borderBottomLeftRadius: 3,
    borderTopColor: colors.white,
    borderRightColor: colors.white,
    borderBottomColor: colors.white,
    borderLeftColor: colors.white,
  },
  buttonWrap: {
    width: 150,
  },
})
