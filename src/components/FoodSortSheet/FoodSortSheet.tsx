import React from "react"
import { Modal, Platform } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import NativePushBackSheet from "components/NativePushBackSheet/NativePushBackSheet"
import CheckMarkIcon from "assets/icons/check-mark.svg"

export type SortValue = "distance" | "rating" | "responseTime" | undefined

const OPTIONS: { value: SortValue; label: string }[] = [
  { value: undefined, label: "sort_default" },
  { value: "distance", label: "sort_distance" },
  { value: "rating", label: "sort_review_score" },
  { value: "responseTime", label: "sort_response_time" },
]

interface Props {
  visible: boolean
  value: SortValue
  onSelect: (value: SortValue) => void
  onClose: () => void
}

// iOS presents inside the native push-back sheet (matching Filters); Android
// falls back to a bottom modal.
const FoodSortSheet: React.FC<Props> = ({ visible, value, onSelect, onClose }) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const body = (
    <DmView
      className="bg-white"
      style={{ paddingTop: 18, paddingBottom: insets.bottom + 12 }}
    >
      <DmText className="px-[20] text-18 leading-[23px] font-custom700 mb-[6]">
        {t("sort_by")}
      </DmText>
      {OPTIONS.map((opt) => {
        const selected = value === opt.value
        return (
          <DmView
            key={opt.value ?? "default"}
            onPress={() => onSelect(opt.value)}
            className="px-[20] py-[16] flex-row items-center justify-between border-t-0.5 border-t-grey19"
          >
            <DmText
              className={
                selected
                  ? "text-15 leading-[19px] font-custom700 text-red"
                  : "text-15 leading-[19px] font-custom400 text-black"
              }
            >
              {t(opt.label)}
            </DmText>
            {selected && <CheckMarkIcon width={16} height={16} color={colors.red} />}
          </DmView>
        )
      })}
    </DmView>
  )

  if (Platform.OS === "ios") {
    return (
      <NativePushBackSheet visible={visible} onDismissed={onClose}>
        {body}
      </NativePushBackSheet>
    )
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <DmView
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        onPress={onClose}
      >
        <DmView className="rounded-t-20 overflow-hidden" onPress={() => {}}>
          {body}
        </DmView>
      </DmView>
    </Modal>
  )
}

export default FoodSortSheet
