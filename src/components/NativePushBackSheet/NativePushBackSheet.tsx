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
  pushBackScale?: number
  children: ReactNode
}

const NativePushBackSheet: React.FC<Props> = ({
  visible,
  height,
  onDismissed,
  pushBackScale,
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
        onDismissed={onDismissed}
        style={{ position: "absolute", width: 0, height: 0 }}
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
