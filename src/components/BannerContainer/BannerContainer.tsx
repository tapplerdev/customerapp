import React from "react"
import type { StyleProp, ViewStyle } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { classNameSlot } from "@tappler/shared/src/components/classNameSlots"
import type { NoShorthands } from "@tappler/shared/src/components/classStyles"
import colors from "@tappler/shared/src/styles/colors"
import styles from "./styles"
import { Text, a } from "@tappler/shared/src/ds"

// The banner's red tab: the text in white capitals, rounded on top, from the
// start edge (left in English, right in Arabic). BannerContainer draws it over
// its box, and OffersSection's strip over the pro card's sticker band, so the
// card labels the stickers the way the profile page does.
//
// It takes no className. NativeWind's babel plugin wraps a component imported
// by its file path, as this one is, and the wrapper hands the component a
// style prop in place of the className. So a caller that needs to move the
// tab wraps it in a DmView.
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

// The block and its bordered box as slots: a caller's className lands after
// each one's own styles (see classNameSlots).
const Root = classNameSlot(DmView)
const Box = classNameSlot(DmView)

interface BannerContainerProps {
  bannerText: string
  children: React.ReactNode
  /** The block (the tab and its box), as classes. */
  className?: string
  /**
   * The block, as a style, after `className`. Like every twin it takes one
   * key per side or corner (see NoShorthands).
   */
  style?: StyleProp<ViewStyle & NoShorthands>
  /** The bordered box, as classes, in place of its own padding (8 all round). */
  containerClassName?: string
  /**
   * The bordered box, as a style, after `containerClassName` and in place of
   * its own padding too; under its own border and corners, as the classes
   * were. One key per side or corner (see NoShorthands). The box reads
   * whether either is there, which the codemod's structural check can't
   * follow:
   * @dsSlot containerClassName
   */
  containerStyle?: StyleProp<ViewStyle & NoShorthands>
  borderRadius?: number
}

const BannerContainer: React.FC<BannerContainerProps> = ({
  bannerText,
  children,
  className,
  style,
  containerClassName,
  containerStyle,
  borderRadius = 10,
}) => {
  return (
    <Root className={className} style={style}>
      <BannerTab text={bannerText} />

      {/* A caller's box classes or style replace its own padding, as
          `containerClassName || "px-[8] py-[8]"` did; its border and corners
          stay on top of either. */}
      <Box
        className={containerClassName}
        base={
          containerClassName || containerStyle ? styles.box : styles.boxPadded
        }
        style={[
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
      </Box>
    </Root>
  )
}

export default BannerContainer
