import React from "react"

import { DmView } from "@tappler/shared/src/components/UI"

import HomeIcon from "assets/icons/home.svg"
import HomeActiveIcon from "assets/icons/home-active.svg"
import TalabatiIcon from "assets/icons/talabati.svg"
import TalabatiActiveIcon from "assets/icons/talabati-active.svg"
import MessagesIcon from "assets/icons/messages.svg"
import MessagesActiveIcon from "assets/icons/messages-active.svg"
import AccountIcon from "assets/icons/account.svg"
import AccountActiveIcon from "assets/icons/account-active.svg"
import { Text, a } from "@tappler/shared/src/ds"
import styles from "./styles"

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
    <DmView style={[styles.container, a.items_center, a.justify_center]}>
      {renderIcon()}
      {!!badge && badge > 0 && (
        <DmView style={[a.absolute, styles.textWrap, a.items_center, a.justify_center, a.px_4]}>
          <Text size={10} weight="bold" color="inverse">
            {badge > 99 ? "99+" : badge}
          </Text>
        </DmView>
      )}
    </DmView>
  )
}

export default RenderTabBarIcon
