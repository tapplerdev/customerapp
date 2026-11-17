import React, { useCallback, useMemo } from "react"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import { RootStackScreenProps } from "navigation/types"
import { ChatPreviewType } from "types/chat"
import { isArchivedChatVisible } from "helpers/chatVisibility"
import { useGetChatsQuery } from "services/api"
import { useTypedSelector } from "store"
import MessagesComponent from "components/MessagesComponent/MessagesComponent"
import MessagesSkeleton from "screens/dashboardScreens/MessagesScreen/MessagesSkeleton"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import colors from "@tappler/shared/src/styles/colors"
import { AppFlatList } from "components/scroll"
import { Text, Button, a } from "@tappler/shared/src/ds"
import styles from "./styles"

type Props = RootStackScreenProps<"ArchivedMessagesScreen">

const ArchivedMessagesScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const { isAuth } = useTypedSelector((store) => store.auth)
  // The chats the backend lists as archived for this customer, newest
  // archived first. Fetched fresh on every visit: a chat archived from the
  // Messages tab invalidates the cache, but a failed earlier read must not
  // linger as an empty list.
  const { data, isLoading, isError, isFetching, refetch } = useGetChatsQuery(
    { statuses: ["archived"] },
    { skip: !isAuth, refetchOnMountOrArgChange: true }
  )
  // The same engagement gate as the main list (and as the Messages tab's
  // archived count): an archived cold pitch the customer never saw stays out.
  const archivedChats = useMemo(
    () => (data?.data ?? []).filter(isArchivedChatVisible),
    [data]
  )

  const handleChatPress = useCallback(
    (item: ChatPreviewType) => {
      navigation.navigate("MessagesDetailsScreen", { chatPreview: item })
    },
    [navigation]
  )

  const renderItem = useCallback(
    ({ item }: { item: ChatPreviewType }) => (
      <MessagesComponent item={item} onPress={() => handleChatPress(item)} />
    ),
    [handleChatPress]
  )

  const renderEmpty = useCallback(
    () => (
      <DmView
        style={[a.flex_1, a.items_center, a.justify_center, styles.container]}
      >
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
    [t]
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
      {isLoading ? (
        <MessagesSkeleton />
      ) : isError && !data ? (
        // The load failed with nothing cached: not "no archived messages".
        <DmView style={[a.flex_1, a.items_center, a.justify_center, a.px_40]}>
          <Text
            size={16}
            weight="semibold"
            leading="normal"
            color="tertiary"
            align="center"
          >
            {t("archived_load_error")}
          </Text>
          <Text
            size={12}
            leading="normal"
            color="tertiary"
            align="center"
            style={a.mt_8}
          >
            {t("archived_load_error_descr")}
          </Text>
          <DmView style={[a.mt_20, a.px_20, a.w_full]}>
            <Button
              title={t("try_again")}
              onPress={refetch}
              isLoading={isFetching}
              label={14}
              labelWeight="semibold"
              labelLeading="normal"
            />
          </DmView>
        </DmView>
      ) : (
        <AppFlatList
          data={archivedChats}
          keyExtractor={(item) => String(item.chat.id)}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={
            archivedChats.length === 0 ? { flex: 1 } : undefined
          }
        />
      )}
    </SafeAreaView>
  )
}

export default ArchivedMessagesScreen
