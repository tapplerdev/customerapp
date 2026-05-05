import React from "react"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import TriangleIcon from "assets/svg/TriangleIcon"
import colors from "@tappler/shared/src/styles/colors"

interface MapPinPickerProps {
  showInstruction?: boolean
  instructionText?: string
  pinSize?: "small" | "medium" | "large"
  className?: string
}

const MapPinPicker: React.FC<MapPinPickerProps> = ({
  showInstruction = true,
  instructionText,
  pinSize = "medium",
  className = "",
}) => {
  const { t } = useTranslation()

  const pinSizes = {
    small: {
      background: "w-[36] h-[36]",
      pinHead: "w-[20] h-[20]",
      pinDot: "w-[4] h-[4] mt-[5] ml-[5]",
      pinStick: "w-[2] h-[24]",
      offset: "pb-[42]",
    },
    medium: {
      background: "w-[46] h-[46]",
      pinHead: "w-[28] h-[28]",
      pinDot: "w-[6] h-[6] mt-[7] ml-[7]",
      pinStick: "w-[2] h-[30]",
      offset: "pb-[54]",
    },
    large: {
      background: "w-[56] h-[56]",
      pinHead: "w-[36] h-[36]",
      pinDot: "w-[8] h-[8] mt-[9] ml-[9]",
      pinStick: "w-[3] h-[36]",
      offset: "pb-[66]",
    },
  }

  const pinColors = {
    background: "bg-blue2",
    pinHead: "bg-red6",
    pinDot: "bg-red7",
    pinStick: "bg-red6",
  }

  const currentSize = pinSizes[pinSize]
  const defaultInstruction = t(
    "move_the_screen_and_position_the_pin_over_your_location"
  )

  return (
    <DmView
      className={`w-full h-full items-center justify-center ${className}`}
    >
      <DmView
        className={`${currentSize.background} rounded-full ${pinColors.background}`}
      />

      <DmView className="absolute left-0 top-0 right-0 bottom-0 items-center justify-center">
        <DmView className={`items-center ${currentSize.offset}`}>
          <DmView
            className={`${currentSize.pinHead} rounded-full ${pinColors.pinHead}`}
          >
            <DmView
              className={`${currentSize.pinDot} rounded-full ${pinColors.pinDot}`}
            />
          </DmView>
          <DmView className={`${currentSize.pinStick} ${pinColors.pinStick}`} />
        </DmView>
      </DmView>

      {showInstruction && (
        <DmView className="absolute left-[30] top-0 right-[30] bottom-0 items-center justify-center">
          <DmView className="w-full items-center pb-[200]">
            <DmView className="w-full bg-grey57 h-[64] mb-[-8] items-center">
              <DmText className="w-full mt-[10] text-white text-center text-13 leading-[18px] font-custom400">
                {instructionText || defaultInstruction}
              </DmText>
            </DmView>
            <TriangleIcon width={30} direction="down" color={colors.grey57} />
          </DmView>
        </DmView>
      )}
    </DmView>
  )
}

export default MapPinPicker
