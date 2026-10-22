import React from "react"
import { DmView } from "@tappler/shared/src/components/UI"
import { Text, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

interface ChipButtonProps {
  label: string
  isSelected: boolean
  onPress: () => void
  /** Tighter padding + smaller label, to match the compact question list. */
  compact?: boolean
}

const ChipButton: React.FC<ChipButtonProps> = ({
  label,
  isSelected,
  onPress,
  compact,
}) => {
  return (
    <DmView
      onPress={onPress}
      style={[
        compact ? [a.px_14, a.py_8, a.self_start] : [a.px_20, a.py_12, a.self_start],
        isSelected ? styles.selected : styles.notSelected,
        {
          borderColor: isSelected ? "#CC0000" : "#000000",
          borderWidth: 0.75,
          borderRadius: 10,
          overflow: "hidden",
        },
      ]}
    >
      {/* The label's size is 15, or 13 compact, over the line height 15 drew
          (24, in both languages): a style's fontSize over `text-15`. */}
      <Text
        size={compact ? 13 : 15}
        leading={{ fixed: px(24) }}
        weight="medium"
        align="center"
        color={isSelected ? "primary" : "secondary"}
        numberOfLines={1}
      >
        {label}
      </Text>
    </DmView>
  )
}

export default ChipButton
