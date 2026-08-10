import React from "react"
import Modal from "react-native-modal"
import { TextInput } from "react-native"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import CancelFeedbackIcon from "assets/icons/cancel-feedback.svg"

type CancelState = {
  cancelReasons: readonly string[]
  selectedReasons: string[]
  toggleReason: (reason: string) => void
  otherReasonText: string
  setOtherReasonText: (text: string) => void
  handleSubmitCancel: () => void
  isSubmitting: boolean
  hasOtherSelected: boolean
  canSubmit: boolean
}

interface Props {
  isVisible: boolean
  onClose: () => void
  /** The useCancelJob return value. The hook stays with the caller so each
   *  screen owns what happens after a successful cancel. */
  cancel: CancelState
}

/**
 * "Why are you cancelling?" — the last step before the request is actually
 * cancelled, and the only place the reasons are collected.
 *
 * Lifted out of JobDetailScreen so the chat can reach it too. It was ~80 lines
 * inline there, which is exactly the shape that grows a second, slightly
 * different copy the moment a second screen needs it — the same way the food
 * branch grew its own ••• menu before JobMenuSheet existed.
 */
const CancelJobFeedbackModal: React.FC<Props> = ({
  isVisible,
  onClose,
  cancel,
}) => {
  const { t } = useTranslation()

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      className="m-0 items-center justify-center"
      animationIn="fadeIn"
      animationOut="fadeOut"
      backdropTransitionOutTiming={0}
    >
      <DmView className="mx-[24] self-stretch">
        {/* Close X — outside modal card */}
        <DmView className="self-end mb-[10]" onPress={onClose}>
          <DmText className="text-22 text-white">✕</DmText>
        </DmView>

        <DmView className="bg-white rounded-12 px-[20] pt-[24] pb-[20]">
          <DmView className="items-center">
            <CancelFeedbackIcon width={60} height={60} />
          </DmView>

          <DmText className="mt-[12] text-16 font-custom700 text-black text-center">
            {t("your_opinion_matters")}
          </DmText>

          <DmText className="mt-[12] text-13 font-custom600 text-black">
            {t("what_is_reason_cancellation")}
          </DmText>

          {cancel.cancelReasons.map((reason) => (
            <DmView
              key={reason}
              className="flex-row items-center mt-[12]"
              onPress={() => cancel.toggleReason(reason)}
            >
              <DmView
                className={`w-[22] h-[22] rounded-full border-1 items-center justify-center ${
                  cancel.selectedReasons.includes(reason)
                    ? "border-red"
                    : "border-grey1"
                }`}
              >
                {cancel.selectedReasons.includes(reason) && (
                  <DmView className="w-[12] h-[12] rounded-full bg-red" />
                )}
              </DmView>
              <DmText className="ml-[10] text-13 font-custom400 text-black flex-1">
                {t(reason)}
              </DmText>
            </DmView>
          ))}

          {cancel.hasOtherSelected && (
            <TextInput
              value={cancel.otherReasonText}
              onChangeText={cancel.setOtherReasonText}
              placeholder={t("write_other_reason")}
              placeholderTextColor="#999"
              multiline
              className="mt-[12] border-1 border-grey5 rounded-4 px-[12] py-[10] text-13 min-h-[70]"
              style={{ textAlignVertical: "top" }}
            />
          )}

          <DmView className="mt-[16]">
            <ActionBtn
              title={t("submit")}
              onPress={cancel.handleSubmitCancel}
              disable={!cancel.canSubmit}
              isLoading={cancel.isSubmitting}
              className="h-[42]"
              textClassName="text-13 font-custom600"
            />
          </DmView>
        </DmView>
      </DmView>
    </Modal>
  )
}

export default CancelJobFeedbackModal
