import React from "react"
import Modal from "react-native-modal"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"

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

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      style={{ justifyContent: "flex-end", margin: 0 }}
    >
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
    </Modal>
  )
}

export default LeaveReviewModal
