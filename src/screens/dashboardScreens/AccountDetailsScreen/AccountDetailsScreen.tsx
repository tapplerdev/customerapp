import React, { useCallback, useEffect } from "react"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import AccountMyInfoIcon from "assets/icons/Account_My_Info.svg"
import AccountPasswordIcon from "assets/icons/Account_Password.svg"
import AccountChangePhoneIcon from "assets/icons/Account_Change_Phone.svg"
import AccountChangeEmailIcon from "assets/icons/Account_Change_Email.svg"
import AccountDeleteIcon from "assets/icons/Account_Delete_account.svg"

import AccountMenuItem from "screens/dashboardScreens/AccountScreen/components/AccountMenuItem"
import { RootStackScreenProps } from "navigation/types"
import colors from "@tappler/shared/src/styles/colors"
import { useLazyGetCustomerMeQuery } from "services/api"

type Props = RootStackScreenProps<"AccountDetailsScreen">

const AccountDetailsScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const [getCustomerMe] = useLazyGetCustomerMeQuery()

  useEffect(() => {
    getCustomerMe(undefined, true)
  }, [])

  const onGoBack = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      {/* Header with back button */}
      <DmView className="flex-row items-center px-[16] py-[12]">
        <DmView onPress={onGoBack} className="w-[32] h-[32] items-center justify-center">
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView className="flex-1 items-center">
          <DmText className="text-16 font-custom600 text-black">
            {t("account_details")}
          </DmText>
        </DmView>
        {/* Invisible spacer to center title */}
        <DmView className="w-[32]" />
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      {/* Menu Items */}
      <DmView>
        <AccountMenuItem
          Icon={AccountMyInfoIcon}
          label={t("my_information")}
          accessory="chevron"
          onPress={() => navigation.navigate("MyInformationScreen")}
          showSeparator
        />
        <AccountMenuItem
          Icon={AccountPasswordIcon}
          label={t("change_password")}
          accessory="chevron"
          onPress={() => navigation.navigate("ChangePasswordScreen")}
          showSeparator
        />
        <AccountMenuItem
          Icon={AccountChangePhoneIcon}
          label={t("update_mobile_number")}
          accessory="chevron"
          onPress={() => navigation.navigate("UpdateMobileNumberScreen")}
          showSeparator
        />
        <AccountMenuItem
          Icon={AccountChangeEmailIcon}
          label={t("update_email_address")}
          accessory="chevron"
          onPress={() => navigation.navigate("UpdateEmailScreen")}
          showSeparator
        />
        <AccountMenuItem
          Icon={AccountDeleteIcon}
          label={t("delete_my_account")}
          accessory="chevron"
          onPress={() => navigation.navigate("DeleteAccountScreen")}
          showSeparator={false}
        />
      </DmView>
    </SafeAreaView>
  )
}

export default AccountDetailsScreen
