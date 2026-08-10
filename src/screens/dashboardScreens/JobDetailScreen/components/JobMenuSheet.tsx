import React from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

import NativeActionSheet from "components/NativeActionSheet/NativeActionSheet"

import DetailsIcon from "assets/icons/details-icon.svg"
import TrashRedIcon from "assets/icons/trash-red.svg"
import BlockIcon from "assets/icons/block.svg"
import ComplaintIcon from "assets/icons/complaint.svg"

interface Props {
  isVisible: boolean
  onClose: () => void
  // Optional since the chat opens this menu too, and a direct message with no
  // job behind it has no request to show.
  onShowDetails?: () => void
  // Omitted when cancelling is no longer self-serve. The two flows disagree on
  // both the wording and the rule — a service request is cancellable while the
  // job is active, a food order only until the kitchen starts preparing — so
  // the caller supplies both rather than this guessing.
  cancelLabel?: string
  onCancel?: () => void
  // Chat only — the job screen is about a request, not about the person on the
  // other end of a conversation, so it passes neither.
  onBlock?: () => void
  onReport?: () => void
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
  onBlock,
  onReport,
}) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  // Same row style the pro app's sheet uses. marginStart is logical, so the gap
  // lands after the icon in both directions; textAlign "left" is swapped to the
  // right by RN under force-RTL, matching DmText's base.
  const rtlRow = { marginStart: 12, textAlign: "left" } as const

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
      {/* Styled to match the pro app's block/complaint sheet exactly, so the ***
          menu reads the same in both: padding on the container rather than the
          rows, no grabber (swipe-down still dismisses — the pan is on the whole
          sheet), no divider between rows, and each icon in a fixed 24pt column
          so the labels line up whatever the glyph's intrinsic width. */}
      <DmView
        className="bg-white rounded-t-12 px-[24] pt-[20]"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        {!!onShowDetails && (
          <DmView
            className="flex-row items-center py-[14]"
            onPress={onShowDetails}
          >
            <DmView className="w-[24] items-center">
              <DetailsIcon width={20} height={24} />
            </DmView>
            {/* marginStart, not ml-: logical, so it becomes a right-hand gap
                under force-RTL without pre-flipping. textAlign left for the
                same reason — RN swaps it in Arabic. */}
            <DmText
              className="text-14 leading-[18px] font-custom400 text-black"
              style={rtlRow}
            >
              {t("my_request_details")}
            </DmText>
          </DmView>
        )}

        {!!onCancel && (
          <DmView
            className="flex-row items-center py-[14]"
            onPress={onCancel}
          >
            <DmView className="w-[24] items-center">
              <TrashRedIcon width={20} height={24} />
            </DmView>
            <DmText
              className="text-14 leading-[18px] font-custom400 text-black"
              style={rtlRow}
            >
              {cancelLabel}
            </DmText>
          </DmView>
        )}

        {!!onBlock && (
          <DmView className="flex-row items-center py-[14]" onPress={onBlock}>
            <DmView className="w-[24] items-center">
              <BlockIcon width={20} height={20} />
            </DmView>
            <DmText
              className="text-14 leading-[18px] font-custom400 text-black"
              style={rtlRow}
            >
              {t("block_pro")}
            </DmText>
          </DmView>
        )}

        {!!onReport && (
          <DmView className="flex-row items-center py-[14]" onPress={onReport}>
            <DmView className="w-[24] items-center">
              <ComplaintIcon width={18} height={20} />
            </DmView>
            <DmText
              className="text-14 leading-[18px] font-custom400 text-black"
              style={rtlRow}
            >
              {t("file_a_complain_against_pro")}
            </DmText>
          </DmView>
        )}
      </DmView>
    </NativeActionSheet>
  )
}

export default JobMenuSheet
