// What the nw-resolve sweep must find in a file: every static class string
// in a className, className* or *ClassName attribute, and nothing else.
import React from "react"
import { View } from "react-native"
import clsx from "clsx"

import Card from "./Card"

export const Sites = ({ on, isAr, off, n }) => (
  <>
    <View className="mt-[4] px-[8]" />
    <View
      className={clsx("flex-row", isAr && "flex-row-reverse", {
        "opacity-50": off,
      })}
    />
    <View className={on ? "bg-red" : "bg-grey4"} />
    <View className={`items-center`} />
    <View className={`w-[${n}]`} />
    <Card contentClassName="p-[12]" classNameText="text-14" />
    <View testID="not-a-class" accessibilityLabel={on ? "a" : "b"} />
  </>
)
