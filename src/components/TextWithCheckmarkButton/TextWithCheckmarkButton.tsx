import React from "react"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import clsx from "clsx"
import CheckmarkIcon from "assets/icons/check-mark.svg"

interface TextWithCheckmarkButtonProps {
  label: string
  isSelected: boolean
  onPress: () => void
  className?: string
}

const TextWithCheckmarkButton: React.FC<TextWithCheckmarkButtonProps> = ({
  label,
  isSelected,
  onPress,
  className,
}) => {
  return (
    <DmView
      onPress={onPress}
      className={clsx(
        "px-[20] py-[12] flex-row items-center self-start",
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
      {isSelected && (
        <DmView className="mr-[8]">
          <CheckmarkIcon width={14} height={14} fill="#000000" />
        </DmView>
      )}

      <DmText
        className={clsx(
          "text-11 font-custom500",
          isSelected ? "text-black" : "text-grey2"
        )}
        numberOfLines={1}
      >
        {label}
      </DmText>
    </DmView>
  )
}

export default TextWithCheckmarkButton
