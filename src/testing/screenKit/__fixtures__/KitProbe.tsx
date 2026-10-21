/*
 * Jest only, for screenKit.parity.tsx: one screen that reads everything the
 * kit sets up, and draws it as text.
 */
import React, { useCallback, useState } from "react"
import { I18nManager, Platform, Text, View } from "react-native"
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import moment from "moment"
import { LinearGradient } from "react-native-linear-gradient"
// The raw FlashList on purpose: the kit's stand-in for it is what's checked.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { FlashList } from "@shopify/flash-list"

import { DmText } from "@tappler/shared/src/components/UI"
import { useTypedSelector, store } from "store"
import { useGetChatsQuery, useGetNotificationsQuery } from "services/api"

const KitProbe = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation()
  const user = useTypedSelector((state) => state.auth.user)
  const language = useTypedSelector((state) => state.auth.language)
  const carts = useTypedSelector((state) => state.cart.carts)
  const drafts = Object.keys(carts)
  const chats = useGetChatsQuery()
  const notifications = useGetNotificationsQuery({ page: 1, perPage: 20 })
  const [focused, setFocused] = useState(0)
  // The clock as the screen mounted (once, so the render stays pure).
  const [clock] = useState(() => new Date().toISOString())
  useFocusEffect(
    useCallback(() => {
      setFocused((count) => count + 1)
    }, [])
  )
  return (
    <View testID="probe">
      <Text testID="platform">{`${Platform.OS} ${String(Platform.Version)}`}</Text>
      <Text testID="language">{`${i18n.language} ${language} ${I18nManager.isRTL ? "rtl" : "ltr"} ${t("messages")}`}</Text>
      <Text testID="moment">
        {`${moment.locale()} ${moment("2026-10-20T08:00:00.000Z").format("D MMMM")}`}
      </Text>
      <Text testID="clock">{clock}</Text>
      <Text testID="insets">{`${insets.top} ${insets.bottom}`}</Text>
      <Text testID="route">{`${route.name} ${JSON.stringify(route.params)}`}</Text>
      <Text testID="user">{`${user?.firstName} ${store.getState().auth.user?.lastName}`}</Text>
      <Text testID="cart">{`drafts ${drafts.join(",")}`}</Text>
      <Text testID="chats">
        {chats.data
          ? `chats ${chats.data.data.length} unread ${chats.data.data[0]?.notReadMessages ?? 0}`
          : chats.isError
            ? "error"
            : "loading"}
      </Text>
      <Text testID="notifications">
        {notifications.isLoading ? "loading" : "done"}
      </Text>
      <Text testID="focused">{`focused ${focused}`}</Text>
      <Text
        testID="go"
        onPress={() => navigation.navigate("JobDetailScreen" as never)}
      >
        go
      </Text>
      <DmText className="text-20 font-custom600">face</DmText>
      <LinearGradient colors={["#000000", "#FFFFFF"]} style={{ height: 4 }} />
      <FlashList
        data={["a", "b"]}
        renderItem={({ item }: { item: string }) => (
          <Text>{`row ${item}`}</Text>
        )}
        contentContainerStyle={{ paddingTop: 8 }}
      />
    </View>
  )
}

export default KitProbe
