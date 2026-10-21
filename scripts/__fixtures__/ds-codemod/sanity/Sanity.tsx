// The parity run's control: these classes reach NativeWind only if this file
// is compiled as an in-content source (scripts/ds-codemod/parity/transformer.js).
import React from "react"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

export const SanityText = () => (
  <DmText className="text-20 leading-[24px] font-custom700">x</DmText>
)

export const SanityView = () => <DmView className="flex-1 px-[20]" />
