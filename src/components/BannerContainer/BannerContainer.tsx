import React from "react"
import { ViewStyle } from "react-native"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import styles from "./styles"

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
      <DmView className="flex-row justify-start">
        <DmView
          className="bg-red px-[4] py-[2]"
          style={styles.tabRadius}
        >
          <DmText className="text-white text-10 font-custom700">
            {bannerText.toUpperCase()}
          </DmText>
        </DmView>
      </DmView>

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
