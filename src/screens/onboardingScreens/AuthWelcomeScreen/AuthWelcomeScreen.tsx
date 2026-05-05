import React, { useState } from "react"

// Components
import {
  ActionBtn,
  DmText,
  DmView,
} from "@tappler/shared/src/components/UI"
import { SafeAreaView } from "react-native-safe-area-context"
import {
  Image,
  ScrollView,
  TouchableOpacity,
} from "react-native"

// Hooks & Redux
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { setLanguage, setCurrentScreen } from "store/auth/slice"
import { useTypedSelector } from "store"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

// Helpers & Types
import { RootStackScreenProps, RootStackParamList } from "navigation/types"

// Libs & Utils
import RNRestart from "react-native-restart"
import colors from "@tappler/shared/src/styles/colors"

// Assets
import EmailIcon from "assets/icons/email.svg"
import FacebookIcon from "assets/icons/facebook.svg"
import GoogleIcon from "assets/icons/google.svg"
import GuestIcon from "assets/icons/guest.svg"
import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import TapplerLogoIcon from "assets/icons/tappler-logo-red.svg"
import authImg from "assets/images/auth.png"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"

const APP_VERSION = "1.0.0"
const APP_BUILD = "1"

type Props = RootStackScreenProps<"AuthWelcomeScreen">

const AuthWelcomeScreen: React.FC<Props> = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { language, guestLocation } = useTypedSelector((store) => store.auth)
  const hasGuestLocation = !!(guestLocation?.coords || guestLocation?.address)
  const [isLoading, setLoading] = useState(false)

  const handleToggleLanguage = () => {
    const next = language === "en" ? "ar" : "en"
    setLoading(true)
    dispatch(setCurrentScreen("auth-welcome"))
    dispatch(setLanguage(next))
    setTimeout(() => {
      RNRestart.restart()
    }, 100)
  }

  const handleEmail = () => {
    navigation.navigate("SignInEmailScreen")
  }
  const handleFacebook = () => {
  }
  const handleGoogle = () => {
  }
  const handleGuest = () => {
    navigation.navigate("GuestLocationScreen")
  }

  // Show the OPPOSITE language as the toggle target
  const toggleLabel = language === "en" ? "عربي" : "English"
  const toggleFontClass =
    language === "en" ? "font-sans700" : "font-montserrat700"

  if (isLoading) {
    return <LoadingOverlay />
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <DmView className="flex-row justify-between items-center px-[24] pt-[12]">
        {hasGuestLocation ? (
          <TouchableOpacity onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.reset({ index: 0, routes: [{ name: "HomeTabs" }] })} activeOpacity={0.7}>
            <ChevronLeftIcon
              color={colors.red}
              style={language === "ar" ? { transform: [{ rotate: "180deg" }] } : undefined}
            />
          </TouchableOpacity>
        ) : (
          <DmView />
        )}
        <TouchableOpacity
          onPress={handleToggleLanguage}
          activeOpacity={0.7}
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}
        >
          <DmText className={`text-15 text-red ${toggleFontClass}`}>
            {toggleLabel}
          </DmText>
        </TouchableOpacity>
      </DmView>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22 }}
        showsVerticalScrollIndicator={false}
      >
        <DmView className="items-center mt-[20]">
          <DmText className="text-20 font-custom600 text-black1 text-center">
            {t("welcome_to_tappler")}
          </DmText>
          <DmText className="mt-[8] text-12 text-black1 font-custom400 text-center">
            {t("choose_signup_method")}
          </DmText>
        </DmView>

        <DmView className="items-center mt-[16]">
          <Image
            source={authImg}
            style={{ width: 303, height: 202 }}
            resizeMode="contain"
          />
        </DmView>

        <DmView className="mt-[16]">
          <ActionBtn
            Icon={<EmailIcon width={22} height={22} />}
            title={t("sign_in_with_email")}
            variant="white"
            className="rounded-10"
            textClassName="text-13"
            onPress={handleEmail}
          />
          <ActionBtn
            Icon={<FacebookIcon width={22} height={22} />}
            title={t("sign_in_with_facebook")}
            variant="white"
            className="mt-[10] rounded-10"
            textClassName="text-13"
            onPress={handleFacebook}
          />
          <ActionBtn
            Icon={<GoogleIcon width={22} height={22} />}
            title={t("sign_in_with_google")}
            variant="white"
            className="mt-[10] rounded-10"
            textClassName="text-13"
            onPress={handleGoogle}
          />

          {!hasGuestLocation ? (
            <ActionBtn
              Icon={<GuestIcon width={22} height={22} />}
              title={t("continue_as_guest")}
              variant="white"
              className="mt-[66] rounded-10"
              textClassName="text-13"
              onPress={handleGuest}
            />
          ) : (
            <ActionBtn
              title={t("dont_have_an_account")}
              descr={t("create_an_account")}
              variant="white"
              className="mt-[66] rounded-10"
              textClassName="text-13"
              onPress={() => navigation.navigate("RegisterScreen")}
            />
          )}
        </DmView>
      </ScrollView>

      {/* Logo + Terms & Version — pinned to bottom */}
      <DmView className="items-center pb-[16] pt-[8]" style={language === "ar" ? { paddingRight: 20 } : { paddingLeft: 10 }}>
        <TapplerLogoIcon width={40} height={40} />
      </DmView>
      <DmView className="items-center pb-[16]">
        <DmView className="flex-row items-center justify-center">
          <TouchableOpacity
            onPress={() => {}}
            activeOpacity={0.7}
          >
            <DmText className="font-custom600 text-grey3 text-11">
              {t("terms_of_service")}
            </DmText>
          </TouchableOpacity>
          <DmText className="mx-[10] font-custom600 text-grey3 text-11">
            |
          </DmText>
          <TouchableOpacity
            onPress={() => {}}
            activeOpacity={0.7}
          >
            <DmText className="font-custom600 text-grey3 text-11">
              {t("privacy_policy")}
            </DmText>
          </TouchableOpacity>
        </DmView>
        <DmText className="mt-[5] font-custom500 text-grey3 text-center text-9">
          {`${t("version")} ${APP_VERSION} - ${t("build")}:${APP_BUILD}`}
        </DmText>
      </DmView>
    </SafeAreaView>
  )
}

export default AuthWelcomeScreen
