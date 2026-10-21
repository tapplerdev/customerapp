// Rule 2 (ActionBtn -> ds Button): looks the Button parity draws (real
// sites' and its hand looks), so each converts, and three that can't.
// Rendered before and after the codemod by
// scripts/ds-codemod/parity/fixtures.parity.js.
import React from "react"
import clsx from "clsx"

import { ActionBtn, DmView } from "@tappler/shared/src/components/UI"

type Props = {
  isValid: boolean
  saving: boolean
  small: boolean
  little: boolean
}

const onPress = () => undefined
const Glyph = () => <DmView className="w-[12] h-[12] bg-black" />

const FORM = "h-[47] rounded-5"
const FORM_LABEL = "text-13 leading-[16px] font-custom600"

const ActionBtnCases: React.FC<Props> = ({
  isValid,
  saving,
  small,
  little,
}) => (
  <DmView>
    {/* ActionBtn's own defaults */}
    <ActionBtn title="Save" onPress={onPress} />
    {/* the form button, ActionBtn's disabled grey */}
    <ActionBtn
      title="Save"
      onPress={onPress}
      disable={!isValid}
      className="h-[47] rounded-5"
      textClassName="text-13 leading-[16px] font-custom600"
    />
    {/* MyAccountEmailScreen: the design's grey and grey label, one condition */}
    <ActionBtn
      title="Send"
      onPress={onPress}
      disable={!isValid}
      className={clsx("mt-[21] h-[44] rounded-10", !isValid && "bg-grey16")}
      textClassName={clsx(
        "text-13 leading-[16px] font-custom500",
        !isValid && "text-grey10"
      )}
    />
    {/* VerifyScreenComponent: the grey label a weight lighter */}
    <ActionBtn
      title="Verify"
      onPress={onPress}
      disable={!isValid}
      className={clsx("h-[44] rounded-10", !isValid && "bg-grey16")}
      textClassName={clsx(
        "text-13 leading-[16px] font-custom500",
        !isValid && "text-grey10 font-custom400"
      )}
    />
    {/* saving: the spinner on ActionBtn's grey */}
    <ActionBtn
      title="Save"
      onPress={onPress}
      isLoading={saving}
      className="h-[47] rounded-5"
      textClassName="text-13 leading-[16px] font-custom600"
    />
    {/* MyAccountResetPasswordScreen: letter-spacing on the label */}
    <ActionBtn
      title="Send code"
      onPress={onPress}
      className="h-[44] rounded-10"
      textClassName="text-13 leading-[16px] font-custom600 tracking-[0.65px]"
    />
    {/* variants: white, and white with no edge and a red label (onRed) */}
    <ActionBtn
      title="Cancel"
      onPress={onPress}
      variant="white"
      disable={!isValid}
      className={FORM}
      textClassName={FORM_LABEL}
    />
    <ActionBtn
      title="Retry"
      onPress={onPress}
      variant="white"
      className={`${FORM} border-0`}
      textClassName={`${FORM_LABEL} text-red`}
    />
    {/* the content props: icons at the end and near the title, a second
        title and a description */}
    <ActionBtn
      title="Next"
      onPress={onPress}
      className={FORM}
      textClassName={FORM_LABEL}
      Icon={<Glyph />}
      isIconRight
      IconNearTitle={<Glyph />}
    />
    <ActionBtn
      title="Total"
      onPress={onPress}
      variant="yellow"
      className={FORM}
      textClassName={FORM_LABEL}
      Icon={<Glyph />}
      titleSecond="120 EGP"
      descr="incl. VAT"
    />
    {/* FoodMenuSectionMenuItem's badge: no onPress, the label a size
        smaller on small phones, ActionBtn's legacy line height then */}
    <ActionBtn
      title="New"
      className="h-[20] self-auto bg-red2 rounded-4 px-[8]"
      classNameTextWrapper="mx-[0]"
      textClassName={clsx(
        "text-11 leading-[14px] font-custom700 text-white",
        small && "text-10",
        little && "text-9"
      )}
    />
    {/* left: an icon in one state only (PaymentSheet's shape) */}
    <ActionBtn
      title="Pay"
      onPress={onPress}
      className={FORM}
      textClassName={FORM_LABEL}
      Icon={saving ? <Glyph /> : undefined}
    />
    {/* left: a padding class Button has no prop for */}
    <ActionBtn title="Tall" onPress={onPress} className="h-[47] py-[4]" />
    {/* left: a look the parity hasn't drawn (white on ActionBtn's defaults) */}
    <ActionBtn title="White" onPress={onPress} variant="white" />
  </DmView>
)

export default ActionBtnCases

export const cases = [
  {
    name: "valid, idle",
    props: { isValid: true, saving: false, small: false, little: false },
  },
  {
    name: "invalid, idle, a small phone",
    props: { isValid: false, saving: false, small: true, little: false },
  },
  {
    name: "valid, saving, a little phone",
    props: { isValid: true, saving: true, small: true, little: true },
  },
]

// Sites are class attributes (a bare element counts once).
export const expected = {
  converted: 23,
  left: {
    "actionbtn-unsupported-prop": 2,
    "actionbtn-look": 1,
    "unproven-look": 1,
  },
  dropped: [],
  removedImports: ["clsx"],
}
