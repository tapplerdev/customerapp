/*
 * Jest only: the component the harvest tests harvest (harvest.test.tsx). Its
 * call sites are the other files here; nothing renders it.
 */
import React from "react"
import { Text, View, type StyleProp, type ViewStyle } from "react-native"

export type WidgetProps = {
  title: string
  className?: string
  /** What NativeWind hands it for a className (so the wrap probe passes it). */
  style?: StyleProp<ViewStyle>
  disabled?: boolean
  variant?: "dark" | "light"
  icon?: React.ReactNode
  item?: { id: number }
  onPress?: () => void
  children?: React.ReactNode
}

export const Widget = ({ title, style, children }: WidgetProps) => (
  <View style={style}>
    <Text>{title}</Text>
    {children}
  </View>
)

export default Widget
