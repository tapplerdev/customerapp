import React, { useCallback, useState } from "react"
import { Image } from "react-native"
import { DmChecbox, DmView } from "@tappler/shared/src/components/UI"
import { MainModal } from "@tappler/shared/src/components"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { RootStackParamList } from "navigation/types"
import { useDispatch } from "react-redux"
import { useTypedSelector } from "store"
import { setCurrentScreen, setLanguage } from "store/auth/slice"
import { signOut } from "services/session"
import { useModalHandler } from "@tappler/shared/src/hooks/useModalHandler"
import RNRestart from "react-native-restart"
import LogoutModal from "components/LogoutModal"

import AccountDetailsIcon from "assets/icons/Account_Details.svg"
import AccountPinIcon from "assets/icons/Account_Pin.svg"
import AccountReviewsIcon from "assets/icons/Account_Reviews.svg"
import AccountSettingsIcon from "assets/icons/Account_Settings.svg"
import AccountLangIcon from "assets/icons/Account_lang.svg"
import AccountAboutIcon from "assets/icons/Account_About.svg"
import AccountCustomerServiceIcon from "assets/icons/Account_Customer_Service.svg"
import AccountLogoutIcon from "assets/icons/Account_logout.svg"
import TapplerLogoIcon from "assets/icons/tappler-logo-red.svg"

import authImg from "assets/images/auth.png"
import AccountMenuItem from "./components/AccountMenuItem"
import { AppScrollView } from "components/scroll"
import { Text, Button, a } from "@tappler/shared/src/ds"
import styles from "./styles"

const APP_VERSION = "1"
const APP_BUILD = "25"

