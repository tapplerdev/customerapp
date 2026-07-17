import React from "react"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { useTranslation } from "react-i18next"

import TabBar from "components/TabBar/TabBar"
import RenderTabBarIcon from "components/RenderTabBarIcon/RenderTabBarIcon"
import HomeScreen from "screens/dashboardScreens/HomeScreen/HomeScreen"
import TalabatiScreen from "screens/dashboardScreens/TalabatiScreen/TalabatiScreen"
import MessagesScreen from "screens/dashboardScreens/MessagesScreen/MessagesScreen"
import AccountScreen from "screens/dashboardScreens/AccountScreen/AccountScreen"
import { useGetChatsQuery } from "services/api"
import { useTypedSelector } from "store"
import useChatPrefetch from "hooks/useChatPrefetch"
import { isChatVisible } from "helpers/chatVisibility"

const Tab = createBottomTabNavigator()

const HomeTabs: React.FC = () => {
  const { t } = useTranslation()
  const { isAuth } = useTypedSelector((store) => store.auth)

  // Prefetch chat list at tab level — always warm. Scoped to VISIBLE chats
  // (same predicate as the Messages list) so we neither prefetch nor count
  // chats the user can't open.
  const { data: chatsData } = useGetChatsQuery(undefined, { skip: !isAuth })
  const visibleChats = chatsData?.data?.filter(isChatVisible) || []
  useChatPrefetch(visibleChats)

  // Unread messages badge — updates instantly on read via markAllAsRead's
  // optimistic cache zero. Sharing isChatVisible with the list makes
  // "badge ⊆ list" structural: a hidden chat can never feed the badge.
  const totalUnread = visibleChats.reduce((sum, c) => sum + (c.notReadMessages || 0), 0)

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        animation: "fade",
      }}
      tabBar={(props) => <TabBar {...props} t={t} />}
    >
      <Tab.Screen
        name="home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <RenderTabBarIcon focused={focused} type="home" />
          ),
        }}
      />
      <Tab.Screen
        name="talabati"
        component={TalabatiScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <RenderTabBarIcon focused={focused} type="talabati" />
          ),
        }}
      />
      <Tab.Screen
        name="messages"
        component={MessagesScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <RenderTabBarIcon focused={focused} type="messages" badge={totalUnread} />
          ),
        }}
      />
      <Tab.Screen
        name="account"
        component={AccountScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <RenderTabBarIcon focused={focused} type="account" />
          ),
        }}
      />
    </Tab.Navigator>
  )
}

export default HomeTabs
