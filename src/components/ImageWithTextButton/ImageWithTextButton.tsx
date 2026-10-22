import React from "react"
import type { StyleProp, ViewStyle } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { type NoShorthands } from "@tappler/shared/src/ds"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"
import styles from "./styles"

interface ImageWithTextButtonProps {
  label: string
  imageUrl: string
  isSelected: boolean
  onPress: () => void
  /**
   * The answer, as a style. Like every twin it takes one key per side or
   * corner (see NoShorthands).
   */
  style?: StyleProp<ViewStyle & NoShorthands>
}

const ImageWithTextButton: React.FC<ImageWithTextButtonProps> = ({
  imageUrl,
  isSelected,
  onPress,
  style,
}) => {
  return (
    <DmView onPress={onPress} style={style}>
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
    </DmView>
  )
}

export default ImageWithTextButton
