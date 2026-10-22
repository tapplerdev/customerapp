import React from "react"
import { I18nManager } from "react-native"
import { SvgProps } from "react-native-svg"

import { DmView } from "@tappler/shared/src/components/UI"
import ChevronRightIcon from "assets/icons/chevron-right.svg"
import colors from "@tappler/shared/src/styles/colors"
import { Text, a } from "@tappler/shared/src/ds"
import styles from "./styles"

interface Props {
  Icon: React.FC<SvgProps>
  label: string
  onPress?: () => void
  accessory?: "chevron" | "text" | "none"
  accessoryText?: string
  textVariant?: "default" | "brand"
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
      <DmView style={[styles.row, a.flex_row, a.items_center, a.justify_between, a.px_24]}>
        <DmView style={[a.flex_row, a.items_center]}>
          <DmView style={[styles.iconWrap, a.items_start, a.justify_center]}>
            <Icon width={24} height={24} />
          </DmView>
          <Text
            size={13}
            weight="medium"
            leading="tight"
            color={textVariant === "brand" ? "brand" : "primary"}
          >
            {label}
          </Text>
        </DmView>

        {accessory === "chevron" && (
          <DmView style={I18nManager.isRTL ? { transform: [{ rotate: "180deg" }] } : undefined}>
            <ChevronRightIcon width={18} height={18} color={colors.grey20} />
          </DmView>
        )}
        {accessory === "text" && (
          <Text size={13} leading="tight">
            {accessoryText}
          </Text>
        )}
      </DmView>

      {showSeparator && (
        <DmView
          style={[a.border_b_1, styles.box, { marginEnd: 15 }]}
        />
      )}
    </DmView>
  )
}

export default AccountMenuItem
