import React from "react"
import Modal from "react-native-modal"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

import DetailsIcon from "assets/icons/details-icon.svg"
import TrashRedIcon from "assets/icons/trash-red.svg"

interface Props {
  isVisible: boolean
  onClose: () => void
  onShowDetails: () => void
  // Omitted when cancelling is no longer self-serve. The two flows disagree on
  // both the wording and the rule — a service request is cancellable while the
  // job is active, a food order only until the kitchen starts preparing — so
  // the caller supplies both rather than this guessing.
  cancelLabel?: string
  onCancel?: () => void
}

// The header ••• menu, shared by the regular-service and food-order bodies of
// JobDetailScreen. It lived inline in the regular branch, which returns after
// the food branch — so the food path could not reach it and grew a lookalike
// that drifted on icon and dot sizing. One component, no drift.
const JobMenuSheet: React.FC<Props> = ({
  isVisible,
  onClose,
  onShowDetails,
  cancelLabel,
  onCancel,
}) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      className="m-0 justify-end"
      animationIn="slideInUp"
      animationOut="slideOutDown"
      hardwareAccelerated
      statusBarTranslucent
      backdropTransitionOutTiming={0}
      hideModalContentWhileAnimating
    >
      <DmView
        className="bg-white rounded-t-12"
        style={{ paddingBottom: insets.bottom + 2 }}
      >
        <DmView className="self-center w-[40] h-[4] rounded-full bg-grey19 mt-[10] mb-[14]" />

        <DmView
          className="flex-row items-center px-[18] py-[14]"
          onPress={onShowDetails}
        >
          <DetailsIcon width={20} height={24} />
          <DmText className="ml-[14] text-14 leading-[18px] font-custom500 text-black">
            {t("my_request_details")}
          </DmText>
        </DmView>

        {!!onCancel && (
          <>
            <DmView
              className="h-[0.7] bg-grey19"
              style={{ marginStart: 18 }}
            />
            <DmView
              className="flex-row items-center px-[18] py-[14]"
              onPress={onCancel}
            >
              <TrashRedIcon width={20} height={24} />
              <DmText className="ml-[14] text-14 leading-[18px] font-custom500 text-black">
                {cancelLabel}
              </DmText>
            </DmView>
          </>
        )}
      </DmView>
    </Modal>
  )
}

export default JobMenuSheet
