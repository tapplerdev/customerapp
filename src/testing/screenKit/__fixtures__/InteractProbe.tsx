/*
 * Jest only, for interact.parity.tsx: what a pro presses and types, on our
 * own components (titled buttons, links, fields, the code boxes), each
 * writing down what it got, and a timer for wait(). Some refuse a pro: a
 * disabled and a loading button, a disabled link and touchable, a row whose
 * touchable its own lock disables, a field that isn't editable, one you press.
 */
import React, { useEffect, useState } from "react"
import { Text, TouchableOpacity, View } from "react-native"
import { useTranslation } from "react-i18next"

import {
  ActionBtn,
  DmInput,
  DmText,
  DmView,
} from "@tappler/shared/src/components/UI"
import { Button } from "@tappler/shared/src/ds"
import VerifyCodeInput from "components/VerifyCodeInput"

// A titled row whose touchable isn't its first host, and whose lock is its
// own prop (not `disabled`): only the touchable says it refuses a tap.
const LockedRow = ({
  title,
  onPress,
  locked,
}: {
  title: string
  onPress: () => void
  locked: boolean
}) => (
  <View>
    <TouchableOpacity disabled={locked} onPress={onPress}>
      <Text>{title}</Text>
    </TouchableOpacity>
  </View>
)

const InteractProbe = () => {
  const { t } = useTranslation()
  const [pressed, setPressed] = useState<string[]>([])
  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [digits, setDigits] = useState("")
  const [code, setCode] = useState("")
  const [timer, setTimer] = useState("timer waiting")
  const press = (what: string) => setPressed((all) => [...all, what])
  useEffect(() => {
    const id = setTimeout(() => setTimer("timer fired"), 2000)
    return () => clearTimeout(id)
  }, [])
  return (
    <DmView>
      <ActionBtn title={t("save")} onPress={() => press("save")} />
      <ActionBtn title="Locked" disable onPress={() => press("locked")} />
      <ActionBtn title="Sending" isLoading onPress={() => press("sending")} />
      <Button title="Pay" disabled onPress={() => press("pay")} />
      <DmView onPress={() => press("link")}>
        <DmText>{t("forgot_password")}</DmText>
      </DmView>
      <DmView onPress={() => press("disabled link")} disabled>
        <DmText>Disabled link</DmText>
      </DmView>
      <TouchableOpacity onPress={() => press("disabled touch")} disabled>
        <Text>Disabled touch</Text>
      </TouchableOpacity>
      <LockedRow title="Locked row" locked onPress={() => press("locked")} />
      <DmView onPress={() => press("help 1")}>
        <DmText>Help</DmText>
      </DmView>
      <DmView onPress={() => press("help 2")}>
        <DmText>Help</DmText>
      </DmView>
      <DmInput value={name} onChangeText={setName} placeholder="Name" />
      <DmInput value={city} onChangeText={setCity} placeholder="City" />
      <DmInput
        value={digits}
        onChangeText={setDigits}
        keyboardType="numeric"
        placeholder="Digits"
      />
      <DmInput
        value="fixed"
        onChangeText={() => press("typed into fixed")}
        editable={false}
        placeholder="Fixed"
      />
      <DmInput
        value="picked"
        onChangeText={() => press("typed into picker")}
        onPress={() => press("picker")}
        placeholder="Picker"
      />
      <VerifyCodeInput setCodeValue={setCode} />
      <Text testID="pressed">{pressed.join(",")}</Text>
      <Text testID="typed">{`${name}|${city}|${digits}|${code}`}</Text>
      <Text testID="timer">{timer}</Text>
    </DmView>
  )
}

export default InteractProbe
