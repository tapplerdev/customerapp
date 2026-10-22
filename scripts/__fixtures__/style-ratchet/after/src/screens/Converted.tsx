import React from "react"
import { StyleSheet, View } from "react-native"

declare const Text: React.FC<any>
declare const DmView: React.FC<any>
declare const DmText: React.FC<any>
declare const MainModal: React.FC<any>
declare const px: (n: number) => number

export const Converted = () => (
  <View style={{ paddingLeft: px(20), paddingRight: px(20) }}>
    <Text leading="legacy" family="system">
      a
    </Text>
    <MainModal className="px-[20]" />
  </View>
)
