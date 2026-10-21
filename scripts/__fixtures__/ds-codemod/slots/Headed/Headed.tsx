// A header whose className reaches its root through a style the codemod
// can't follow, after `bordered` and `gutter`, which each win over it
// (proapp's HeaderOnboarding). Its slot is stated in the codemod's KNOWN
// table, empty in customerapp; its test adds one for this fixture.
import React from "react"
import type { StyleProp, ViewStyle } from "react-native"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

interface Props {
  title: string
  bordered?: boolean
  gutter?: boolean
  className?: string
  style?: StyleProp<ViewStyle>
}

const rootOf = (bordered?: boolean, gutter?: boolean) => [
  bordered ? { borderBottomWidth: 1 } : null,
  gutter ? { paddingLeft: 16, paddingRight: 16 } : null,
]

const Headed: React.FC<Props> = ({
  title,
  bordered,
  gutter,
  className,
  style,
}) => (
  <DmView className={className} style={[...rootOf(bordered, gutter), style]}>
    <DmText>{title}</DmText>
  </DmView>
)

export default Headed
