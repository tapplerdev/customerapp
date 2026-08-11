import React, { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, FlatList, RefreshControl } from "react-native"
import Animated, { FadeIn } from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useIsFocused } from "@react-navigation/native"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"

import {
  useGetNotificationsQuery,
  useLazyGetNotificationsQuery,
  useMarkAllNotificationsAsReadMutation,
  useMarkNotificationAsReadMutation,
} from "services/api"
import { NotificationsItemType } from "types/notification"
import { RootStackScreenProps } from "navigation/types"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import NotificationItem from "./components/NotificationItem"
import NotificationsSkeleton from "./NotificationsSkeleton"

const PER_PAGE = 20
// Chat unread belongs to the Messages tab badge — keep system.messages rows
// out of this list (nothing ever marks them read; same rule as proapp's bell).
const EXCLUDE_PREFIX = "system.messages"

type Props = RootStackScreenProps<"NotificationsScreen">

const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const isFocused = useIsFocused()

  const { data, refetch, isLoading, isFetching } = useGetNotificationsQuery({
    page: 1,
    perPage: PER_PAGE,
    excludeEventPrefix: EXCLUDE_PREFIX,
  })

  const [fetchMore] = useLazyGetNotificationsQuery()
  const [markAsRead] = useMarkNotificationAsReadMutation()
  const [markAllAsRead, { isLoading: isMarkingAll }] =
    useMarkAllNotificationsAsReadMutation()

  // Page 1 lives in the RTK cache (socket invalidations refresh it); deeper
  // pages are appended locally and reset whenever page 1 changes.
  const [allNotifications, setAllNotifications] = useState<NotificationsItemType[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMorePages, setHasMorePages] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  useEffect(() => {
    if (data?.data && data.page === 1) {
      setAllNotifications(data.data)
      setCurrentPage(1)
      setHasMorePages(data.total > data.perPage)
    }
  }, [data])

  // Revalidate when the customer returns to the screen (skip the mount focus —
  // the query itself already fetches then).
  const hasFocusedOnce = useRef(false)
  useEffect(() => {
    if (isFocused) {
      if (hasFocusedOnce.current) {
        refetch()
      }
      hasFocusedOnce.current = true
    }
  }, [isFocused, refetch])

  // Pull spinner tracks ONLY the user's pull, never background refetches.
  const [isPullRefreshing, setPullRefreshing] = useState(false)
  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true)
    try {
      await refetch()
    } finally {
      setPullRefreshing(false)
    }
  }, [refetch])

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMorePages || isFetching || !data) return

    const nextPage = currentPage + 1
    setIsLoadingMore(true)
    try {
      const result = await fetchMore({
        page: nextPage,
        perPage: PER_PAGE,
        excludeEventPrefix: EXCLUDE_PREFIX,
      }).unwrap()

      setAllNotifications((prev) => {
        // Guard against dupes when a new notification shifted pagination
        const seen = new Set(prev.map((n) => n.id))
        return [...prev, ...result.data.filter((n) => !seen.has(n.id))]
      })
      setCurrentPage(nextPage)
      setHasMorePages(nextPage < Math.ceil(result.total / result.perPage))
    } catch {
      // Keep hasMorePages — a retry happens on the next end-reach
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMorePages, isFetching, data, currentPage, fetchMore])

  const handleNotificationPress = useCallback(
    (item: NotificationsItemType) => {
      if (!item.readAt) {
        // Fire-and-forget: the tag invalidation refreshes list + bell badge
        markAsRead(item.id)
      }
      navigation.navigate("NotificationDetailsScreen", { notification: item })
    },
    [markAsRead, navigation]
  )

  const unreadCount = allNotifications.reduce(
    (sum, n) => sum + (!n.readAt ? 1 : 0),
    0
  )

  const handleMarkAll = useCallback(() => {
    if (!isMarkingAll) {
      markAllAsRead()
    }
  }, [isMarkingAll, markAllAsRead])

  const renderItem = useCallback(
    ({ item }: { item: NotificationsItemType }) => (
      <NotificationItem item={item} onPress={handleNotificationPress} />
    ),
    [handleNotificationPress]
  )

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null
    return (
      <DmView className="py-[20]">
        <ActivityIndicator size="small" color={colors.red} />
      </DmView>
    )
  }, [isLoadingMore])

  const renderEmpty = useCallback(
    () => (
      <DmView className="flex-1 items-center justify-center px-[40]">
        <DmText className="text-16 font-custom600 text-grey3 text-center">
          {t("no_notifications_yet")}
        </DmText>
        <DmText className="mt-[8] text-12 font-custom400 text-grey3 text-center">
          {t("no_notifications_yet_descr")}
        </DmText>
      </DmView>
    ),
    [t]
  )

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      {/* Header — title absolutely centered so the uneven side slots
          (chevron vs "mark all read") can't shift it */}
      <DmView className="flex-row items-center justify-between px-[16] py-[12]">
        <DmView
          onPress={() => navigation.goBack()}
          className="w-[32] h-[32] items-center justify-center"
        >
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView
          className="absolute left-0 right-0 items-center"
          pointerEvents="none"
        >
          <DmText className="text-16 font-custom600 text-black">
            {t("notifications")}
          </DmText>
        </DmView>
        {unreadCount > 0 ? (
          <DmView onPress={handleMarkAll} className="py-[4] z-10">
            <DmText
              className="text-11 font-custom600 text-red"
              style={{ opacity: isMarkingAll ? 0.4 : 1 }}
            >
              {t("mark_all_read")}
            </DmText>
          </DmView>
        ) : (
          <DmView className="w-[32]" />
        )}
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      {isLoading ? (
        <NotificationsSkeleton />
      ) : (
        // Same smooth reveal as proapp: content fades in over 300ms once
        // the skeleton is replaced (proapp animates fadeAnim 0→1).
        <Animated.View entering={FadeIn.duration(300)} className="flex-1">
        <FlatList
          data={allNotifications}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={
            allNotifications.length === 0 ? { flex: 1 } : { paddingBottom: 20 }
          }
          showsVerticalScrollIndicator={false}
          // Opts back OUT of the app-wide alwaysBounceVertical:false default
          // (index.js). Pull-to-refresh works by pulling PAST the top, so with
          // the bounce suppressed an empty or near-empty notification list
          // would have nothing to pull and no way to refresh at all.
          alwaysBounceVertical
          refreshControl={
            <RefreshControl
              refreshing={isPullRefreshing}
              onRefresh={handlePullRefresh}
              tintColor={colors.red}
            />
          }
        />
        </Animated.View>
      )}
    </SafeAreaView>
  )
}

export default NotificationsScreen
