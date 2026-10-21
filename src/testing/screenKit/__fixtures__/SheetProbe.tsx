/*
 * Jest only, for screenKit.parity.tsx: shared's NativeSheet (true-sheet
 * underneath, the kit's stand-in in jest) opened and closed by its
 * `visible`, counting what it reports. `dismissable={false}` and
 * `interceptBackPress` (QuestionFlowSheet's) make it a sheet the customer
 * can't close themselves (NativeSheet.tsx:514).
 */
import React, { useState } from "react"
import { Text, View } from "react-native"

import NativeSheet from "@tappler/shared/src/components/NativeSheet/NativeSheet"

const SheetProbe = ({
  open = false,
  cornerRadius,
  dismissable,
  interceptBackPress,
}: {
  open?: boolean
  cornerRadius?: number
  dismissable?: boolean
  interceptBackPress?: boolean
}) => {
  const [visible, setVisible] = useState(open)
  const [dismissed, setDismissed] = useState(0)
  const [closed, setClosed] = useState(0)
  const [attempts, setAttempts] = useState(0)
  return (
    <View>
      <Text testID="open" onPress={() => setVisible(true)}>
        open
      </Text>
      <Text testID="close" onPress={() => setVisible(false)}>
        close
      </Text>
      <Text testID="counts">{`dismissed ${dismissed} closed ${closed}`}</Text>
      <Text testID="attempts">{`attempts ${attempts}`}</Text>
      <NativeSheet
        visible={visible}
        cornerRadius={cornerRadius}
        dismissable={dismissable}
        onDismissAttempt={() => setAttempts((count) => count + 1)}
        interceptBackPress={interceptBackPress}
        onBackPress={() => undefined}
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
