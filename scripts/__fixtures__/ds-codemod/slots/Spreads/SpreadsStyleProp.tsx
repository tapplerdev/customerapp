// SpreadsStyle with `style` typed StyleProp: it takes an array, and spreads
// what it gets into an object, so only an array draws what NativeWind's does.
import React from "react"
import type { StyleProp, ViewStyle } from "react-native"

import { DmView } from "@tappler/shared/src/components/UI"

interface Props {
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
}

const SpreadsStyleProp: React.FC<Props> = ({ style, children }) => (
  <DmView style={{ borderWidth: 1, ...(style as ViewStyle) }}>{children}</DmView>
)

export default SpreadsStyleProp
