import React from "react"
import { Platform } from "react-native"
import Modal from "react-native-modal"

import NativePushBackSheet, {
  BOTTOM_SHEET_PUSH_BACK_SCALE,
} from "@tappler/shared/src/components/NativePushBackSheet/NativePushBackSheet"

interface Props {
  isVisible: boolean
  /**
   * Dismissal handler. On iOS this fires only on a native user-dismiss
   * (swipe-down / dim-tap) — NOT on a programmatic `isVisible=false` — so in-sheet
   * buttons should run their own close logic. On Android it fires on
   * backdrop-press / swipe-down.
   */
  onClose: () => void
  /**
   * Fixed sheet height in pts, iOS only. Omit to self-size — the native sheet
   * measures a hidden twin of the content. Pass it when that measurement is
   * unreliable, e.g. content with a lazily-populated camera-roll strip whose
   * height settles after first layout. Android's modal is content-sized either
   * way, so it ignores this.
   */
  height?: number
  /**
   * How far the screen behind recedes. Defaults to the short-sheet value;
   * near-full sheets should pass NEAR_FULL_PUSH_BACK_SCALE. iOS only.
   */
  pushBackScale?: number
  /** Clear the native container so a header can float on the dim. iOS only. */
  transparentBackground?: boolean
  /** Backdrop darkness. Raise it when content puts white text on the dim. */
  dimOpacity?: number
  children: React.ReactNode
}

/**
 * Bottom action sheet for the chat restriction / moderation popups. iOS gets
 * the native push-back presentation (the screen behind recedes) to match
 * customerapp's LeaveReviewModal; Android keeps react-native-modal. Content
 * self-sizes (no height prop) and supplies its own bg/rounded-top container,
 * exactly like the modals it replaces.
 */
const NativeActionSheet: React.FC<Props> = ({
  isVisible,
  onClose,
  height,
  pushBackScale = BOTTOM_SHEET_PUSH_BACK_SCALE,
  transparentBackground,
  dimOpacity,
  children,
}) => {
  if (Platform.OS === "ios") {
    return (
      <NativePushBackSheet
        visible={isVisible}
        height={height}
        onDismissed={onClose}
        pushBackScale={pushBackScale}
        transparentBackground={transparentBackground}
        dimOpacity={dimOpacity}
      >
        {children}
      </NativePushBackSheet>
    )
  }

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      className="m-0 justify-end"
      animationIn="slideInUp"
      animationOut="slideOutDown"
      hardwareAccelerated
      statusBarTranslucent
      backdropOpacity={dimOpacity}
      backdropTransitionOutTiming={0}
      hideModalContentWhileAnimating
    >
      {children}
    </Modal>
  )
}

export default NativeActionSheet
