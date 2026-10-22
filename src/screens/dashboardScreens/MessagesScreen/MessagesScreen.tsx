import React, { useCallback, useMemo, useRef, useState } from "react"
import Animated, { FadeIn } from "react-native-reanimated"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"
import { useFocusEffect, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { RootStackParamList } from "navigation/types"
import { ChatPreviewType } from "types/chat"
import { isChatVisible } from "helpers/chatVisibility"
import { useGetChatsQuery, useArchiveChatMutation } from "services/api"
import { useTypedSelector } from "store"
import SearchMessagesComponent from "components/SearchMessagesComponent/SearchMessagesComponent"
import MessagesComponent from "components/MessagesComponent/MessagesComponent"
import colors from "@tappler/shared/src/styles/colors"

import ArchivedIcon from "assets/icons/archived.svg"
import NoMessagesIcon from "assets/icons/no-messages.svg"
import MessagesSkeleton from "./MessagesSkeleton"
import { AppFlatList } from "components/scroll"
import { Text, Button, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const MessagesScreen: React.FC = () => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const navigation = useNavigation<NavigationProp>()

  const { isAuth } = useTypedSelector((store) => store.auth)
  const [searchText, setSearchText] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { data, isLoading, refetch } = useGetChatsQuery(undefined, { skip: !isAuth })
  const [archiveChat] = useArchiveChatMutation()

  // Refetch chat list when tab is focused
  useFocusEffect(
    useCallback(() => {
      if (isAuth) refetch()
    }, [isAuth, refetch])
  )

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setDebouncedSearch(text), 300)
  }, [])

  const allChats = data?.data || []
  // Shared predicate with the tab badge (helpers/chatVisibility) — keeping
  // them identical is what guarantees the badge never counts a hidden chat.
  const activeChats = allChats.filter(isChatVisible)
  const archivedCount = allChats.filter((item) => item.chat.status === "archived").length

  const filteredChats = useMemo(() => {
    if (!debouncedSearch.trim()) return activeChats

    const query = debouncedSearch.toLowerCase()
    return activeChats.filter((item) => {
      const proName = (item.chat.pro?.businessName || item.chat.pro?.registeredName || "").toLowerCase()
      const serviceEn = item.chat.serviceCategory?.nameEn?.toLowerCase() || ""
      const serviceAr = item.chat.serviceCategory?.nameAr || ""
      return (
        proName.includes(query) ||
        serviceEn.includes(query) ||
        serviceAr.includes(query)
      )
    })
  }, [debouncedSearch, activeChats])

  const handleArchive = useCallback(async (chatId: number) => {
    try {
      await archiveChat(chatId).unwrap()
    } catch (error) {
    }
  }, [archiveChat])

  const handleChatPress = useCallback(
    (item: ChatPreviewType) => {
      navigation.navigate("MessagesDetailsScreen", { chatPreview: item })
    },
    [navigation],
  )

  const renderItem = useCallback(
    ({ item }: { item: ChatPreviewType }) => (
      <MessagesComponent
        item={item}
        onPress={() => handleChatPress(item)}
        onArchive={handleArchive}
      />
    ),
    [handleChatPress, handleArchive],
  )

  const renderEmpty = useCallback(
    () => (
      <DmView style={[a.flex_1, a.items_center, a.justify_center, styles.container]}>
        <NoMessagesIcon width={120} height={120} />
        <Text
          size={14}
          weight="medium"
          leading={{ fixed: px(18) }}
          color="tertiary"
          style={[a.mt_16, { textAlign: "center" }]}
        >
          {t("you_do_not_have_any_messages")}
        </Text>
      </DmView>
    ),
    [t],
  )

  return (
    <SafeAreaView edges={["top"]} style={[a.flex_1, styles.safeArea]}>
      {/* Header */}
      <DmView style={[a.items_center, a.py_12]}>
        <Text size={18} weight="semibold" leading="legacy">
          {t("messages")}
        </Text>
      </DmView>
      {!isAuth ? (
        <>
        <DmView style={styles.box} />
        <DmView style={[a.flex_1, a.items_center, a.justify_center, a.px_40]}>
          <Text size={16} weight="semibold" leading="legacy" color="tertiary" align="center">
            {t("login_to_view_messages")}
          </Text>
          <Text size={12} leading="legacy" color="tertiary" align="center" style={a.mt_8}>
            {t("login_to_view_messages_descr")}
          </Text>
          <DmView style={[a.mt_20, a.px_20, a.w_full]}>
            <Button
              title={t("log_In")}
              onPress={() => navigation.navigate("SignInEmailScreen")}
              label={14}
              labelWeight="semibold"
              labelLeading="legacy"
            />
          </DmView>
        </DmView>
        </>
      ) : (
      <>
      {/* Search */}
      <SearchMessagesComponent
        searchText={searchText}
        onChangeText={handleSearchChange}
      />

      {/* Archived row */}
      <DmView
        onPress={() => navigation.navigate("ArchivedMessagesScreen")}
        style={[
          a.pt_30,
          a.pb_14,
          styles.row,
          a.flex_row,
          a.justify_between,
          a.border_b_1,
        ]}
      >
        <DmView style={[a.pl_10, a.flex_row, a.items_center]}>
          <ArchivedIcon />
          <Text size={13} weight="semibold" leading="tight" style={[a.mx_10, styles.archived]}>
            {t("archived")}
          </Text>
        </DmView>
        <Text size={13} weight="semibold" leading="tight" style={styles.archived}>
          {archivedCount}
        </Text>
      </DmView>

      {/* Chat list */}
      {isLoading ? (
        <MessagesSkeleton />
      ) : (
        <Animated.View entering={FadeIn.duration(400)} style={a.flex_1}>
        <AppFlatList
          data={filteredChats}
          keyExtractor={(item) => String(item.chat.id)}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          getItemLayout={(_, index) => ({ length: 64, offset: 64 * index, index })}
          contentContainerStyle={
            filteredChats.length === 0 ? { flex: 1 } : undefined
          }
        />
        </Animated.View>
      )}
      </>
      )}
    </SafeAreaView>
  )
}

export default MessagesScreen
