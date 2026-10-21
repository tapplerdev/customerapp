/*
 * Jest only, for screenKit.parity.tsx: a module that imports
 * `moment/locale/ar`, as MessageComponent does (moment's defineLocale makes
 * it the global locale as a side effect), and formats with the global one,
 * as NotificationItem does.
 */
import React from "react"
import { Text } from "react-native"
import moment from "moment"
import "moment/locale/ar"

const MomentProbe = () => (
  <Text testID="moment">{`${moment.locale()} ${moment("2026-10-20T08:00:00.000Z").format("dddd")}`}</Text>
)

export default MomentProbe