const AccountScreen: React.FC = () => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const dispatch = useDispatch()
  const { isAuth, user } = useTypedSelector((store) => store.auth)

  const [isLangModalVisible, setLangModalVisible] = useState(false)
  // Sign-out takes a network round trip now (services/session), and nothing
  // closes the confirm on Yes — the screen re-renders into its guest branch
  // once the auth flip lands. Until then both buttons must be dead: a No
  // tapped in that window would look like a cancel that then signs out anyway.
  const [isSigningOut, setSigningOut] = useState(false)
  const { modalVisible: isLogoutModalVisible, openModal: openLogoutModal, closeModal: closeLogoutModal, onModalHide: onLogoutModalHide, queueNextAction } = useModalHandler()

  const rootNavigation = navigation.getParent()

  const handleLogOut = () => {
    setSigningOut(true)
    setTimeout(() => {
      // Backend + Firebase first, then the local sign-out (services/session).
      void signOut()
    }, 300)
  }

  const userName = user?.firstName || t("guest")

  const languageDisplayText = isAr ? t("arabic") : t("english")

  const handleAccountDetails = useCallback(() => {
    navigation.navigate("AccountDetailsScreen")
  }, [navigation])

  const handleChangeLanguage = useCallback(async (lng: "en" | "ar") => {
    setLangModalVisible(false)
    if (lng === i18n.language) return

    dispatch(setCurrentScreen("home"))
    dispatch(setLanguage(lng))

    setTimeout(() => {
      RNRestart.restart()
    }, 100)
  }, [i18n.language, dispatch])

  if (!isAuth) {
    return (
      <SafeAreaView edges={["top"]} style={[a.flex_1, styles.safeArea]}>
        <AppScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Guest CTA */}
          <DmView style={[a.items_center, a.mt_40, a.px_30]}>
            <Image
              source={authImg}
              style={{ width: 220, height: 146 }}
              resizeMode="contain"
            />
            <Text size={20} weight="semibold" leading="legacy" align="center" style={a.mt_24}>
              {t("sign_in_for_full_experience")}
            </Text>
            <Text size={13} leading="legacy" color="tertiary" align="center" style={a.mt_8}>
              {t("guest_account_benefits")}
            </Text>

            <DmView style={[a.w_full, a.mt_28, a.px_16]}>
              <Button
                size="md"
                title={t("create_account")}
                onPress={() => navigation.navigate("RegisterScreen")}
              />
              <Button
                size="md"
                variant="white"
                style={a.mt_12}
                title={t("log_In")}
                onPress={() => navigation.navigate("AuthWelcomeScreen")}
              />
            </DmView>
          </DmView>

          {/* Divider */}
          <DmView style={[styles.box, a.mt_32]} />

          {/* Guest-accessible menu items */}
          <DmView>
            <AccountMenuItem
              Icon={AccountLangIcon}
              label={t("language")}
              accessory="text"
              accessoryText={languageDisplayText}
              onPress={() => setLangModalVisible(true)}
              showSeparator
            />
            <AccountMenuItem
              Icon={AccountAboutIcon}
              label={t("about_app")}
              accessory="chevron"
              onPress={() => navigation.navigate("AboutAppScreen")}
              showSeparator
            />
            <AccountMenuItem
              Icon={AccountCustomerServiceIcon}
              label={t("customer_service")}
              accessory="chevron"
              onPress={() => {}}
              showSeparator={false}
            />
          </DmView>

          {/* Spacer */}
          <DmView style={a.flex_1} />

          {/* Footer */}
          <DmView style={[a.items_center, a.mt_32, a.mb_16]}>
            <DmView onPress={() => {}}>
              <Text size={12} leading="legacy" align="center" style={styles.offeringServices}>
                {t("offering_services")}
              </Text>
            </DmView>
            <DmView style={[a.mt_24, a.items_center]}>
              <TapplerLogoIcon width={100} height={24} />
              <Text size={10} leading="legacy" align="center" style={[a.mt_4, styles.offeringServices]}>
                {t("version")}: {APP_VERSION} {t("build")}: {APP_BUILD}
              </Text>
            </DmView>
          </DmView>
        </AppScrollView>

        {/* Language Modal */}
        <MainModal
          isVisible={isLangModalVisible}
          onClose={() => setLangModalVisible(false)}
          title={t("choose_your_language")}
          titleStyle={[styles.mainModalTitle, a.mt_0, a.w_full]}
          cardStyle={[a.pt_16, styles.mainModalCard, a.px_32]}
        >
          <DmView style={[styles.box2, a.w_full]}>
            <DmChecbox
              title={t("arabic")}
              isChecked={i18n.language === "ar"}
              textClassName="font-sans400"
              onPress={() => handleChangeLanguage("ar")}
            />
            <DmChecbox
              title={t("english")}
              onPress={() => handleChangeLanguage("en")}
              style={styles.box2}
              textType={{ weight: "regular" }}
              isChecked={i18n.language === "en"}
            />
          </DmView>
        </MainModal>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={["top"]} style={[a.flex_1, styles.safeArea]}>
      <AppScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <DmView style={[a.px_16, a.pt_24, a.pb_16]}>
          <DmView style={a.flex_row}>
            <Text size={22} weight="bold">
              {t("hi_name", { name: userName })}
            </Text>
          </DmView>
        </DmView>
        <DmView style={styles.box} />

        {/* Menu Items */}
        <DmView>
          <AccountMenuItem
            Icon={AccountDetailsIcon}
            label={t("account_details")}
            accessory="chevron"
            onPress={handleAccountDetails}
            showSeparator
          />
          <AccountMenuItem
            Icon={AccountPinIcon}
            label={t("my_saved_addresses")}
            accessory="chevron"
            onPress={() => navigation.navigate("MySavedAddressesScreen")}
            showSeparator
          />
          <AccountMenuItem
            Icon={AccountReviewsIcon}
            label={t("my_reviews")}
            accessory="chevron"
            onPress={() => {}}
            showSeparator
          />
          <AccountMenuItem
            Icon={AccountSettingsIcon}
            label={t("settings")}
            accessory="chevron"
            onPress={() => {}}
            showSeparator
          />
          <AccountMenuItem
            Icon={AccountLangIcon}
            label={t("language")}
            accessory="text"
            accessoryText={languageDisplayText}
            onPress={() => setLangModalVisible(true)}
            showSeparator
          />
          <AccountMenuItem
            Icon={AccountAboutIcon}
            label={t("about_app")}
            accessory="chevron"
            onPress={() => navigation.navigate("AboutAppScreen")}
            showSeparator
          />
          <AccountMenuItem
            Icon={AccountCustomerServiceIcon}
            label={t("customer_service")}
            accessory="chevron"
            onPress={() => {}}
            showSeparator
          />
          <AccountMenuItem
            Icon={AccountLogoutIcon}
            label={t("logout")}
            accessory="none"
            textVariant="brand"
            onPress={openLogoutModal}
            showSeparator={false}
          />
        </DmView>

        {/* Spacer */}
        <DmView style={a.flex_1} />

        {/* Footer */}
        <DmView style={[a.items_center, a.mt_32, a.mb_16]}>
          <DmView onPress={() => {}}>
            <Text size={12} leading="legacy" align="center" style={styles.offeringServices}>
              {t("offering_services")}
            </Text>
          </DmView>
          <DmView style={[a.mt_24, a.items_center]}>
            <TapplerLogoIcon width={100} height={24} />
            <Text size={10} leading="legacy" align="center" style={[a.mt_4, styles.offeringServices]}>
              {t("version")}: {APP_VERSION} {t("build")}: {APP_BUILD}
            </Text>
          </DmView>
        </DmView>
      </AppScrollView>

      {/* Language Modal */}
      <MainModal
        isVisible={isLangModalVisible}
        onClose={() => setLangModalVisible(false)}
        title={t("choose_your_language")}
        titleStyle={[styles.mainModalTitle, a.mt_0, a.w_full]}
        cardStyle={[a.pt_16, styles.mainModalCard, a.px_32]}
      >
        <DmView style={[styles.box2, a.w_full]}>
          <DmChecbox
            title={t("arabic")}
            isChecked={i18n.language === "ar"}
            textClassName="font-sans400"
            onPress={() => handleChangeLanguage("ar")}
          />
          <DmChecbox
            title={t("english")}
            onPress={() => handleChangeLanguage("en")}
            style={styles.box2}
            textType={{ weight: "regular" }}
            isChecked={i18n.language === "en"}
          />
        </DmView>
      </MainModal>

      {/* Logout Modal */}
      <LogoutModal
        isVisible={isLogoutModalVisible}
        onClose={closeLogoutModal}
        onModalHide={onLogoutModalHide}
        onPress={handleLogOut}
        isLoading={isSigningOut}
      />
    </SafeAreaView>
  )
}

export default AccountScreen
