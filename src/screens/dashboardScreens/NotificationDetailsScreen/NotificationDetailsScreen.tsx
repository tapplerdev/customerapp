import React, { useEffect } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"

import { useMarkNotificationAsReadMutation } from "services/api"
import { useTypedSelector } from "store"
import { RootStackScreenProps } from "navigation/types"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import { AppScrollView } from "components/scroll"
import { Text, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

type Props = RootStackScreenProps<"NotificationDetailsScreen">

// Customer twin of proapp's UpdatesNotificationsScreen: title, greeting,
// body, team signature.
const NotificationDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { notification } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const { user } = useTypedSelector((store) => store.auth)

  const [markAsRead] = useMarkNotificationAsReadMutation()

  // Belt and braces — the list already marks on tap, but keep deep entries safe
  useEffect(() => {
    if (notification && !notification.readAt && notification.id) {
      markAsRead(notification.id)
    }
  }, [])

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
        <DmView style={[a.absolute, styles.notificationsWrap, a.items_center]} pointerEvents="none">
          <Text size={16} weight="semibold" leading="legacy">
            {t("notifications")}
          </Text>
        </DmView>
      </DmView>
      <DmView style={styles.box} />

      <AppScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <DmView style={a.px_16}>
          <Text size={16} weight="semibold" leading="loose" style={a.mt_22}>
            {notification?.title || ""}
          </Text>

          <Text size={13} weight="bold" leading={px(22)} color="brand" style={styles.text}>
            {user?.firstName ? `${t("hello")}, ${user.firstName}` : t("hello")}
          </Text>

          <Text size={13} leading={px(22)} style={a.mt_10}>
            {notification?.body || ""}
          </Text>

          <Text size={12} leading="loose" color="secondary" style={a.mt_16}>
            {t("cheers_tappler_team")}
          </Text>
        </DmView>
      </AppScrollView>
    </SafeAreaView>
  )
}

export default NotificationDetailsScreen
