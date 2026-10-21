// A slot the structural check can't follow (it reaches the style through a
// local), declared by its author with a doc tag the codemod reads.
import React from "react"
import type { StyleProp, ViewStyle } from "react-native"
import clsx from "clsx"

import { DmView } from "@tappler/shared/src/components/UI"

interface Props {
  className?: string
  /** On the box, where className lands; wins over className. @dsSlot className */
  boxStyle?: StyleProp<ViewStyle>
  children?: React.ReactNode
}

const Tagged: React.FC<Props> = ({ className, boxStyle, children }) => {
  const composed = [boxStyle]
  return (
    <DmView className={clsx("p-[4]", className)} style={composed}>
      {children}
    </DmView>
  )
}

export default Tagged
