/*
 * Jest only, for screenKit.parity.tsx: shared's NativeSheet (true-sheet
 * underneath, the kit's stand-in in jest) opened and closed by its
 * `visible`, counting what it reports.
 */
import React, { useState } from "react"
import { Text, View } from "react-native"

import NativeSheet from "@tappler/shared/src/components/NativeSheet/NativeSheet"

const SheetProbe = ({
  open = false,
  cornerRadius,
}: {
  open?: boolean
  cornerRadius?: number
}) => {
  const [visible, setVisible] = useState(open)
  const [dismissed, setDismissed] = useState(0)
  const [closed, setClosed] = useState(0)
  return (
    <View>
      <Text testID="open" onPress={() => setVisible(true)}>
        open
      </Text>
      <Text testID="close" onPress={() => setVisible(false)}>
        close
      </Text>
      <Text testID="counts">{`dismissed ${dismissed} closed ${closed}`}</Text>
      <NativeSheet
        visible={visible}
        cornerRadius={cornerRadius}
        onDismissed={() => {
          setDismissed((count) => count + 1)
          setVisible(false)
        }}
        onClosed={() => setClosed((count) => count + 1)}
      >
        <Text>sheet content</Text>
      </NativeSheet>
    </View>
  )
}

export default SheetProbe
