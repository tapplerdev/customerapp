// Declares `style`, but it lands on the inner view while `className` styles
// the outer one: its className call sites must wait.
import React from "react"
import type { StyleProp, ViewStyle } from "react-native"

import { DmView } from "@tappler/shared/src/components/UI"

interface Props {
  className?: string
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
}

const Box: React.FC<Props> = ({ className, style, children }) => (
  <DmView className={className}>
    <DmView style={style}>{children}</DmView>
  </DmView>
)

export default Box
