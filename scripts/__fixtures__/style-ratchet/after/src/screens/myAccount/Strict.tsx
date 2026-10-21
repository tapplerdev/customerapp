import React from "react"
import { StyleSheet, View } from "react-native"

declare const Text: React.FC<any>
declare const DmView: React.FC<any>
declare const DmText: React.FC<any>
declare const MainModal: React.FC<any>
declare const px: (n: number) => number

export const Strict = () => (
  <View style={{ flex: 1 }}>
    <DmView className="px-[16]">
      <Text leading="legacy">a</Text>
      <View style={{ marginTop: px(3) }} />
    </DmView>
    <MainModal className="px-[20]" style={{ marginTop: px(4) }} />
  </View>
)
