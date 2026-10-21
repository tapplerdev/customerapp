/*
 * Jest only, for interact.parity.tsx's pressIcon: controls that show no
 * words, writing down what was pressed. A back chevron (an SVG icon), three
 * dots drawn as views (JobDetailScreen.tsx's ••• menu), a close X that is
 * disabled, and a control with words, which is never an icon-only one.
 */
import React, { useState } from "react"
import { Text, TouchableOpacity, View } from "react-native"

import { DmView } from "@tappler/shared/src/components/UI"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import CloseIcon from "assets/icons/close.svg"

const DOT = { width: 5, height: 5, borderRadius: 3, marginHorizontal: 1 }

const IconProbe = () => {
  const [pressed, setPressed] = useState<string[]>([])
  const press = (what: string) => setPressed((all) => [...all, what])
  return (
    <View>
      <TouchableOpacity onPress={() => press("back")}>
        <ChevronLeftIcon />
      </TouchableOpacity>
      <DmView onPress={() => press("more")}>
        <View style={{ flexDirection: "row" }}>
          <View style={DOT} />
          <View style={DOT} />
          <View style={DOT} />
        </View>
      </DmView>
      <TouchableOpacity onPress={() => press("close")} disabled>
        <CloseIcon />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => press("save")}>
        <CloseIcon />
        <Text>Save</Text>
      </TouchableOpacity>
      <Text testID="pressed">{pressed.join(",")}</Text>
    </View>
  )
}

export default IconProbe
