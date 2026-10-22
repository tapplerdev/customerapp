/*
 * Jest only, for example.parity.tsx: WelcomeScreen.tsx as it is after W2
 * (off NativeWind, on ds Text and Button), with one change: the second title's top margin 12 for 11, in every row.
 * Every comparison it changes must fail.
 */
import React, { useEffect, useState } from "react"

// Components
import { DmView } from "@tappler/shared/src/components/UI"
import LegacyText from "@tappler/shared/src/components/LegacyText"
import { SafeAreaView } from "react-native-safe-area-context"
import RNRestart from "react-native-restart"

// Hooks & Redux
import { useDispatch } from "react-redux"
import { setCurrentScreen, setLanguage } from "store/auth/slice"
import { useTypedSelector } from "store"

// Helpers & Types
import { RootStackScreenProps } from "navigation/types"

// Styles & Assets
import { I18nManager } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"
import { Text, Button, a, px } from "@tappler/shared/src/ds"
import styles from "screens/onboardingScreens/WelcomeScreen/styles"

type Props = RootStackScreenProps<"WelcomeScreen">

const WelcomeScreen: React.FC<Props> = () => {
  const [isLoading, setLoading] = useState(false)
  const { currentScreen } = useTypedSelector((store) => store.auth)
  const dispatch = useDispatch()

  const handleSubmit = (lng: "en" | "ar") => {
    dispatch(setLanguage(lng))
    setLoading(true)
    dispatch(setCurrentScreen("auth-welcome"))
    setTimeout(() => {
      RNRestart.restart()
    }, 100)
  }

  useEffect(() => {
    if (currentScreen) {
      dispatch(setCurrentScreen(undefined))
    }
  }, [])

  return (
    <SafeAreaView style={[a.flex_1, a.justify_center, a.items_center, styles.safeArea]}>
      {isLoading && <LoadingOverlay />}
      {!isLoading && (
        <>
          <Text size={18} weight="bold" leading={px(31)} align="center" family="arabic">
            الرجاء اختيار اللغة
          </Text>
          <Text size={18} weight="semibold" leading="tight" align="center" family="latin" style={[styles.text, { marginTop: 12 }]}>
            Please Select Your Language
          </Text>
          <DmView
            style={[
              styles.row,
              a.w_full,
              a.flex_row,
              a.items_center,
              a.justify_between,
              I18nManager.isRTL && styles.rowRtl,
            ]}
          >
            <Button
              labelFamily="latin"
              style={[a.mr_10, a.flex_1, I18nManager.isRTL && styles.buttonRtl]}
              onPress={() => handleSubmit("en")}
              title="English"
            />
            <Button
              labelWeight="bold"
              labelFamily="arabic"
              labelLeading={I18nManager.isRTL ? undefined : "loose"}
              style={[
                a.ml_10,
                a.flex_1,
                I18nManager.isRTL && styles.buttonRtl2,
              ]}
              onPress={() => handleSubmit("ar")}
              title="عربي"
            />
          </DmView>
          <LegacyText
            family="system"
            arabicLeading={px(22)}
            style={styles.arabicNote}
          >
            يمكنك تغيير اللغة في أي وقت بالذهاب الى "الإعدادات"
          </LegacyText>
          <Text size={12} leading="legacy" align="center" family="latin" style={[a.mt_10, styles.text2]}>
            You can change the language later from "Settings"
          </Text>
        </>
      )}
    </SafeAreaView>
  )
}

export default WelcomeScreen
