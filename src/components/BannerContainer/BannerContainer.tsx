import React from "react"
import { ViewStyle } from "react-native"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import styles from "./styles"

// The banner's red tab: the text in white capitals, rounded on top, from the
// start edge (left in English, right in Arabic). BannerContainer draws it over
// its box, and OffersSection's strip over the pro card's sticker band, so the
// card labels the stickers the way the profile page does.
//
// It takes no className. NativeWind's babel plugin turns a className given to
// one of this app's own components into a style prop and drops the className,
// so a caller that needs to move the tab wraps it in a DmView.
export const BannerTab: React.FC<{ text: string }> = ({ text }) => (
  <DmView className="flex-row justify-start">
    <DmView
      className="bg-red px-[4] py-[2]"
      style={styles.tabRadius}
    >
      <DmText className="text-white text-10 font-custom700">
        {text.toUpperCase()}
      </DmText>
    </DmView>
  </DmView>
)

interface BannerContainerProps {
  bannerText: string
  children: React.ReactNode
  className?: string
  containerClassName?: string
  containerStyle?: ViewStyle
  borderRadius?: number
}

const BannerContainer: React.FC<BannerContainerProps> = ({
  bannerText,
  children,
  className = "",
  containerClassName = "",
  containerStyle,
  borderRadius = 10,
}) => {
  return (
    <DmView className={className}>
      <BannerTab text={bannerText} />

      <DmView
        className={`bg-white ${containerClassName || "px-[8] py-[8]"}`}
        style={{
          borderWidth: 0.5,
          borderColor: colors.grey6,
          borderBottomRightRadius: borderRadius,
          borderBottomLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
          ...containerStyle,
        }}
      >
        {children}
      </DmView>
    </DmView>
  )
}

export default BannerContainer
