import React, { ReactNode, useState } from "react"
import {
  Dimensions,
  LayoutChangeEvent,
  Platform,
  View,
  ViewStyle,
  requireNativeComponent,
} from "react-native"

interface NativeProps {
  visible: boolean
  sheetHeight?: number
  pushBackScale?: number
  dimOpacity?: number
  transparentBackground?: boolean
  onDismissed?: () => void
  style?: ViewStyle
  children?: ReactNode
}

// Native iOS sheet with the "push-back" presentation (the screen behind
// recedes — scales down, rounds corners, dims) that stock iOS only offers at
// the large detent. Backed by TapplerSheetPresentationController in
// ios/tappler_customer_app/TapplerSheet/. iOS-only: callers keep their
// existing bottom sheet on Android.
const RCTTapplerSheet =
  Platform.OS === "ios" ? requireNativeComponent<NativeProps>("TapplerSheetView") : null

interface Props {
  visible: boolean
  /**
   * Sheet height in pts, including any bottom safe-area padding the content
   * renders. Omit to self-size: the content is measured via onLayout (it is
   * always mounted, so the measurement lands before the sheet first opens).
   */
  height?: number
  /** Fired when the user closes the sheet natively (dim tap / swipe down). */
  onDismissed: () => void
  /**
   * How far the screen behind recedes, as a scale factor. 1.0 is no recede.
   *
   * Defaults to 0.97 here rather than the native 0.92: an 8% shrink reads as
   * the chat screen being shoved into the distance, which is much heavier than
   * the effect is meant to be. Note the top edge lands in the same place
   * either way — pushBackTransformForView pins it to `topInset - 16` — so a
   * higher scale does not move the card, it just shrinks it less.
   */
  pushBackScale?: number
  /** Dim layer opacity behind the sheet (native default 0.4). */
  dimOpacity?: number
  /** Clear native sheet background: content draws its own surfaces, so parts
   *  of it (e.g. a header) can float visually on the dim layer. */
  transparentBackground?: boolean
  children: ReactNode
}

const NativePushBackSheet: React.FC<Props> = ({
  visible,
  height,
  onDismissed,
  pushBackScale = 0.97,
  dimOpacity,
  transparentBackground,
  children,
}) => {
  const [measuredHeight, setMeasuredHeight] = useState(0)

  const autoSize = height == null
  const resolvedHeight = autoSize ? measuredHeight : height ?? 0

  if (!RCTTapplerSheet) return null

  const windowWidth = Dimensions.get("window").width

  const handleLayout = (e: LayoutChangeEvent) => {
    const next = Math.ceil(e.nativeEvent.layout.height)
    if (next !== measuredHeight) setMeasuredHeight(next)
  }

  // The host view is invisible (RCTModalHostView pattern): the child is
  // reparented into a natively presented controller, never rendered in-place.
  // The child MUST carry explicit width AND height — content laid out at
  // zero/auto size inside the reparented subtree breaks Text measurement and
  // FlatList virtualization, and onLayout does NOT fire in there either.
  //
  // Self-sizing therefore measures a hidden TWIN of the content rendered in
  // the normal RN tree (offscreen, non-interactive), where onLayout is
  // guaranteed, and feeds that height to the natively presented copy.
  return (
    <>
      {autoSize && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -10000,
            top: 0,
            width: windowWidth,
            opacity: 0,
          }}
          onLayout={handleLayout}
        >
          {children}
        </View>
      )}
      <RCTTapplerSheet
        visible={visible && resolvedHeight > 0}
        // Never send 0 — presenting with an unmeasured height would show an
        // empty sliver; the gate above keeps the sheet closed until measured.
        sheetHeight={resolvedHeight > 0 ? resolvedHeight : undefined}
        pushBackScale={pushBackScale}
        dimOpacity={dimOpacity}
        transparentBackground={transparentBackground}
        onDismissed={onDismissed}
        // Host width MUST equal the content width. RN keeps the reparented
        // content's shadow node as a child of THIS host, and under force-RTL
        // Yoga positions children from the parent's RIGHT edge — a width-0 host
        // places the content at x = 0 − contentWidth (off-screen left) → blank
        // sheet in Arabic. A full-width host places it at x = 0 in BOTH
        // directions. (RN's own <Modal> solves the identical problem natively
        // by feeding the presented VC bounds back via uiManager setSize; giving
        // the host the real width here is the JS equivalent — no native change.)
        style={{ position: "absolute", width: windowWidth, height: 0 }}
      >
        <View
          style={{
            width: windowWidth,
            ...(resolvedHeight > 0 ? { height: resolvedHeight } : {}),
          }}
        >
          {children}
        </View>
      </RCTTapplerSheet>
    </>
  )
}

export default NativePushBackSheet
