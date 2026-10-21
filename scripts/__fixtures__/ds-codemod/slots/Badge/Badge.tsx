// A badge whose class prop draws something only a hand edit can say (the
// codemod's HAND_EDITS, empty in customerapp; its test adds one for this
// fixture). proapp's MyServiceDetailItem drew its white badge's red hairline
// this way.
import React from "react"

import { ActionBtn, DmView } from "@tappler/shared/src/components/UI"

interface Props {
  titleBtn: string
  btnVariant?: "white" | "grey"
  classNameBtn?: string
}

const Badge: React.FC<Props> = ({ titleBtn, btnVariant, classNameBtn }) => (
  <DmView>
    <ActionBtn title={titleBtn} variant={btnVariant} className={classNameBtn} />
  </DmView>
)

export default Badge
