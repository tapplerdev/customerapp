import React from "react"
import type { StyleProp, ViewStyle } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { classNameSlot } from "@tappler/shared/src/components/classNameSlots"
import type { NoShorthands } from "@tappler/shared/src/components/classStyles"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"
import styles from "./styles"

// The answer as a slot: a caller's className lands where its classes did
// (see classNameSlots); it has no styles of its own.
const Answer = classNameSlot(DmView)

interface ImageWithTextButtonProps {
  label: string
  imageUrl: string
  isSelected: boolean
  onPress: () => void
  /** The answer, as classes. */
  className?: string
  /**
   * The answer, as a style, after `className`. Like every twin it takes one
   * key per side or corner (see NoShorthands).
   */
  style?: StyleProp<ViewStyle & NoShorthands>
}

const ImageWithTextButton: React.FC<ImageWithTextButtonProps> = ({
  imageUrl,
  isSelected,
  onPress,
  className,
  style,
}) => {
  return (
    <Answer onPress={onPress} className={className} style={style}>
      <DmView
        style={[
          isSelected ? styles.boxSelected : styles.boxNotSelected,
          styles.borderBase,
          { borderColor: isSelected ? "#CC0000" : "#D9D9D9" },
        ]}
      >
        {imageUrl ? (
          <DmView style={styles.scaledImage}>
            <SvgUriContainer uri={imageUrl} width={100} />
          </DmView>
        ) : (
          <DmView style={styles.box} />
        )}
      </DmView>
    </Answer>
  )
}

export default ImageWithTextButton
