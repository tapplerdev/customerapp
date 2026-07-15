import React from "react"
import Modal from "react-native-modal"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"

import WarningTriangleIcon from "assets/icons/warning-triangle.svg"

interface Props {
  isVisible: boolean
  /** Localized explanation of why the message was blocked. */
  description: string
  onClose: () => void
}

/**
 * Bottom modal shown when a chat message is blocked by moderation (profanity
 * or contact-info policy) — ported from the proapp's moderation modal so both
 * apps present violations identically. The blocked text is restored into the
 * input by the caller, so "Edit message" just dismisses.
 */
const MessageBlockedModal: React.FC<Props> = ({ isVisible, description, onClose }) => {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      className="m-0 justify-end"
      animationIn="slideInUp"
      animationOut="slideOutDown"
      swipeDirection="down"
      onSwipeComplete={onClose}
      hardwareAccelerated
      statusBarTranslucent
      backdropTransitionOutTiming={0}
      hideModalContentWhileAnimating
    >
      <DmView
        className="bg-white rounded-t-12 items-center px-[24] pt-[28]"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <WarningTriangleIcon width={48} height={43} />
        <DmText className="mt-[16] text-13 leading-[20px] font-custom400 text-center">
          {description}
        </DmText>
        <ActionBtn
          title={t("edit_message")}
          onPress={onClose}
          className="w-full mt-[20] bg-black rounded-5 h-[47]"
          textClassName="font-custom600"
        />
      </DmView>
    </Modal>
  )
}

export default MessageBlockedModal
