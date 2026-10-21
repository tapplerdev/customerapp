// Skeleton once a style twin is added (plan section 1c's W1 twins): the root
// takes `style`, so the style NativeWind makes of a wrapped call site's
// className starts drawing.
import React from "react"
import type { StyleProp, ViewStyle } from "react-native"

import { DmView } from "@tappler/shared/src/components/UI"

interface Props {
  width: number
  height: number
  style?: StyleProp<ViewStyle>
}

const SkeletonTwinned: React.FC<Props> = ({ width, height, style }) => (
  <DmView style={[{ width, height }, style]} />
)

export default SkeletonTwinned
