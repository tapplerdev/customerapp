import React from "react"
import { useTranslation } from "react-i18next"

import { DmView } from "@tappler/shared/src/components/UI"
import NativeActionSheet from "components/NativeActionSheet/NativeActionSheet"

import LeaveReviewIcon from "assets/icons/leave-review.svg"
import { Text, Button, a } from "@tappler/shared/src/ds"
import styles from "./styles"

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
    <DmView style={[styles.box, a.px_24, a.pt_16, a.pb_40]}>
      {/* Close */}
      <DmView onPress={onClose} style={[a.mb_16, a.self_start]}>
        <Text size={20} weight="semibold" leading="legacy">✕</Text>
      </DmView>

      {/* Review icon */}
      <DmView style={[a.items_center, a.mb_16]}>
        <LeaveReviewIcon width={80} height={80} />
      </DmView>

      {/* Title */}
      <DmView style={[a.items_center, a.mb_24]}>
        <Text size={18} weight="semibold" leading="legacy" align="center">
          {t("how_was_your_service_for")}
        </Text>
        <Text size={18} weight="semibold" leading="legacy" color="brand" align="center" style={a.mt_4}>
          {categoryName}?
        </Text>
      </DmView>

      {/* Leave Review button */}
      <DmView style={a.px_40}>
        <Button
          title={t("leave_review")}
          onPress={onLeaveReview}
          label={14}
          labelWeight="semibold"
          labelLeading="legacy"
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
