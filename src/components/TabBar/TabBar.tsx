import React from "react"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { BottomTabBarProps } from "@react-navigation/bottom-tabs"

import styles from "./styles"
import clsx from "clsx"
import { TFunction } from "i18next"

const TabBar = ({
  state,
  navigation,
  descriptors,
  insets,
  t,
}: BottomTabBarProps & { t: TFunction }): JSX.Element => {
  return (
    <DmView
      className="bg-white"
      style={[styles.shadow, {
        paddingBottom:
          insets.bottom > 31
            ? insets.bottom - (insets.bottom - 31)
            : 31 - insets.bottom,
      }]}
    >
      <DmView className="h-[20]" />
      <DmView className="flex-row justify-between">
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
              className="items-center justify-center"
              style={styles.item}
            >
              {!!options.tabBarIcon &&
                options.tabBarIcon({ focused, color: "", size: 24 })}
              <DmText
                className={clsx(
                  "mt-[2] text-grey17 text-11 leading-[18px]",
                  !focused && "font-custom500",
                  focused && "text-black font-custom600"
                )}
              >
                {t(route.name)}
              </DmText>
            </DmView>
          )
        })}
      </DmView>
    </DmView>
  )
}

export default TabBar
