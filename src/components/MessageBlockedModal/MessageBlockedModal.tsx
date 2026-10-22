import React from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import NativeActionSheet from "components/NativeActionSheet/NativeActionSheet"

import WarningTriangleIcon from "assets/icons/warning-triangle.svg"
import { Text, Button, a } from "@tappler/shared/src/ds"
import styles from "./styles"

interface Props {
  isVisible: boolean
  /** Localized explanation of why the message was blocked. */
  description: string
  /** Swipe-down, dim tap or Android back. */
  onClose: () => void
  /** The Edit message button. Falls back to onClose. */
  onEdit?: () => void
  /** Once the sheet has fully left the screen, after any close. */
  onClosed?: () => void
}

/**
 * Bottom sheet shown when a chat message is blocked by moderation (profanity
 * or contact-info policy). The blocked text is restored into the input by the
 * caller, which can use onEdit + onClosed to put the user back in it. One
 * native sheet (NativeActionSheet) on both platforms.
 */
const MessageBlockedModal: React.FC<Props> = ({
  isVisible,
  description,
  onClose,
  onEdit,
  onClosed,
}) => {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const content = (
    <DmView
      style={[styles.box, a.items_center, a.px_24, a.pt_28, { paddingBottom: insets.bottom + 16 }]}
    >
      <WarningTriangleIcon width={48} height={43} />
      <Text size={13} leading="loose" align="center" style={a.mt_16}>
        {description}
      </Text>
      <Button
        title={t("edit_message")}
        onPress={onEdit ?? onClose}
        size="lg"
        shape="r5"
        variant="dark"
        labelWeight="semibold"
        style={[a.w_full, a.mt_20]}
      />
    </DmView>
  )

  /*
   * One presentation, both platforms. NativeActionSheet is the wrapper that owns
   * the short-sheet push-back scale and derives the dim from whether the content
   * draws its own background, so none of that is passed here any more.
   *
   * Android used to fork onto react-native-modal below. This and LeaveReviewModal were
   * the last two surfaces in the app doing that, and the fork bought nothing:
   * the native sheet presents on Android
   * too, self-sizes the same way, and handles the drag, the dim and the back key
   * itself. It also cost the react-native-modal back-button trap — that library
   * swallows back unless onBackButtonPress is passed, which is the kind of thing
   * a per-platform branch quietly gets wrong.
   */
  return (
    <NativeActionSheet isVisible={isVisible} onClose={onClose} onClosed={onClosed}>
      {content}
    </NativeActionSheet>
  )
}

export default MessageBlockedModal
