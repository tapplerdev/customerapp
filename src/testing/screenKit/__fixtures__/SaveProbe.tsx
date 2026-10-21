/*
 * Jest only, for screenKit.parity.tsx: a save whose handler waits on its
 * request, as a screen's save button does.
 */
import React, { useState } from "react"
import { Text, View } from "react-native"

import { useUpdateCustomerMutation } from "services/api"

const SaveProbe = () => {
  const [update] = useUpdateCustomerMutation()
  const [saved, setSaved] = useState("not saved")
  const save = async () => {
    await update({ firstName: "Mona" }).unwrap()
    setSaved("saved")
  }
  return (
    <View>
      <Text testID="save" onPress={save}>
        save
      </Text>
      <Text testID="saved">{saved}</Text>
    </View>
  )
}

export default SaveProbe
