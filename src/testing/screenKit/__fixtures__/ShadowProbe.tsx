/*
 * Jest only, for screenKit.parity.tsx: two react-native-shadow-2 Shadows,
 * whose gradient ids come from the library's module-level counter.
 */
import React from "react"
import { View } from "react-native"
import { Shadow } from "react-native-shadow-2"

const BOX = { width: 40, height: 40, borderRadius: 5 }

const ShadowProbe = () => (
  <View>
    <Shadow distance={5} startColor="#CC000059">
      <View style={BOX} />
    </Shadow>
    <Shadow distance={3} startColor="#00000020">
      <View style={BOX} />
    </Shadow>
  </View>
)

export default ShadowProbe
