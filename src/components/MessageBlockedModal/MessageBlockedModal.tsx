import React from "react"
import { Platform } from "react-native"
import Modal from "react-native-modal"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import NativePushBackSheet, {
  BOTTOM_SHEET_PUSH_BACK_SCALE,
} from "@tappler/shared/src/components/NativePushBackSheet/NativePushBackSheet"

import WarningTriangleIcon from "assets/icons/warning-triangle.svg"

interface Props {
  isVisible: boolean
  /** Localized explanation of why the message was blocked. */
  description: string
  onClose: () => void
}

/**
 * Bottom sheet shown when a chat message is blocked by moderation (profanity
 * or contact-info policy). The blocked text is restored into the input by the
 * caller, so "Edit message" just dismisses. iOS uses the native push-back
 * presentation (screen behind recedes), matching LeaveReviewModal; Android
 * keeps react-native-modal.
 */
const MessageBlockedModal: React.FC<Props> = ({ isVisible, description, onClose }) => {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const content = (
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
  )

  // iOS: native push-back presentation, self-sizing to the content.
  if (Platform.OS === "ios") {
    return (
      <NativePushBackSheet
        visible={isVisible}
        onDismissed={onClose}
        pushBackScale={BOTTOM_SHEET_PUSH_BACK_SCALE}
      >
        {content}
      </NativePushBackSheet>
    )
  }

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
      {content}
    </Modal>
  )
}

export default MessageBlockedModal
