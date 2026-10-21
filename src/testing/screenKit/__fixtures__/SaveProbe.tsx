/*
 * Jest only, for screenKit.parity.tsx: a save whose handler waits on its
 * request, as a screen's save button does.
 */
import React, { useState } from "react"
import { Text, View } from "react-native"

import { useAuthResetPasswordMutation } from "services/api"

const SaveProbe = () => {
  const [reset] = useAuthResetPasswordMutation()
  const [saved, setSaved] = useState("not saved")
  const save = async () => {
    await reset({
      email: "pro@example.com",
      userType: "pro",
      lang: "en",
    }).unwrap()
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
