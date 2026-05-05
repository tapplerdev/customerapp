import React, { useCallback, useState } from "react"
import { Image, ScrollView } from "react-native"
import { ActionBtn, DmChecbox, DmText, DmView } from "@tappler/shared/src/components/UI"
import { MainModal } from "@tappler/shared/src/components"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { RootStackParamList } from "navigation/types"
import { useDispatch } from "react-redux"
import { useTypedSelector } from "store"
import { logout, setCurrentScreen, setLanguage } from "store/auth/slice"
import { api } from "services/api"
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

const APP_VERSION = "1"
const APP_BUILD = "25"

const AccountScreen: React.FC = () => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const dispatch = useDispatch()
  const { isAuth, user } = useTypedSelector((store) => store.auth)

  const [isLangModalVisible, setLangModalVisible] = useState(false)
  const { modalVisible: isLogoutModalVisible, openModal: openLogoutModal, closeModal: closeLogoutModal, onModalHide: onLogoutModalHide, queueNextAction } = useModalHandler()

  const rootNavigation = navigation.getParent()

  const handleLogOut = () => {
    setTimeout(() => {
      dispatch(logout())
      dispatch(api.util.resetApiState())
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
      <SafeAreaView edges={["top"]} className="flex-1 bg-white">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Guest CTA */}
          <DmView className="items-center mt-[40] px-[30]">
            <Image
              source={authImg}
              style={{ width: 220, height: 146 }}
              resizeMode="contain"
            />
            <DmText className="mt-[24] text-20 font-custom600 text-black text-center">
              {t("sign_in_for_full_experience")}
            </DmText>
            <DmText className="mt-[8] text-13 font-custom400 text-grey3 text-center">
              {t("guest_account_benefits")}
            </DmText>

            <DmView className="w-full mt-[28] px-[16]">
              <ActionBtn
                className="h-[44]"
                title={t("create_account")}
                onPress={() => navigation.navigate("RegisterScreen")}
              />
              <ActionBtn
                className="mt-[12] h-[44]"
                variant="white"
                title={t("log_In")}
                onPress={() => navigation.navigate("AuthWelcomeScreen")}
              />
            </DmView>
          </DmView>

          {/* Divider */}
          <DmView className="h-[0.7] bg-grey19 mt-[32]" />

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
          <DmView className="flex-1" />

          {/* Footer */}
          <DmView className="items-center mt-[32] mb-[16]">
            <DmView onPress={() => {}}>
              <DmText className="text-12 font-custom400 text-grey15 text-center">
                {t("offering_services")}
              </DmText>
            </DmView>
            <DmView className="mt-[24] items-center">
              <TapplerLogoIcon width={100} height={24} />
              <DmText className="mt-[4] text-10 font-custom400 text-grey15 text-center">
                {t("version")}: {APP_VERSION} {t("build")}: {APP_BUILD}
              </DmText>
            </DmView>
          </DmView>
        </ScrollView>

        {/* Language Modal */}
        <MainModal
          isVisible={isLangModalVisible}
          onClose={() => setLangModalVisible(false)}
          title={t("choose_your_language")}
          classNameTitle="text-left mt-[0] w-full"
          className="pt-[16] pb-[33] px-[32]"
        >
          <DmView className="mt-[23] items-left w-full">
            <DmChecbox
              title={t("arabic")}
              isChecked={i18n.language === "ar"}
              textClassName="font-sans400"
              onPress={() => handleChangeLanguage("ar")}
            />
            <DmChecbox
              title={t("english")}
              onPress={() => handleChangeLanguage("en")}
              className="mt-[23]"
              textClassName="font-custom400"
              isChecked={i18n.language === "en"}
            />
          </DmView>
        </MainModal>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <DmView className="px-[16] pt-[24] pb-[16]">
          <DmView className="flex-row">
            <DmText className="text-22 leading-[29px] font-custom700 text-black">
              {t("hi_name", { name: userName })}
            </DmText>
          </DmView>
        </DmView>
        <DmView className="h-[0.7] bg-grey19" />

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
            textVariant="red"
            onPress={openLogoutModal}
            showSeparator={false}
          />
        </DmView>

        {/* Spacer */}
        <DmView className="flex-1" />

        {/* Footer */}
        <DmView className="items-center mt-[32] mb-[16]">
          <DmView onPress={() => {}}>
            <DmText className="text-12 font-custom400 text-grey15 text-center">
              {t("offering_services")}
            </DmText>
          </DmView>
          <DmView className="mt-[24] items-center">
            <TapplerLogoIcon width={100} height={24} />
            <DmText className="mt-[4] text-10 font-custom400 text-grey15 text-center">
              {t("version")}: {APP_VERSION} {t("build")}: {APP_BUILD}
            </DmText>
          </DmView>
        </DmView>
      </ScrollView>

      {/* Language Modal */}
      <MainModal
        isVisible={isLangModalVisible}
        onClose={() => setLangModalVisible(false)}
        title={t("choose_your_language")}
        classNameTitle="text-left mt-[0] w-full"
        className="pt-[16] pb-[33] px-[32]"
      >
        <DmView className="mt-[23] items-left w-full">
          <DmChecbox
            title={t("arabic")}
            isChecked={i18n.language === "ar"}
            textClassName="font-sans400"
            onPress={() => handleChangeLanguage("ar")}
          />
          <DmChecbox
            title={t("english")}
            onPress={() => handleChangeLanguage("en")}
            className="mt-[23]"
            textClassName="font-custom400"
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
      />
    </SafeAreaView>
  )
}

export default AccountScreen
