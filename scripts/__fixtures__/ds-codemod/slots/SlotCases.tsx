// Rule 5: a *className on one of our components becomes its style slot only
// when the component declares that slot where the className lands.
import React from "react"

import { DmView } from "@tappler/shared/src/components/UI"

import Box from "./Box"
import Card from "./Card"
import Plain from "./Plain"
import Ruled from "./Ruled"
import Titled from "./Titled"

type Props = { raised: boolean }

const SlotCases: React.FC<Props> = ({ raised }) => (
  <DmView>
    <Card
      title="slots"
      className={raised ? "mt-[8] rounded-10" : "mt-[8]"}
      titleClassName="mt-[2] text-red"
    />
    {/* left: typography in a slot that lands on a text */}
    <Card title="typography" titleClassName="text-16 leading-[19px]" />
    {/* left: `style` lands elsewhere */}
    <Box className="mt-[8] bg-grey7" />
    {/* left: no slot yet */}
    <Plain className="mt-[8]" />
    {/* a typed prop for what the component reads out of its className
        (@dsFromClass), on a className slot (@dsSlot) */}
    <Ruled className="mt-[8] border-0">ruled off</Ruled>
    <Ruled className="mt-[8]">ruled</Ruled>
    {/* a proapp text slot: spacing and colour to its style twin,
        typography to its *Type twin */}
    <Titled title="spaced" classNameTitle="mt-[2] text-red" />
    <Titled title="sized" classNameTitle="text-13 leading-[16px]" />
  </DmView>
)

export default SlotCases

export const cases = [
  { name: "flat", props: { raised: false } },
  { name: "raised", props: { raised: true } },
]

export const expected = {
  converted: 6,
  left: { "typography-in-text-slot": 1, "waiting-on-component": 2 },
  dropped: [],
  removedImports: [],
}
