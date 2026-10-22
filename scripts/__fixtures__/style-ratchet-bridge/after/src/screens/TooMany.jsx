import React from "react"
import { DmView } from "@tappler/shared/src/components/UI"
import LT from "@tappler/shared/src/components/LegacyText"
import { default as Legacy } from "@tappler/shared/src/components/LegacyText/LegacyText"

export const TooMany = () => (
  <DmView>
    <LT>one</LT>
    <Legacy>two</Legacy>
  </DmView>
)
