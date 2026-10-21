import React from "react"
import { StyleSheet, View } from "react-native"

declare const Text: React.FC<any>
declare const DmView: React.FC<any>
declare const DmText: React.FC<any>
declare const MainModal: React.FC<any>
declare const px: (n: number) => number

export const BridgeWithoutFall = () => (
  <DmView className="flex-1">
    <DmText className="text-14">a</DmText>
  </DmView>
)
