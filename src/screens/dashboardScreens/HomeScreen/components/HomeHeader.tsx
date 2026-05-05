import React from "react"
import clsx from "clsx"
import { useTranslation } from "react-i18next"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"

import LogoIconEn from "assets/icons/logo-en.svg"
import LogoIconAr from "assets/icons/logo-ar.svg"
import BellIcon from "assets/icons/bell.svg"

// TODO: replace with real unread-notifications count once notifications API is wired up
const MOCK_UNREAD_COUNT = 1

const HomeHeader: React.FC = () => {
  const { i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const LogoIcon = isAr ? LogoIconAr : LogoIconEn
  // Render at the SVG's natural aspect ratio so there's no preserveAspectRatio centering gap
  const logoWidth = isAr ? 72 : 96
  const logoHeight = 25

  const unreaded = MOCK_UNREAD_COUNT

  const handleNotifications = () => {
    // TODO: navigate to notifications screen when available
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
        <DmView onPress={handleNotifications}>
          <BellIcon width={20} height={23} fill={colors.grey2} />
          {!!unreaded && (
            <DmView className="absolute top-[-8] right-[-8] bg-red rounded-full w-[20] h-[20] items-center justify-center">
              <DmText className="text-13 leading-[16px] text-white font-custom700 text-right">
                {unreaded}
              </DmText>
            </DmView>
          )}
        </DmView>
      </DmView>
    </DmView>
  )
}

export default HomeHeader
