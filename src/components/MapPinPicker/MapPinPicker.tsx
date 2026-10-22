import React from "react"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import TriangleIcon from "assets/svg/TriangleIcon"
import colors from "@tappler/shared/src/styles/colors"
import { Text, a } from "@tappler/shared/src/ds"
import styles, { pinColors, pinSizes } from "./styles"
import { StyleSheet } from "react-native"

interface MapPinPickerProps {
  showInstruction?: boolean
  instructionText?: string
  pinSize?: "small" | "medium" | "large"
}

const MapPinPicker: React.FC<MapPinPickerProps> = ({
  showInstruction = true,
  instructionText,
  pinSize = "medium",
}) => {
  const { t } = useTranslation()

  // The pin's five parts, by size, and their colours (styles.ts: what the
  // 19-string table of classes drew).
  const currentSize = pinSizes[pinSize]
  const defaultInstruction = t(
    "move_the_screen_and_position_the_pin_over_your_location"
  )

  return (
    <DmView style={[a.w_full, a.h_full, a.items_center, a.justify_center]}>
      <DmView
        style={[currentSize.background, styles.rounded, pinColors.background]}
      />

      <DmView style={[StyleSheet.absoluteFill, a.items_center, a.justify_center]}>
        <DmView style={[a.items_center, currentSize.offset]}>
          <DmView
            style={[currentSize.pinHead, styles.rounded, pinColors.pinHead]}
          >
            <DmView
              style={[currentSize.pinDot, styles.rounded, pinColors.pinDot]}
            />
          </DmView>
          <DmView style={[currentSize.pinStick, pinColors.pinStick]} />
        </DmView>
      </DmView>

      {showInstruction && (
        <DmView style={[a.absolute, styles.boxWrap, a.items_center, a.justify_center]}>
          <DmView style={[a.w_full, a.items_center, styles.box]}>
            <DmView style={[a.w_full, styles.textWrap, a.items_center]}>
              <Text size={13} color="inverse" align="center" style={[a.w_full, a.mt_10]}>
                {instructionText || defaultInstruction}
              </Text>
            </DmView>
            <TriangleIcon width={30} direction="down" color={colors.grey57} />
          </DmView>
        </DmView>
      )}
    </DmView>
  )
}

export default MapPinPicker
