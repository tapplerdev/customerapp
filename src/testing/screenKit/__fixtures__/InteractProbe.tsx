/*
 * Jest only, for interact.parity.tsx: what a customer presses and types, on
 * shared's components (titled buttons, links, fields), each writing down what
 * it got, and a timer for wait(). Some refuse a customer: a disabled and a
 * loading button, a disabled link and touchable, a row whose touchable its
 * own lock disables, a field that isn't editable, one you press. The buttons
 * are ds Buttons and the links' words ds Text: the kit refuses ActionBtn and
 * DmText since W3.4 (testing/classGuard), as no screen draws them any more.
 */
import React, { useEffect, useState } from "react"
import { Text, TouchableOpacity, View } from "react-native"
import { useTranslation } from "react-i18next"

import { DmInput, DmView } from "@tappler/shared/src/components/UI"
import { Button, Text as DsText } from "@tappler/shared/src/ds"

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
  const [timer, setTimer] = useState("timer waiting")
  const press = (what: string) => setPressed((all) => [...all, what])
  useEffect(() => {
    const id = setTimeout(() => setTimer("timer fired"), 2000)
    return () => clearTimeout(id)
  }, [])
  return (
    <DmView>
      <Button title={t("save")} onPress={() => press("save")} />
      <Button title="Locked" disabled onPress={() => press("locked")} />
      <Button title="Sending" isLoading onPress={() => press("sending")} />
      <Button title="Pay" disabled onPress={() => press("pay")} />
      <DmView onPress={() => press("link")}>
        <DsText size={14}>{t("delete_account")}</DsText>
      </DmView>
      <DmView onPress={() => press("disabled link")} disabled>
        <DsText size={14}>Disabled link</DsText>
      </DmView>
      <TouchableOpacity onPress={() => press("disabled touch")} disabled>
        <Text>Disabled touch</Text>
      </TouchableOpacity>
      <LockedRow title="Locked row" locked onPress={() => press("locked")} />
      <DmView onPress={() => press("help 1")}>
        <DsText size={14}>Help</DsText>
      </DmView>
      <DmView onPress={() => press("help 2")}>
        <DsText size={14}>Help</DsText>
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
      <Text testID="pressed">{pressed.join(",")}</Text>
      <Text testID="typed">{`${name}|${city}|${digits}`}</Text>
      <Text testID="timer">{timer}</Text>
    </DmView>
  )
}

export default InteractProbe
