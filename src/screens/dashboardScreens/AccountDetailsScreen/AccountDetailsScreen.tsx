import React, { useCallback, useEffect } from "react"
import { DmView } from "@tappler/shared/src/components/UI"
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
import { Text, a } from "@tappler/shared/src/ds"
import styles from "./styles"

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
    <SafeAreaView edges={["top"]} style={[a.flex_1, styles.safeArea]}>
      {/* Header with back button */}
      <DmView style={[a.flex_row, a.items_center, a.px_16, a.py_12]}>
        <DmView onPress={onGoBack} style={[styles.iconWrap, a.items_center, a.justify_center]}>
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView style={[a.flex_1, a.items_center]}>
          <Text size={16} weight="semibold" leading="legacy">
            {t("account_details")}
          </Text>
        </DmView>
        {/* Invisible spacer to center title */}
        <DmView style={styles.box} />
      </DmView>
      <DmView style={styles.box2} />

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
