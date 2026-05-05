import React from "react"
import { DmView } from "@tappler/shared/src/components/UI"
import clsx from "clsx"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"
import styles from "./styles"

interface ImageWithTextButtonProps {
  label: string
  imageUrl: string
  isSelected: boolean
  onPress: () => void
  className?: string
}

const ImageWithTextButton: React.FC<ImageWithTextButtonProps> = ({
  imageUrl,
  isSelected,
  onPress,
  className,
}) => {
  return (
    <DmView onPress={onPress} className={clsx(className)}>
      <DmView
        className={clsx(
          isSelected ? "bg-pink" : "bg-white"
        )}
        style={[styles.borderBase, { borderColor: isSelected ? "#CC0000" : "#D9D9D9" }]}
      >
        {imageUrl ? (
          <DmView style={styles.scaledImage}>
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
  )
}

export default ImageWithTextButton
