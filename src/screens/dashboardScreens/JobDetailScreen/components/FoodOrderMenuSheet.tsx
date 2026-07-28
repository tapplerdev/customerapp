import React from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import NativeActionSheet from "components/NativeActionSheet/NativeActionSheet"

import JobDetailsIcon from "assets/icons/job-details.svg"
import TrashRedIcon from "assets/icons/trash-red.svg"

interface Props {
  isVisible: boolean
  onClose: () => void
  onShowDetails: () => void
  // Absent once the pro starts preparing — cancelling stops being self-serve,
  // so the row is dropped rather than shown disabled.
  onCancel?: () => void
}

// The header's ••• menu. Actions that are destructive or navigational belong
// behind it rather than sitting in the page body, which is why Cancel order
// moved out of the scroll view.
const FoodOrderMenuSheet: React.FC<Props> = ({
  isVisible,
  onClose,
  onShowDetails,
  onCancel,
}) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const row = (
    icon: React.ReactNode,
    label: string,
    onPress: () => void,
    isLast?: boolean
  ) => (
    <>
      <DmView className="flex-row items-center py-[18]" onPress={onPress}>
        {icon}
        <DmText className="ml-[14] text-15 leading-[19px] font-custom500">
          {label}
        </DmText>
      </DmView>
      {!isLast && <DmView className="h-[0.5] bg-grey19 ml-[38]" />}
    </>
  )

  return (
    <NativeActionSheet isVisible={isVisible} onClose={onClose}>
      <DmView
        className="bg-white rounded-t-12 px-[20] pt-[8]"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {row(
          <JobDetailsIcon width={24} height={24} />,
          t("my_request_details"),
          onShowDetails,
          !onCancel
        )}
        {!!onCancel &&
          row(<TrashRedIcon width={24} height={24} />, t("cancel_order"), onCancel, true)}
      </DmView>
    </NativeActionSheet>
  )
}

export default FoodOrderMenuSheet
