// Takes a class prop it never draws, as customerapp's RateComponent (:16)
// and SearchBar (:19) do: a call site's classes there are dead, so they wait
// for a person to delete them.
import React from "react"

import { DmView } from "@tappler/shared/src/components/UI"

interface Props {
  className?: string
  starClassName?: string
}

const Dropping: React.FC<Props> = ({ className, starClassName }) => (
  <DmView className={className} />
)

export default Dropping
