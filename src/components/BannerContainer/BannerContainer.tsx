import React from "react"
import type { StyleProp, ViewStyle } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import styles from "./styles"
import { Text, a, type NoShorthands } from "@tappler/shared/src/ds"

// The banner's red tab: the text in white capitals, rounded on top, from the
// start edge (left in English, right in Arabic). BannerContainer draws it over
// its box, and OffersSection's strip over the pro card's sticker band, so the
// card labels the stickers the way the profile page does.
//
// It takes only its text: a caller that needs to move the tab wraps it in a
// DmView.
export const BannerTab: React.FC<{ text: string }> = ({ text }) => (
  <DmView style={[a.flex_row, a.justify_start]}>
    <DmView
      style={[styles.textWrap, a.px_4, a.py_2, styles.tabRadius]}
    >
      <Text size={10} weight="bold" leading="legacy" color="inverse">
        {text.toUpperCase()}
      </Text>
    </DmView>
  </DmView>
)

interface BannerContainerProps {
  bannerText: string
  children: React.ReactNode
  /**
   * The block (the tab and its box), as a style. Like every twin it takes one
   * key per side or corner (see NoShorthands).
   */
  style?: StyleProp<ViewStyle & NoShorthands>
  /**
   * The bordered box, as a style, in place of its own padding (8 all round);
   * under its own border and corners. One key per side or corner (see
   * NoShorthands).
   */
  containerStyle?: StyleProp<ViewStyle & NoShorthands>
  borderRadius?: number
}

const BannerContainer: React.FC<BannerContainerProps> = ({
  bannerText,
  children,
  style,
  containerStyle,
  borderRadius = 10,
}) => {
  return (
    <DmView style={style}>
      <BannerTab text={bannerText} />

      {/* A caller's box style replaces its own padding (8 all round); its
          border and corners stay on top of either. */}
      <DmView
        style={[
          containerStyle ? styles.box : styles.boxPadded,
          containerStyle,
          {
            borderWidth: 0.5,
            borderColor: colors.grey6,
            borderBottomRightRadius: borderRadius,
            borderBottomLeftRadius: borderRadius,
            borderTopRightRadius: borderRadius,
          },
        ]}
      >
        {children}
      </DmView>
    </DmView>
  )
}

export default BannerContainer
