import React from "react"
import { StyleSheet, View } from "react-native"

declare const Text: React.FC<any>
declare const DmView: React.FC<any>
declare const DmText: React.FC<any>
declare const MainModal: React.FC<any>
declare const px: (n: number) => number

export const Converted = () => (
  <DmView className="px-[20]">
    <DmText className="text-16 leading-[19px]" classNameTitle="mt-[4]" textClassName="font-custom600">
      a
    </DmText>
  </DmView>
)
