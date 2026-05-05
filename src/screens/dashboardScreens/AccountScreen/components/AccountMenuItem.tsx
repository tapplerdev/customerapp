import React from "react"
import { I18nManager } from "react-native"
import { SvgProps } from "react-native-svg"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import ChevronRightIcon from "assets/icons/chevron-right.svg"
import colors from "@tappler/shared/src/styles/colors"

interface Props {
  Icon: React.FC<SvgProps>
  label: string
  onPress?: () => void
  accessory?: "chevron" | "text" | "none"
  accessoryText?: string
  textVariant?: "default" | "red"
  showSeparator?: boolean
}

const AccountMenuItem: React.FC<Props> = ({
  Icon,
  label,
  onPress,
  accessory = "chevron",
  accessoryText,
  textVariant = "default",
  showSeparator = true,
}) => {
  return (
    <DmView onPress={onPress}>
      <DmView className="h-[50] flex-row items-center justify-between px-[24]">
        <DmView className="flex-row items-center">
          <DmView className="w-[50] items-start justify-center">
            <Icon width={24} height={24} />
          </DmView>
          <DmText
            className={`text-13 leading-[16px] font-custom500 ${
              textVariant === "red" ? "text-red" : "text-black"
            }`}
          >
            {label}
          </DmText>
        </DmView>

        {accessory === "chevron" && (
          <DmView style={I18nManager.isRTL ? { transform: [{ rotate: "180deg" }] } : undefined}>
            <ChevronRightIcon width={18} height={18} color={colors.grey20} />
          </DmView>
        )}
        {accessory === "text" && (
          <DmText className="text-13 leading-[16px] font-custom400 text-black">
            {accessoryText}
          </DmText>
        )}
      </DmView>

      {showSeparator && (
        <DmView
          className="border-b-1 border-b-grey19"
          style={{ marginEnd: 15 }}
        />
      )}
    </DmView>
  )
}

export default AccountMenuItem
