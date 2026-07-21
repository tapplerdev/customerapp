import React, { useMemo } from "react"
import clsx from "clsx"
import { useTranslation } from "react-i18next"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"

import { useGetNotificationsQuery } from "services/api"
import { useTypedSelector } from "store"
import { toArabicDigits } from "helpers/digits"
import { RootStackParamList } from "navigation/types"

import LogoIconEn from "assets/icons/logo-en.svg"
import LogoIconAr from "assets/icons/logo-ar.svg"
import BellIcon from "assets/icons/bell.svg"

const HomeHeader: React.FC = () => {
  const { i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { isAuth } = useTypedSelector((store) => store.auth)

  const LogoIcon = isAr ? LogoIconAr : LogoIconEn
  // Render at the SVG's natural aspect ratio so there's no preserveAspectRatio centering gap
  const logoWidth = isAr ? 72 : 96
  const logoHeight = 25

  // Bell badge = unread stored notifications, excluding chat rows (chat unread
  // lives on the Messages tab badge, and nothing ever marks system.messages
  // read — counting them freezes the badge, the proapp "91" lesson).
  // Socket events invalidate the Notifications tag for live updates; the 60s
  // poll is the fallback for a flaky socket.
  const { data } = useGetNotificationsQuery(
    { page: 1, perPage: 100, excludeEventPrefix: "system.messages" },
    { skip: !isAuth, pollingInterval: 60000 }
  )

  const unreaded = useMemo(
    () => data?.data?.reduce((sum, n) => sum + (!n.readAt ? 1 : 0), 0) || 0,
    [data]
  )

  const badgeLabel = useMemo(() => {
    const label = unreaded > 99 ? "99+" : String(unreaded)
    return isAr ? toArabicDigits(label) : label
  }, [unreaded, isAr])

  const handleNotifications = () => {
    navigation.navigate("NotificationsScreen")
  }

  return (
    <DmView className="px-[16] py-[10] flex-row items-center justify-between">
      <DmView
        className={clsx(
          "flex-row items-center",
          isAr ? "order-2" : "order-1",
        )}
      >
        <LogoIcon width={logoWidth} height={logoHeight} />
      </DmView>

      <DmView
        className={clsx(
          "flex-row items-center z-10",
          isAr ? "order-1" : "",
        )}
      >
        {/* Bell + badge sized/offset exactly like proapp's HeaderDashboard */}
        {isAuth && (
          <DmView onPress={handleNotifications}>
            <BellIcon width={24} height={28} fill={colors.grey2} />
            {!!unreaded && (
              <DmView className="absolute top-[-8] right-[-8] bg-red rounded-full w-[20] h-[20] items-center justify-center">
                <DmText className="text-13 leading-[16px] text-white font-custom700 text-right">
                  {badgeLabel}
                </DmText>
              </DmView>
            )}
          </DmView>
        )}
      </DmView>
    </DmView>
  )
}

export default HomeHeader
