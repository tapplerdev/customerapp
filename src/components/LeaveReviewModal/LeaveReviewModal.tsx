import React from "react"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import NativeActionSheet from "components/NativeActionSheet/NativeActionSheet"

import LeaveReviewIcon from "assets/icons/leave-review.svg"

interface Props {
  isVisible: boolean
  onClose: () => void
  onLeaveReview: () => void
  categoryName: string
}

const LeaveReviewModal: React.FC<Props> = ({
  isVisible,
  onClose,
  onLeaveReview,
  categoryName,
}) => {
  const { t } = useTranslation()

  const content = (
    <DmView className="bg-white rounded-t-20 px-[24] pt-[16] pb-[40]">
      {/* Close */}
      <DmView onPress={onClose} className="mb-[16] self-start">
        <DmText className="text-20 font-custom600 text-black">✕</DmText>
      </DmView>

      {/* Review icon */}
      <DmView className="items-center mb-[16]">
        <LeaveReviewIcon width={80} height={80} />
      </DmView>

      {/* Title */}
      <DmView className="items-center mb-[24]">
        <DmText className="text-18 font-custom600 text-black text-center">
          {t("how_was_your_service_for")}
        </DmText>
        <DmText className="text-18 font-custom600 text-red text-center mt-[4]">
          {categoryName}?
        </DmText>
      </DmView>

      {/* Leave Review button */}
      <DmView className="px-[40]">
        <ActionBtn
          title={t("leave_review")}
          onPress={onLeaveReview}
          textClassName="text-14 font-custom600"
        />
      </DmView>
    </DmView>
  )

  /*
   * One presentation, both platforms. NativeActionSheet is the wrapper that owns
   * the short-sheet push-back scale and derives the dim from whether the content
   * draws its own background, so none of that is passed here any more.
   *
   * Android used to fork onto react-native-modal below. This and MessageBlockedModal were
   * the last two surfaces in the app doing that, and the fork bought nothing:
   * the native sheet presents on Android
   * too, self-sizes the same way, and handles the drag, the dim and the back key
   * itself. It also cost the react-native-modal back-button trap — that library
   * swallows back unless onBackButtonPress is passed, which is the kind of thing
   * a per-platform branch quietly gets wrong.
   */
  return (
    <NativeActionSheet isVisible={isVisible} onClose={onClose}>
      {content}
    </NativeActionSheet>
  )
}

export default LeaveReviewModal
