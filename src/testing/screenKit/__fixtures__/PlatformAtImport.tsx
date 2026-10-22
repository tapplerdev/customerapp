/*
 * Jest only, for screenKit.parity.tsx: what a module reads from Platform
 * when it loads, beside what it reads while it renders.
 */
import React from "react"
import { Platform, Text } from "react-native"

const AT_IMPORT = Platform.OS
const VERSION_AT_IMPORT = String(Platform.Version)

const PlatformAtImport = () => (
  <Text>
    {AT_IMPORT} {Platform.OS} {Platform.select({ ios: "i", android: "a" })}{" "}
    {VERSION_AT_IMPORT}
  </Text>
)

export default PlatformAtImport
