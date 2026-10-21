/*
 * Jest only, for screenKit.parity.tsx: module state an earlier row could
 * leave behind. With `read`, it marks the chat read the way MessagesDetails'
 * mark-all does (chatReadRegistry, a module-level Map with a TTL the kit's
 * frozen clock never reaches); either way it draws the chat's unread count,
 * which getChats' transformResponse zeroes for a chat in the registry.
 */
import React, { useState } from "react"
import { Text, View } from "react-native"

import { chatReadRegistry } from "services/chatReadRegistry"
import { useGetChatsQuery } from "services/api"

const RowStateProbe = ({ read = false }: { read?: boolean }) => {
  // Before the first request, so its answer goes through the guard.
  useState(() => {
    if (read) chatReadRegistry.add(6001)
    return null
  })
  const { data } = useGetChatsQuery()
  return (
    <View>
      <Text testID="unread">{`unread ${data?.data[0]?.notReadMessages ?? "-"}`}</Text>
      <Text testID="registry">{`registry ${chatReadRegistry.has(6001) ? "has" : "lacks"} 6001`}</Text>
    </View>
  )
}

export default RowStateProbe
