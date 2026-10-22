import React from "react"
import { TextInput } from "react-native"
import { useTranslation } from "react-i18next"

import { MainModal } from "@tappler/shared/src/components"
import { DmView } from "@tappler/shared/src/components/UI"
import CancelFeedbackIcon from "assets/icons/cancel-feedback.svg"
import { Text, Button, a } from "@tappler/shared/src/ds"
import styles from "./styles"

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
  /** The card has finished closing. Whatever comes next (the cancelled
   *  confirmation, the error) opens from here, not beside the close: a
   *  modal presented while this one is still fading out can fail to show on
   *  iOS, or leave an invisible window over the screen. */
  onModalHide?: () => void
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
  onModalHide,
  cancel,
}) => {
  const { t } = useTranslation()
  // Nothing closes the card while the cancel is in flight, so it is still up
  // when the result lands and the caller's onModalHide handoff always runs.
  const close = cancel.isSubmitting ? undefined : onClose

  return (
    <MainModal
      bare
      isVisible={isVisible}
      onClose={onClose}
      preventBackdropPressable={cancel.isSubmitting}
      onBackButtonPress={close}
      onModalHide={onModalHide}
      modalStyle={[a.px_0, a.items_center]}
      /*
       * The reason field is MULTILINE, so its return key inserts a newline
       * rather than dismissing, and Submit sits directly beneath it — so
       * without this the keyboard covered the button with no way to get it
       * back, and the cancellation could not be completed.
       *
       * `avoidKeyboard` shifts the whole card up, which is the right tool for a
       * short CENTRED dialog: there is room above and nothing pinned to the
       * bottom edge to fight over. It is iOS-only in effect — MainModal's
       * KeyboardAvoidingView uses 'padding' on iOS and nothing on Android —
       * and on Android 14 and below that is fine, because this app mounts no
       * KeyboardProvider so the manifest's adjustResize still shrinks the
       * window. Android 15+ draws the dialog edge-to-edge (forced at targetSdk
       * 36), where adjustResize may not reach it: check Submit on a device.
       */
      avoidKeyboard
    >
      {/* Unstyled on purpose: centred by the frame and sized to its content,
          with the card's self-stretch filling only this box. That is the
          width the card had under react-native-modal, which applied the
          centring to both of its own wrappers. */}
      <DmView>
        <DmView style={[a.mx_24, styles.box]}>
          {/* Close X — outside modal card */}
          {/* `disabled`, not a missing onPress: DmView swaps between a
              touchable and a plain View on onPress, which would remount it. */}
          <DmView
            style={[a.self_end, a.mb_10]}
            onPress={onClose}
            disabled={cancel.isSubmitting}
          >
            <Text size={22} leading="legacy" color="inverse" family="system">✕</Text>
          </DmView>

          <DmView style={[styles.list, a.px_20, a.pt_24, a.pb_20]}>
            <DmView style={a.items_center}>
              <CancelFeedbackIcon width={60} height={60} />
            </DmView>

            <Text size={16} weight="bold" leading="legacy" align="center" style={a.mt_12}>
              {t("your_opinion_matters")}
            </Text>

            <Text size={13} weight="semibold" leading="legacy" style={a.mt_12}>
              {t("what_is_reason_cancellation")}
            </Text>

            {cancel.cancelReasons.map((reason) => (
              <DmView
                key={reason}
                style={[a.flex_row, a.items_center, a.mt_12]}
                onPress={() => cancel.toggleReason(reason)}
              >
                <DmView
                  style={[
                    styles.box2,
                    a.border_1,
                    a.items_center,
                    a.justify_center,
                    cancel.selectedReasons.includes(reason) ? styles.boxReason : styles.boxNotReason,
                  ]}
                >
                  {cancel.selectedReasons.includes(reason) && (
                    <DmView style={styles.box3} />
                  )}
                </DmView>
                <Text size={13} leading="legacy" style={[a.ml_10, a.flex_1]}>
                  {t(reason)}
                </Text>
              </DmView>
            ))}

            {cancel.hasOtherSelected && (
              <TextInput
                value={cancel.otherReasonText}
                onChangeText={cancel.setOtherReasonText}
                placeholder={t("write_other_reason")}
                placeholderTextColor="#999"
                multiline
                style={[a.mt_12, a.border_1, styles.input, a.px_12, a.py_10, { textAlignVertical: "top" }]}
              />
            )}

            <DmView style={a.mt_16}>
              <Button
                title={t("submit")}
                onPress={cancel.handleSubmitCancel}
                disabled={!cancel.canSubmit}
                isLoading={cancel.isSubmitting}
                size="sm"
                label="sm"
                labelWeight="semibold"
                labelLeading="legacy"
              />
            </DmView>
          </DmView>
        </DmView>
      </DmView>
    </MainModal>
  )
}

export default CancelJobFeedbackModal
