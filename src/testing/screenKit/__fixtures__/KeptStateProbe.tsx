/*
 * Jest only, for freshRegistry.parity.tsx: module state nobody resets (on no
 * PER_ROW list, on purpose), so what one row leaves in it is what a later
 * row in the same registry draws.
 */
import React from "react"
import { Text } from "react-native"

let kept = "nothing kept"

const KeptStateProbe = ({ keep }: { keep?: string }) => {
  if (keep !== undefined) kept = keep
  return <Text>{kept}</Text>
}

export default KeptStateProbe
