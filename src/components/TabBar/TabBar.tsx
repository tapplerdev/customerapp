import React from "react"

import { DmView } from "@tappler/shared/src/components/UI"
import { BottomTabBarProps } from "@react-navigation/bottom-tabs"
import DropShadow from "react-native-drop-shadow"

import styles from "./styles"
import { TFunction } from "i18next"
import { Text, a, px } from "@tappler/shared/src/ds"

const TabBar = ({
  state,
  navigation,
  descriptors,
  insets,
  t,
}: BottomTabBarProps & { t: TFunction }): React.JSX.Element => {
  return (
    /*
      DropShadow, not a bare `elevation`, because the elevation never rendered
      here on Android. Measured on an API 35 emulator: every pixel row above the
      bar was pure white with `elevation: 8` declared, while the same
      elevation-plus-negative-offset style on the sheet footers does draw. Android
      also ignores shadowOffset entirely, so even where elevation shows it casts
      on all four sides rather than upward. react-native-drop-shadow draws a real
      directional shadow on both platforms — it is what MapPickerView and
      GuestLocationScreen already use for the same reason — so iOS and Android
      finally get the same soft shadow above the bar. The shadow props stay in
      styles.shadow; the wrapper reads them, the inner view keeps the background
      so the shadow has an opaque shape to cast from.
    */
    <DropShadow style={styles.shadow}>
    <DmView
      style={[styles.box, {
        paddingBottom:
          insets.bottom > 31
            ? insets.bottom - (insets.bottom - 31)
            : 31 - insets.bottom,
      }]}
    >
      <DmView style={styles.box2} />
      <DmView style={[a.flex_row, a.justify_between]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index
          const { options } = descriptors[route.key]
          return (
            <DmView
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                })

                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name)
                }
              }}
              key={route.key}
              style={[a.items_center, a.justify_center, styles.item]}
            >
              {!!options.tabBarIcon &&
                options.tabBarIcon({ focused, color: "", size: 24 })}
              <Text
                size={11}
                weight={focused ? "semibold" : "medium"}
                leading={px(18)}
                style={[a.mt_2, styles.text, focused && styles.textFocused]}
              >
                {t(route.name)}
              </Text>
            </DmView>
          )
        })}
      </DmView>
    </DmView>
    </DropShadow>
  )
}

export default TabBar
