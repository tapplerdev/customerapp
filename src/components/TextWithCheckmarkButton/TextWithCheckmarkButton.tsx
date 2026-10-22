import React from "react"
import type { StyleProp, ViewStyle } from "react-native"

import { DmView } from "@tappler/shared/src/components/UI"
import { Text, a, type NoShorthands } from "@tappler/shared/src/ds"

import styles from "./styles"
import CheckmarkIcon from "assets/icons/check-mark.svg"

interface TextWithCheckmarkButtonProps {
  label: string
  isSelected: boolean
  onPress: () => void
  /**
   * The button, as a style, after its own styles and before its own border,
   * which a caller's style never reaches. Like every twin it takes one key
   * per side or corner (see NoShorthands).
   */
  style?: StyleProp<ViewStyle & NoShorthands>
}

const TextWithCheckmarkButton: React.FC<TextWithCheckmarkButtonProps> = ({
  label,
  isSelected,
  onPress,
  style,
}) => {
  return (
    <DmView
      onPress={onPress}
      style={[
        styles.box,
        isSelected ? styles.boxSelected : styles.boxIdle,
        style,
        {
          borderColor: isSelected ? "#CC0000" : "#000000",
          borderWidth: 0.75,
          borderRadius: 10,
          overflow: "hidden",
        },
      ]}
    >
      {isSelected && (
        <DmView style={a.mr_8}>
          <CheckmarkIcon width={14} height={14} fill="#000000" />
        </DmView>
      )}

      <Text
        size={11}
        weight="medium"
        leading="legacy"
        color={isSelected ? "primary" : "secondary"}
        numberOfLines={1}
      >
        {label}
      </Text>
    </DmView>
  )
}

export default TextWithCheckmarkButton
