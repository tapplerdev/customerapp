import React from "react"

import { DmText, DmView } from "@tappler/shared/src/components/UI"

import HomeIcon from "assets/icons/home.svg"
import HomeActiveIcon from "assets/icons/home-active.svg"
import TalabatiIcon from "assets/icons/talabati.svg"
import TalabatiActiveIcon from "assets/icons/talabati-active.svg"
import MessagesIcon from "assets/icons/messages.svg"
import MessagesActiveIcon from "assets/icons/messages-active.svg"
import AccountIcon from "assets/icons/account.svg"
import AccountActiveIcon from "assets/icons/account-active.svg"

interface Props {
  type: "home" | "talabati" | "messages" | "account"
  focused: boolean
  badge?: number
}

const RenderTabBarIcon: React.FC<Props> = ({ type, focused, badge }) => {
  const renderIcon = () => {
    switch (type) {
      case "home":
        return focused ? <HomeActiveIcon /> : <HomeIcon />
      case "talabati":
        return focused ? <TalabatiActiveIcon /> : <TalabatiIcon />
      case "messages":
        return focused ? <MessagesActiveIcon /> : <MessagesIcon />
      case "account":
        return focused ? <AccountActiveIcon /> : <AccountIcon />
    }
  }
  return (
    <DmView className="w-[22] h-[22] items-center justify-center">
      {renderIcon()}
      {!!badge && badge > 0 && (
        <DmView className="absolute top-[-8] right-[-12] bg-red rounded-full min-w-[18] h-[18] items-center justify-center px-[4]">
          <DmText className="text-10 leading-[13px] text-white font-custom700">
            {badge > 99 ? "99+" : badge}
          </DmText>
        </DmView>
      )}
    </DmView>
  )
}

export default RenderTabBarIcon
