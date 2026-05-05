import React, { useCallback } from "react"
import { FlatList } from "react-native"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import { RootStackScreenProps } from "navigation/types"
import { ChatPreviewType } from "types/chat"
import { MOCK_ARCHIVED_CHATS } from "screens/dashboardScreens/MessagesScreen/mockData"
import MessagesComponent from "components/MessagesComponent/MessagesComponent"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import colors from "@tappler/shared/src/styles/colors"

type Props = RootStackScreenProps<"ArchivedMessagesScreen">

const ArchivedMessagesScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

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
      />
    ),
    [handleChatPress],
  )

  const renderEmpty = useCallback(
    () => (
      <DmView className="flex-1 items-center justify-center pt-[80]">
        <DmText
          className="text-14 font-custom400 text-grey3"
          style={{ textAlign: "center" }}
        >
          {t("no_archived_messages")}
        </DmText>
      </DmView>
    ),
    [t],
  )

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      {/* Header */}
      <DmView className="flex-row items-center px-[16] py-[12]">
        <DmView
          onPress={() => navigation.goBack()}
          className="w-[32] h-[32] items-center justify-center"
        >
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView className="flex-1 items-center">
          <DmText className="text-16 font-custom600 text-black">
            {t("archived")}
          </DmText>
        </DmView>
        <DmView className="w-[32]" />
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      {/* Archived list */}
      <FlatList
        data={MOCK_ARCHIVED_CHATS}
        keyExtractor={(item) => String(item.chat.id)}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          MOCK_ARCHIVED_CHATS.length === 0 ? { flex: 1 } : undefined
        }
      />
    </SafeAreaView>
  )
}

export default ArchivedMessagesScreen
