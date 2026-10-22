/*
 * Jest only, for screenKit.parity.tsx: what a module reads from I18nManager
 * when it loads (FoodCheckoutScreen/styles.ts:15 does), beside what it reads
 * while it renders.
 */
import React from "react"
import { I18nManager, StyleSheet, Text } from "react-native"

const AT_IMPORT = I18nManager.isRTL ? "rtl" : "ltr"
const styles = StyleSheet.create({
  label: { textAlign: I18nManager.isRTL ? "right" : "left" },
})

const RtlAtImport = () => (
  <Text style={styles.label}>
    {AT_IMPORT} {I18nManager.isRTL ? "rtl" : "ltr"}
  </Text>
)

export default RtlAtImport
