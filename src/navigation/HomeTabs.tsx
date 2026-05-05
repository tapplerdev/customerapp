import React from "react"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { useTranslation } from "react-i18next"

import TabBar from "components/TabBar/TabBar"
import RenderTabBarIcon from "components/RenderTabBarIcon/RenderTabBarIcon"
import HomeScreen from "screens/dashboardScreens/HomeScreen/HomeScreen"
import TalabatiScreen from "screens/dashboardScreens/TalabatiScreen/TalabatiScreen"
import MessagesScreen from "screens/dashboardScreens/MessagesScreen/MessagesScreen"
import AccountScreen from "screens/dashboardScreens/AccountScreen/AccountScreen"

const Tab = createBottomTabNavigator()

const HomeTabs: React.FC = () => {
  const { t } = useTranslation()

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
            <RenderTabBarIcon focused={focused} type="messages" />
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
