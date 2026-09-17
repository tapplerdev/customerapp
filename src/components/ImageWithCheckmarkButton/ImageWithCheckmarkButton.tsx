import React from "react"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import clsx from "clsx"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"
import styles from "./styles"

interface ImageWithCheckmarkButtonProps {
  label: string
  imageUrl: string
  isSelected: boolean
  onPress: () => void
  className?: string
}

const ImageWithCheckmarkButton: React.FC<ImageWithCheckmarkButtonProps> = ({
  imageUrl,
  isSelected,
  onPress,
  className,
}) => {
  return (
    <DmView onPress={onPress} className={clsx(className)}>
      <DmView
        className={clsx(
          "px-[12] py-[8]",
          isSelected ? "bg-pink" : "bg-white"
        )}
        style={[styles.borderBase, { borderColor: isSelected ? "#CC0000" : "#D9D9D9" }]}
      >
        <DmView className="flex-row items-center gap-[8]">
          {isSelected && (
            <DmText style={styles.checkmarkText}>✓</DmText>
          )}

          {imageUrl ? (
            <DmView style={styles.imageContainer}>
              <SvgUriContainer
                uri={imageUrl}
                width={100}
              />
            </DmView>
          ) : (
            <DmView className="w-[60] h-[60] bg-grey29 rounded-[8]" />
          )}
        </DmView>
      </DmView>
    </DmView>
  )
}

export default ImageWithCheckmarkButton
