import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"

import { useGetNotificationsQuery } from "services/api"
import { useTypedSelector } from "store"
import { toArabicDigits } from "helpers/digits"
import { RootStackParamList } from "navigation/types"

import LogoIconEn from "assets/icons/logo-en.svg"
import LogoIconAr from "assets/icons/logo-ar.svg"
import BellIcon from "assets/icons/bell.svg"
import { Text, a } from "@tappler/shared/src/ds"
import styles from "./styles"

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
    <DmView style={[a.px_16, a.py_10, a.flex_row, a.items_center, a.justify_between]}>
      <DmView
        style={[a.flex_row, a.items_center]}
      >
        <LogoIcon width={logoWidth} height={logoHeight} />
      </DmView>

      <DmView
        style={[a.flex_row, a.items_center, styles.row]}
      >
        {/* Bell + badge sized/offset exactly like proapp's HeaderDashboard */}
        {isAuth && (
          <DmView onPress={handleNotifications}>
            <BellIcon width={24} height={28} fill={colors.grey2} />
            {!!unreaded && (
              <DmView style={[a.absolute, styles.textWrap, a.items_center, a.justify_center]}>
                <Text size={13} weight="bold" leading="tight" color="inverse" align="end">
                  {badgeLabel}
                </Text>
              </DmView>
            )}
          </DmView>
        )}
      </DmView>
    </DmView>
  )
}

export default HomeHeader
