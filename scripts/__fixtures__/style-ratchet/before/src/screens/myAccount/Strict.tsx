import React from "react"
import { StyleSheet, View } from "react-native"

declare const Text: React.FC<any>
declare const DmView: React.FC<any>
declare const DmText: React.FC<any>
declare const MainModal: React.FC<any>
declare const px: (n: number) => number

export const Strict = () => (
  <DmView className="flex-1">
    <DmView className="px-[16]">
      <DmText className="text-14">a</DmText>
      <DmText className="text-12">b</DmText>
    </DmView>
    <MainModal className="px-[20]" />
  </DmView>
)
