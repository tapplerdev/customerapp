import React from "react"
import type { StyleProp, ViewStyle } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import LegacyText from "@tappler/shared/src/components/LegacyText"
import type { NoShorthands } from "@tappler/shared/src/components/classStyles"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"
import styles from "./styles"
import { a } from "@tappler/shared/src/ds"

interface ImageWithCheckmarkButtonProps {
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

const ImageWithCheckmarkButton: React.FC<ImageWithCheckmarkButtonProps> = ({
  imageUrl,
  isSelected,
  onPress,
  style,
}) => {
  return (
    <DmView onPress={onPress} style={style}>
      <DmView
        style={[
          a.px_12,
          a.py_8,
          isSelected ? styles.boxWrapSelected : styles.boxWrapNotSelected,
          styles.borderBase,
          { borderColor: isSelected ? "#CC0000" : "#D9D9D9" },
        ]}
      >
        {/* NativeWind's gap-[8] drew -8 left and top on the row and 8 left
            and top on each child; styles.gapRow / gapChild draw the same. */}
        <DmView style={[a.flex_row, a.items_center, styles.gapRow]}>
          {/* The checkmark: LegacyText draws what the DmText here drew; ds
              Text takes no fontWeight in its style (pass 2, latent-bugs). */}
          {isSelected && (
            <LegacyText style={[styles.checkmarkText, styles.gapChild]}>
              ✓
            </LegacyText>
          )}

          {imageUrl ? (
            <DmView style={[styles.imageContainer, styles.gapChild]}>
              <SvgUriContainer uri={imageUrl} width={100} />
            </DmView>
          ) : (
            <DmView style={[styles.box, styles.gapChild]} />
          )}
        </DmView>
      </DmView>
    </DmView>
  )
}

export default ImageWithCheckmarkButton
