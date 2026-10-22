import React, { useCallback } from "react"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import { RootStackScreenProps } from "navigation/types"
import { ChatPreviewType } from "types/chat"
import { MOCK_ARCHIVED_CHATS } from "screens/dashboardScreens/MessagesScreen/mockData"
import MessagesComponent from "components/MessagesComponent/MessagesComponent"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import colors from "@tappler/shared/src/styles/colors"
import { AppFlatList } from "components/scroll"
import { Text, a } from "@tappler/shared/src/ds"
import styles from "./styles"

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
      <DmView style={[a.flex_1, a.items_center, a.justify_center, styles.container]}>
        <Text
          size={14}
          leading="legacy"
          color="tertiary"
          style={{ textAlign: "center" }}
        >
          {t("no_archived_messages")}
        </Text>
      </DmView>
    ),
    [t],
  )

  return (
    <SafeAreaView edges={["top"]} style={[a.flex_1, styles.safeArea]}>
      {/* Header */}
      <DmView style={[a.flex_row, a.items_center, a.px_16, a.py_12]}>
        <DmView
          onPress={() => navigation.goBack()}
          style={[styles.iconWrap, a.items_center, a.justify_center]}
        >
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView style={[a.flex_1, a.items_center]}>
          <Text size={16} weight="semibold" leading="legacy">
            {t("archived")}
          </Text>
        </DmView>
        <DmView style={styles.box} />
      </DmView>
      <DmView style={styles.box2} />

      {/* Archived list */}
      <AppFlatList
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
