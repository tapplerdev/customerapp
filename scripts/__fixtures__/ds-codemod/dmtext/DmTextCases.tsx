// Rule 1 (DmText -> ds Text), one element per behaviour. Rendered before and
// after the codemod by scripts/ds-codemod/parity/fixtures.parity.js.
import React from "react"
import { StyleSheet } from "react-native"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { takeFontFamily } from "@tappler/shared/src/helpers/helpers"

const local = StyleSheet.create({
  muted: { opacity: 0.5 },
  big: { fontSize: 22 },
  retry: { color: "#FFFFFF", fontSize: 13, textDecorationLine: "underline" },
  heavy: { fontSize: 13, fontWeight: "700" },
})

type Props = { active: boolean; small: boolean }

const DmTextCases: React.FC<Props> = ({ active, small }) => {
  const { i18n } = useTranslation()
  return (
    <DmView>
      {/* a step, a colour token, the language's face */}
      <DmText className="text-13 leading-[16px] font-custom600 text-red">
        tight semibold brand
      </DmText>
      {/* a leading that is no step: px() scaled x1.32 in Arabic */}
      <DmText className="text-13 leading-[22px] font-custom400">px 22</DmText>
      {/* no leading: the config default, unscaled in Arabic (legacy) */}
      <DmText className="text-16 font-custom500 text-grey2">legacy 19</DmText>
      {/* no className at all: the guard's 14/22 */}
      <DmText>bare</DmText>
      {/* a colour that is no token goes to style; centred */}
      <DmText className="text-12 leading-[16px] font-custom700 text-grey28 text-center">
        palette colour
      </DmText>
      {/* no font class: the system face */}
      <DmText className="text-14 leading-[20px] text-right">system face</DmText>
      {/* a tailwind face that ignores the language (proapp's case was
          font-sans400, TheSans-Plain there; customerapp's font-sans700 is
          the shipped TheSans-Bold) */}
      <DmText className="text-12 leading-[16px] font-sans700">
        TheSans both
      </DmText>
      {/* left: customerapp's font-sans400 is TheSans-Regular, which it
          doesn't ship (WelcomeScreen.tsx:83): a bridge by hand */}
      <DmText className="text-13 leading-[22px] font-sans400">
        TheSans-Regular
      </DmText>
      {/* customerapp's font-custom800 (AuthGateScreen.tsx:71): no face in
          either language, the system face, listed with the drops */}
      <DmText className="text-24 leading-[30px] font-custom800 text-center">
        no 800
      </DmText>
      {/* spacing and a caller style kept after the class styles */}
      <DmText
        className="mt-[10] px-[15] text-15 leading-[22px] font-custom500"
        style={local.muted}
        numberOfLines={2}
      >
        style kept
      </DmText>
      {/* nested runs */}
      <DmText className="text-13 leading-[20px] font-custom400">
        outer <DmText className="font-custom700 text-red">inner</DmText>
      </DmText>
      {/* conditions: weight and colour per state, a margin per size */}
      <DmText
        className={clsx(
          "text-13 leading-[16px]",
          active ? "font-custom600 text-black" : "font-custom400 text-grey2",
          small && "mb-[4]"
        )}
      >
        conditional
      </DmText>
      {/* a size per state, a template literal */}
      <DmText
        className={`${small ? "text-11 leading-[14px]" : "text-13 leading-[16px]"} font-custom500`}
      >
        size per state
      </DmText>
      {/* dropped today: font-400 and a unitless leading render nothing */}
      <DmText className="text-13 leading-[20] font-400 flex-between">
        dropped
      </DmText>
      {/* typography in style: classes, then style, then the font layer */}
      <DmText className="text-13 font-custom400" style={local.big}>
        style 22 over text-13
      </DmText>
      {/* the guard's 22 under the style's 13; the rest kept as written */}
      <DmText
        style={{
          fontSize: 13,
          color: active ? "#737385" : "#000000",
          marginLeft: 4,
        }}
      >
        style size, colour as written
      </DmText>
      {/* classes, and a style with its own line height and colour */}
      <DmText
        className="mt-[2] font-custom400"
        style={{
          fontSize: 11,
          lineHeight: 14,
          color: "#8C8C8C",
          textAlign: "left",
        }}
      >
        style 11/14
      </DmText>
      {/* a StyleSheet entry: its colour and underline written again */}
      <DmText className="font-custom600" style={local.retry}>
        retry
      </DmText>
      {/* a face the font layer draws over: it renders nothing today */}
      <DmText style={{ fontSize: 14, fontFamily: "monospace" }}>
        monospace
      </DmText>
      {/* takeFontFamily, per language and pinned to Arabic */}
      <DmText
        className="text-13"
        style={takeFontFamily("font-custom600", i18n.language)}
      >
        helper per language
      </DmText>
      <DmText
        className="text-12"
        style={takeFontFamily("font-custom400", "ar")}
      >
        helper pinned
      </DmText>
      {/* a weight in style stays; a style's own line height is n in both
        languages: { fixed: px(n) } */}
      <DmText style={local.heavy}>left: fontWeight</DmText>
      <DmText
        className="font-custom400"
        style={{ fontSize: 13, lineHeight: 16 }}
      >
        fixed 16 in Arabic too
      </DmText>
      {/* an off-scale size: px(25), with its own px leading */}
      <DmText className="text-25 leading-[30px] font-custom600">
        left: size 25
      </DmText>
      {/* left: pressable */}
      <DmText className="text-13 font-custom500" onPress={() => undefined}>
        left: pressable
      </DmText>
    </DmView>
  )
}

export default DmTextCases

export const cases = [
  { name: "inactive, large", props: { active: false, small: false } },
  { name: "active, small", props: { active: true, small: true } },
]

export const expected = {
  converted: 23,
  left: {
    "fontWeight-in-style": 1,
    "pressable-dmtext": 1,
    "unshipped-face": 1,
  },
  dropped: [
    "leading-[20]",
    "font-400",
    "flex-between",
    'style fontFamily: "monospace"',
    "font-custom800",
  ],
  removedImports: ["clsx", "takeFontFamily"],
}
