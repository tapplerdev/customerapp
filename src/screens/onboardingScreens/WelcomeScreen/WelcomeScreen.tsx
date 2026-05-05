import React, { useEffect, useState } from "react"

// Components
import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { SafeAreaView } from "react-native-safe-area-context"
import RNRestart from "react-native-restart"

// Hooks & Redux
import { useDispatch } from "react-redux"
import { setCurrentScreen, setLanguage } from "store/auth/slice"
import { useTypedSelector } from "store"

// Helpers & Types
import { RootStackScreenProps } from "navigation/types"

// Styles & Assets
import clsx from "clsx"
import { I18nManager } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"

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
    <SafeAreaView className="flex-1 justify-center items-center px-[33] bg-white">
      {isLoading && <LoadingOverlay />}
      {!isLoading && (
        <>
          <DmText className="font-sans700 text-18 leading-[31px] text-center">
            الرجاء اختيار اللغة
          </DmText>
          <DmText className="mt-[11] font-montserrat600 text-18 leading-[22px] text-center">
            Please Select Your Language
          </DmText>
          <DmView
            className={clsx(
              "mt-[21] w-full flex-row items-center justify-between",
              I18nManager.isRTL && "flex-row-reverse"
            )}
          >
            <ActionBtn
              className={clsx(
                "mr-[10] flex-1",
                I18nManager.isRTL && "ml-[10] mr-[0]"
              )}
              onPress={() => handleSubmit("en")}
              textClassName="font-montserrat500"
              title="English"
            />
            <ActionBtn
              className={clsx(
                "ml-[10] flex-1",
                I18nManager.isRTL && "mr-[10] ml-[0]"
              )}
              textClassName={clsx(
                "font-sans700",
                !I18nManager.isRTL && "leading-[25px]"
              )}
              onPress={() => handleSubmit("ar")}
              title="عربي"
            />
          </DmView>
          <DmText className="mt-[32] text-13 text-grey font-sans400 leading-[22px] text-center">
            يمكنك تغيير اللغة في أي وقت بالذهاب الى "الإعدادات"
          </DmText>
          <DmText className="mt-[10] text-grey text-12 font-montserrat400 text-center">
            You can change the language later from "Settings"
          </DmText>
        </>
      )}
    </SafeAreaView>
  )
}

export default WelcomeScreen
