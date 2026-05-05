import React, { useCallback, useMemo, useRef, useState } from "react"
import { FlatList } from "react-native"
import Animated, { FadeIn } from "react-native-reanimated"
import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { RootStackParamList } from "navigation/types"
import { ChatPreviewType } from "types/chat"
import { useGetChatsQuery, useArchiveChatMutation } from "services/api"
import { useTypedSelector } from "store"
import SearchMessagesComponent from "components/SearchMessagesComponent/SearchMessagesComponent"
import MessagesComponent from "components/MessagesComponent/MessagesComponent"
import colors from "@tappler/shared/src/styles/colors"

import ArchivedIcon from "assets/icons/archived.svg"
import NoMessagesIcon from "assets/icons/no-messages.svg"
import MessagesSkeleton from "./MessagesSkeleton"

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const MessagesScreen: React.FC = () => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const navigation = useNavigation<NavigationProp>()

  const { isAuth } = useTypedSelector((store) => store.auth)
  const [searchText, setSearchText] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { data, isLoading } = useGetChatsQuery(undefined, { skip: !isAuth })
  const [archiveChat] = useArchiveChatMutation()

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setDebouncedSearch(text), 300)
  }, [])

  const allChats = data?.data || []
  const activeChats = allChats.filter((item) => {
    if (item.chat.status !== "active") return false
    if (!item.chat.job) return true
    const chatPro = item.chat.job.pros?.find((p) => p.proId === item.chat.proId)
    return chatPro?.selectionStatus === "offer"
  })
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
      <DmView className="flex-1 items-center justify-center pt-[80]">
        <NoMessagesIcon width={120} height={120} />
        <DmText
          className="text-14 font-custom500 text-grey3 mt-[16]"
          style={{ textAlign: "center", lineHeight: 18 }}
        >
          {t("you_do_not_have_any_messages")}
        </DmText>
      </DmView>
    ),
    [t],
  )

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      {/* Header */}
      <DmView className="items-center py-[12]">
        <DmText className="text-18 font-custom600 text-black">
          {t("messages")}
        </DmText>
      </DmView>
      {!isAuth ? (
        <>
        <DmView className="h-[0.7] bg-grey19" />
        <DmView className="flex-1 items-center justify-center px-[40]">
          <DmText className="text-16 font-custom600 text-grey3 text-center">
            {t("login_to_view_messages")}
          </DmText>
          <DmText className="mt-[8] text-12 font-custom400 text-grey3 text-center">
            {t("login_to_view_messages_descr")}
          </DmText>
          <DmView className="mt-[20] px-[20] w-full">
            <ActionBtn
              title={t("log_In")}
              onPress={() => navigation.navigate("SignInEmailScreen")}
              textClassName="text-14 font-custom600"
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
        className="pt-[30] pb-[14] px-[15] flex-row justify-between border-b-1 border-grey4"
      >
        <DmView className="pl-[10] flex-row items-center">
          <ArchivedIcon />
          <DmText className="mx-[10] text-13 leading-[16px] font-custom600 text-grey30">
            {t("archived")}
          </DmText>
        </DmView>
        <DmText className="text-13 leading-[16px] font-custom600 text-grey30">
          {archivedCount}
        </DmText>
      </DmView>

      {/* Chat list */}
      {isLoading ? (
        <MessagesSkeleton />
      ) : (
        <Animated.View entering={FadeIn.duration(400)} className="flex-1">
        <FlatList
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
