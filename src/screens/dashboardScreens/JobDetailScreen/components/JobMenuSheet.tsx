import React from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

import NativeActionSheet from "components/NativeActionSheet/NativeActionSheet"

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
    // Native sheet on iOS (the screen behind recedes), react-native-modal on
    // Android — the house wrapper, and what the pro app's equivalent menu uses.
    // No explicit height: the content is static, so the native self-measure is
    // reliable here (the attachment sheet passes one only because its
    // camera-roll strip settles after first layout).
    //
    // onClose fires on a native user-dismiss only, never on isVisible=false, so
    // the row handlers must close the sheet themselves — both callers already
    // do, then wait out the dismissal before presenting anything else.
    <NativeActionSheet isVisible={isVisible} onClose={onClose}>
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
    </NativeActionSheet>
  )
}

export default JobMenuSheet
