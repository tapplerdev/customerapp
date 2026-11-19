// style-ratchet fixture: what is counted, and what is not. Never imported.
import React from "react"
import { StyleSheet, View } from "react-native"

declare const Text: React.FC<any>
declare const DmView: React.FC<any>
declare const DmText: React.FC<any>
declare const MainModal: React.FC<any>
declare const Button: React.FC<any>
declare const px: (n: number) => number
declare const isAr: boolean
declare const RULE_WEIGHT: number
declare const Svg: React.FC<any>

const theme = { px }

export const Counted = () => (
  <DmView className="flex-1 bg-white">
    <DmText className="text-14" textClassName="font-custom600" classNameTitle="mt-[4]">
      a
    </DmText>
    <Text leading="legacy" family="system" style={{ marginTop: px(3), paddingLeft: theme.px(5) }}>
      b
    </Text>
    <Text style={{ color: "#fff", backgroundColor: true ? "rgba(0, 0, 0, 0.4)" : "white" }} />
    <DmText leading={isAr ? "legacy" : undefined} family={isAr ? "latin" : "system"}>
      c
    </DmText>
    <DmText leading={isAr ? "tight" : "normal"} family={`latin`}>
      d
    </DmText>
    <Text leading={{ fixed: px(20) }}>g</Text>
    <Text leading={{ legacy: px(27) }}>h</Text>
    <MainModal titleType={{ size: 15, leading: { legacy: px(27) } }} descrType={{ size: 13, leading: "legacy", family: "system" }} />
    <MainModal titleType={{ size: 13, leading: { fixed: px(16) } }} descrType={{ size: 13, leading: "tight" }} />
    <Button title="e" labelLeading="legacy" />
    <Button title="f" labelLeading={{ legacy: px(14) }} />
  </DmView>
)

export const styles = StyleSheet.create({
  card: { shadowColor: "#000000", borderTopColor: `#CC0000` },
})

// Thin lines, counted: a border width on any side, a height or a width, a
// number below 1 or StyleSheet.hairlineWidth.
export const lines = StyleSheet.create({
  rule: { height: 0.7 },
  outline: { borderWidth: 0.75, borderBottomWidth: StyleSheet.hairlineWidth },
  upright: { width: 0.3 },
})

// Not counted as thin lines: a whole number, RULE_WEIGHT, a percentage, zero,
// an opacity, a stroke, and a minimum.
export const notLines = StyleSheet.create({
  box: { height: 1, borderWidth: RULE_WEIGHT, width: "50%", borderTopWidth: 0 },
  faint: { opacity: 0.5, minHeight: 0.5 },
})
export const Icon = () => <Svg strokeWidth={0.7} />

// Not counted: a colour prop on an element, transparent, a key that isn't a
// colour, a destructuring default, a type, a non-legacy leading, a call that
// isn't px.
type Tone = "#ffffff"
export const NotCounted = ({ tint = "#123456" }: { tint?: Tone | string }) => (
  <View>
    <Text leading="tight" family="latin" style={{ borderColor: "transparent", width: Number("4") }}>
      {tint}
    </Text>
    <View pointerEvents="none" style={{ margin: 2, opacity: 0.5 }} />
  </View>
)
