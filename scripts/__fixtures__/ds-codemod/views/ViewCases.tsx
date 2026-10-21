// Rule 3 (DmView and the hosts NativeWind styles at the call site) and rule 4
// (conditions). Rendered before and after the codemod by
// scripts/ds-codemod/parity/fixtures.parity.js.
import React from "react"
import { I18nManager, Image, ScrollView, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Animated, { useAnimatedStyle } from "react-native-reanimated"
import clsx from "clsx"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

const ROW = "flex-row items-center justify-between"

type Props = { open: boolean; index: number; tone: "red" | "grey" }

const ViewCases: React.FC<Props> = ({ open, index, tone }) => {
  const fade = useAnimatedStyle(() => ({ opacity: open ? 1 : 0 }))
  return (
    <SafeAreaView className="flex-1 bg-white" style={{ paddingBottom: 12 }}>
      {/* atoms where an atom is the output, a StyleSheet entry for the rest */}
      <DmView className="flex-1 px-[20] pt-[17] bg-grey52 rounded-5">
        <DmText className="text-13 leading-[16px] font-custom400">a box</DmText>
      </DmView>
      {/* a constant string, and the element's own style kept last */}
      <DmView className={ROW} style={{ marginTop: index }} />
      {/* NativeWind's order: a specific edge beats an axis, whatever order */}
      <DmView className="pl-[10] px-[20]" />
      <DmView className="px-[20] pl-[10]" />
      {/* conditions: &&, a ternary, an object, in clsx order */}
      <DmView
        className={clsx(
          "border-b-1 border-grey4",
          open && "pb-[20]",
          tone === "red" ? "bg-red" : "bg-grey7",
          { "opacity-[0.4]": index > 2 }
        )}
      />
      {/* transforms in one part join as NativeWind joins them */}
      <DmView
        className={clsx(
          I18nManager.isRTL && "rotate-[180deg] scale-y-[-1] items-end"
        )}
      />
      {/* transforms in two parts: NativeWind joins, an array would keep the
          last, so the codemod writes one style per combination */}
      <DmView className={clsx("rotate-[90deg]", open && "scale-x-[-1]")} />
      {/* an animated style stays last and unflattened */}
      <Animated.View
        className="absolute w-full mt-[4]"
        style={[{ zIndex: 3 }, fade]}
      />
      {/* React Native hosts */}
      <View className="h-[1] bg-grey19" />
      <Image
        className="w-[24] h-[24] rounded-full"
        source={{ uri: "https://example.com/x.png" }}
      />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }} />
      {/* dropped today: rendered nothing, so the codemod writes nothing */}
      <DmView className="flex-between" />
      {/* left: a class that styles its children */}
      <DmView className="flex-row gap-[8]" />
    </SafeAreaView>
  )
}

export default ViewCases

export const cases = [
  {
    name: "closed, first, red",
    props: { open: false, index: 0, tone: "red" as const },
  },
  {
    name: "open, fourth, grey",
    props: { open: true, index: 3, tone: "grey" as const },
  },
]

export const expected = {
  converted: 14,
  left: { "unresolvable-class": 1 },
  dropped: ["flex-between"],
  removedImports: ["clsx"],
}
