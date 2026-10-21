// Rule 5 on tappler-shared's own twins, drawn: MainModal's card corners
// copied to its wrapper as `radius` (a token's value as it is, any other
// px()), and DmInput's h-[n] as `height`, out of containerStyle, which
// refuses it. Rendered before and after the codemod by
// scripts/ds-codemod/parity/fixtures.parity.js.
import React from "react"

import MainModal from "@tappler/shared/src/components/MainModal"
import { DmChecbox, DmInput, DmView } from "@tappler/shared/src/components/UI"

type Props = { open: boolean; filled: boolean }

const noop = () => undefined

const SharedCases: React.FC<Props> = ({ open, filled }) => (
  <DmView>
    <DmInput value="" onChangeText={noop} className="h-[63] w-full" />
    <MainModal
      isVisible={open}
      onClose={noop}
      title="Corners"
      className="px-[20] rounded-20"
      classNameWrapperHight="self-center"
    />
    <MainModal
      isVisible={open}
      onClose={noop}
      title="Token"
      className="rounded-10"
    />
    {/* *Type twins: a size class over the title's own px(27) is
        { legacy: px(27) }; the description's leading is a step */}
    <MainModal
      isVisible={open}
      onClose={noop}
      title="Sized"
      descr="Described"
      classNameTitle="mt-[0] text-15 font-custom600"
      classNameDescr="text-13 leading-[20px] font-custom400 text-grey2"
    />
    {/* a label's face and colour, a font class dropping its own face */}
    <DmChecbox
      isChecked
      onPress={noop}
      title="Checked"
      textClassName="text-13 font-custom600 text-grey2"
    />
    {/* a field's size, face and Arabic leading, and its placeholder's
        English leading, in one inputType */}
    <DmInput
      value={filled ? "typed" : ""}
      onChangeText={noop}
      placeholder="Name"
      inputClassName="text-15 leading-[19px] font-custom500 text-black"
      classNamePlaceholder="text-13 leading-[15px]"
    />
    {/* a regular face named in the field's classes: the placeholder that
        rises over the value draws it too (bold if the type left it out) */}
    <DmInput
      value={filled ? "typed" : ""}
      onChangeText={noop}
      placeholder="Street"
      inputClassName="text-13 leading-[16px] text-black font-custom400"
    />
  </DmView>
)

export default SharedCases

export const cases = [
  { name: "open, empty", props: { open: true, filled: false } },
  { name: "open, filled", props: { open: true, filled: true } },
]

export const expected = {
  converted: 10,
  left: {},
  dropped: ["fontSize in DmInput's placeholder class"],
  removedImports: [],
}
