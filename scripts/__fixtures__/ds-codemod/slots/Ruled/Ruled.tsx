// A proapp component written the way W2a-0 gives one a typed prop for what
// it parses out of its className: SettingsItem draws its bottom rule unless
// the caller's classes say `border-0`. Callers still passing classes keep
// that; a converted caller says `separator={false}`. The slot and the parse
// are stated in the props' docs (@dsSlot, @dsFromClass), which is what the
// codemod reads.
import React from "react"
import type { StyleProp, ViewStyle } from "react-native"
import clsx from "clsx"

import { DmView } from "@tappler/shared/src/components/UI"
import { classNameSlot } from "@tappler/shared/src/components/classNameSlots"

// The caller's classes after the row's own (classNameSlots.ts).
const Row = classNameSlot(DmView)

interface Props {
  className?: string
  /** The row, after className. @dsSlot className */
  style?: StyleProp<ViewStyle>
  /**
   * The rule under the row; `border-0` in className took it away.
   * @dsFromClass className border-0 false
   */
  separator?: boolean
  children?: React.ReactNode
}

const Ruled: React.FC<Props> = ({ className, style, separator, children }) => {
  const ruled = separator ?? !className?.includes("border-0")
  return (
    <DmView>
      <Row className={className} style={style}>
        {children}
      </Row>
      <DmView className={clsx("h-[1] bg-grey19", !ruled && "h-[0]")} />
    </DmView>
  )
}

export default Ruled
