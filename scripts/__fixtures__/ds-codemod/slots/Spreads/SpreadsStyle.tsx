// Reads `style` as a plain ViewStyle, spread into an object (BannerContainer's
// containerStyle shape): NativeWind hands a wrapped call site's className
// over as a style array, which spreads to index keys, so it draws nothing
// here today (review-ca-w0, the T re-check's L1).
import React from "react"
import type { ViewStyle } from "react-native"

import { DmView } from "@tappler/shared/src/components/UI"

interface Props {
  style?: ViewStyle
  children?: React.ReactNode
}

const SpreadsStyle: React.FC<Props> = ({ style, children }) => (
  <DmView style={{ borderWidth: 1, ...style }}>{children}</DmView>
)

export default SpreadsStyle
