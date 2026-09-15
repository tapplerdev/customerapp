import { Platform, StyleSheet } from "react-native"

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
})
