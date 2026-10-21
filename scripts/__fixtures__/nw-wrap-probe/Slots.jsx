import React from "react"
import { TextInput } from "react-native"
import Animated from "react-native-reanimated"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import {
  ClassNameText,
  classNameSlot,
  lazyClassNameSlot,
} from "@tappler/shared/src/components/classNameSlots"
import { classNameSlot as lookAlike } from "./classNameSlots"
import BannerContainer from "components/BannerContainer"

// tappler-shared's slots over hosts that read style: ok
const Box = classNameSlot(DmView)
const Field = classNameSlot(TextInput)
const Placeholder = lazyClassNameSlot(() => Animated.Text)
const Label = ClassNameText

// A slot hands its host style, so the host decides: a consumer is a BUG,
// our own component is review.
const Title = classNameSlot(DmText)
const Framed = classNameSlot(BannerContainer)

// Not tappler-shared's slot module, or a host it can't read: review.
const Imposter = lookAlike(DmView)
const Unreadable = lazyClassNameSlot(() => pick())

export const Slots = ({ a, b }) => (
  <Box className="mt-[4]">
    <Field className="text-14" />
    <Placeholder className="text-12" />
    <Label className={a} fontClassName={a}>
      a
    </Label>
    <ClassNameText className="mt-[2]" fontClassName="mt-[2]">
      b
    </ClassNameText>
    <Title className="text-16">c</Title>
    <Framed className="mt-[8]" />
    <Imposter className="mt-[8]" />
    <Unreadable className="mt-[8]" />
    {/* ClassNameText without the class string again as fontClassName, or
        with another one: a caller's font and Arabic leading are lost */}
    <Label className={a}>d</Label>
    <Label className={a} fontClassName={b}>
      e
    </Label>
  </Box>
)

// A same-file function of the same name is just a call.
export const Shadowed = () => {
  const classNameSlot = (Host) => Host
  const Inner = classNameSlot(DmView)
  return <Inner className="mt-[8]" />
}
