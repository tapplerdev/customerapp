import React, { useEffect } from "react"
import { ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"

import { useMarkNotificationAsReadMutation } from "services/api"
import { useTypedSelector } from "store"
import { RootStackScreenProps } from "navigation/types"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"

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
        <DmView className="absolute left-0 right-0 items-center" pointerEvents="none">
          <DmText className="text-16 font-custom600 text-black">
            {t("notifications")}
          </DmText>
        </DmView>
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <DmView className="px-[16]">
          <DmText className="mt-[22] text-16 leading-[25px] font-custom600">
            {notification?.title || ""}
          </DmText>

          <DmText className="mt-[17] text-13 leading-[22px] font-custom700 text-red">
            {user?.firstName ? `${t("hello")}, ${user.firstName}` : t("hello")}
          </DmText>

          <DmText className="mt-[10] text-13 leading-[22px] font-custom400">
            {notification?.body || ""}
          </DmText>

          <DmText className="mt-[16] text-12 leading-[20px] font-custom400 text-grey2">
            {t("cheers_tappler_team")}
          </DmText>
        </DmView>
      </ScrollView>
    </SafeAreaView>
  )
}

export default NotificationDetailsScreen
