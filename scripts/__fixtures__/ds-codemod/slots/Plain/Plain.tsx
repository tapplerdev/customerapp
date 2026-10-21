// Takes a className and nothing else yet.
import React from "react"

import { DmView } from "@tappler/shared/src/components/UI"

interface Props {
  className?: string
}

const Plain: React.FC<Props> = ({ className }) => (
  <DmView className={className} />
)

export default Plain
