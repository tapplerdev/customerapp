import React from "react"
import { StyleSheet, View } from "react-native"

declare const Text: React.FC<any>
declare const DmView: React.FC<any>
declare const DmText: React.FC<any>
declare const MainModal: React.FC<any>
declare const px: (n: number) => number

export const Improved = () => (
  <DmView className="flex-1">
    <Text>a</Text>
    <Text>b</Text>
  </DmView>
)
