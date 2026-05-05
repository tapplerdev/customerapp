import React from "react"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import clsx from "clsx"

interface ChipButtonProps {
  label: string
  isSelected: boolean
  onPress: () => void
  className?: string
}

const ChipButton: React.FC<ChipButtonProps> = ({
  label,
  isSelected,
  onPress,
  className,
}) => {
  return (
    <DmView
      onPress={onPress}
      className={clsx(
        "px-[20] py-[12] self-start",
        isSelected
          ? "bg-pink"
          : "bg-white",
        className
      )}
      style={{
        borderColor: isSelected ? "#CC0000" : "#000000",
        borderWidth: 0.75,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <DmText
        className={clsx(
          "text-15 font-custom500 text-center",
          isSelected ? "text-black" : "text-grey2"
        )}
        numberOfLines={1}
      >
        {label}
      </DmText>
    </DmView>
  )
}

export default ChipButton
