import React, { useState } from "react"

// Components
import { DmView } from "@tappler/shared/src/components/UI"
import { SafeAreaView } from "react-native-safe-area-context"
import { Image, TouchableOpacity } from "react-native"

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
import { AppScrollView } from "components/scroll"
import { Text, Button, a } from "@tappler/shared/src/ds"
import styles from "./styles"

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

  if (isLoading) {
    return <LoadingOverlay />
  }

  return (
    <SafeAreaView style={[a.flex_1, styles.safeArea]}>
      <DmView style={[a.flex_row, a.justify_between, a.items_center, a.px_24, a.pt_12]}>
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
          <Text size={15} weight="bold" leading="legacy" color="brand" family={language === "en" ? "arabic" : "latin"}>
            {toggleLabel}
          </Text>
        </TouchableOpacity>
      </DmView>

      <AppScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22 }}
        showsVerticalScrollIndicator={false}
      >
        <DmView style={[a.items_center, a.mt_20]}>
          <Text size={20} weight="semibold" leading="legacy" align="center" style={styles.welcomeToTappler}>
            {t("welcome_to_tappler")}
          </Text>
          <Text size={12} leading="legacy" align="center" style={[a.mt_8, styles.welcomeToTappler]}>
            {t("choose_signup_method")}
          </Text>
        </DmView>

        <DmView style={[a.items_center, a.mt_16]}>
          <Image
            source={authImg}
            style={{ width: 303, height: 202 }}
            resizeMode="contain"
          />
        </DmView>

        <DmView style={a.mt_16}>
          <Button
            icon={<EmailIcon width={22} height={22} />}
            title={t("sign_in_with_email")}
            shape="r10"
            variant="white"
            label="sm"
            labelLeading="legacy"
            onPress={handleEmail}
          />
          <Button
            icon={<FacebookIcon width={22} height={22} />}
            title={t("sign_in_with_facebook")}
            shape="r10"
            variant="white"
            label="sm"
            labelLeading="legacy"
            style={a.mt_10}
            onPress={handleFacebook}
          />
          <Button
            icon={<GoogleIcon width={22} height={22} />}
            title={t("sign_in_with_google")}
            shape="r10"
            variant="white"
            label="sm"
            labelLeading="legacy"
            style={a.mt_10}
            onPress={handleGoogle}
          />

          {!hasGuestLocation ? (
            <Button
              icon={<GuestIcon width={22} height={22} />}
              title={t("continue_as_guest")}
              shape="r10"
              variant="white"
              label="sm"
              labelLeading="legacy"
              style={styles.button}
              onPress={handleGuest}
            />
          ) : (
            <Button
              title={t("dont_have_an_account")}
              description={t("create_an_account")}
              shape="r10"
              variant="white"
              label="sm"
              labelLeading="legacy"
              style={styles.button}
              onPress={() => navigation.navigate("RegisterScreen")}
            />
          )}
        </DmView>
      </AppScrollView>

      {/* Logo + Terms & Version — pinned to bottom */}
      <DmView style={[a.items_center, a.pb_16, a.pt_8, language === "ar" ? { paddingRight: 20 } : { paddingLeft: 10 }]}>
        <TapplerLogoIcon width={40} height={40} />
      </DmView>
      <DmView style={[a.items_center, a.pb_16]}>
        <DmView style={[a.flex_row, a.items_center, a.justify_center]}>
          <TouchableOpacity
            onPress={() => {}}
            activeOpacity={0.7}
          >
            <Text size={11} weight="semibold" leading="legacy" color="tertiary">
              {t("terms_of_service")}
            </Text>
          </TouchableOpacity>
          <Text size={11} weight="semibold" leading="legacy" color="tertiary" style={a.mx_10}>
            |
          </Text>
          <TouchableOpacity
            onPress={() => {}}
            activeOpacity={0.7}
          >
            <Text size={11} weight="semibold" leading="legacy" color="tertiary">
              {t("privacy_policy")}
            </Text>
          </TouchableOpacity>
        </DmView>
        <Text size={9} weight="medium" leading="legacy" color="tertiary" align="center" style={styles.text}>
          {`${t("version")} ${APP_VERSION} - ${t("build")}:${APP_BUILD}`}
        </Text>
      </DmView>
    </SafeAreaView>
  )
}

export default AuthWelcomeScreen
