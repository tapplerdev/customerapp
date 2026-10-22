/*
 * Jest only, for __tests__/noPluginControl.test.tsx: a literal className on a
 * View, in a file under src, so whatever transform a run compiles with, the
 * src override included, applies to it. With NativeWind's Babel plugin the
 * View is wrapped and draws marginTop 4; without it the className reaches
 * the host as a plain prop (React Native's types know no className: the
 * nativewind/types reference left declarations.d.ts in W3.2).
 */
import React from "react"
import { View } from "react-native"

/** The canary's source, for the transform rows (a file that never exists). */
export const CLASS_NAME_ON_VIEW_SOURCE = `
import React from "react"
import { View } from "react-native"
export const Canary = () => <View className="mt-[4]" />
`

export const ClassNameOnView = () => (
  // @ts-expect-error React Native's View takes no className without NativeWind's types.
  <View className="mt-[4]" />
)

export default ClassNameOnView
