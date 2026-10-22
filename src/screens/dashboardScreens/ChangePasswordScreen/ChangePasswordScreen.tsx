import React, { useCallback, useState } from "react"
import { TextInput } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import PasswordErrorIcon from "assets/icons/password-error.svg"
import { RootStackScreenProps } from "navigation/types"
import colors from "@tappler/shared/src/styles/colors"
import { takeFontStyles } from "@tappler/shared/src/helpers/helpers"
import { useUpdateCustomerMutation } from "services/api"
import ErrorModal from "components/ErrorModal"
import SuccessModal from "components/SuccessModal"
import { AppScrollView } from "components/scroll"
import { Text, Button, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

const disabledLookSubtleInverse = { surface: "subtle", label: "inverse" } as const

type Props = RootStackScreenProps<"ChangePasswordScreen">

const ChangePasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")

  const [updateCustomer, { isLoading }] = useUpdateCustomerMutation()
  const [isErrorModalVisible, setErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isSuccessModalVisible, setSuccessModalVisible] = useState(false)

  const onGoBack = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const isFilled = currentPassword && newPassword && repeatPassword
  const showMinLengthError = newPassword.length > 0 && newPassword.length < 6
  const showMismatchError = repeatPassword.length > 0 && newPassword !== repeatPassword
  const hasClientError = showMinLengthError || showMismatchError

  const handleSave = async () => {
    if (hasClientError) return
    try {
      await updateCustomer({
        password: { currentPassword, newPassword },
      }).unwrap()
      setCurrentPassword("")
      setNewPassword("")
      setRepeatPassword("")
      setSuccessModalVisible(true)
    } catch (error: any) {
      const validationErrors = error?.data?.validationErrors
      if (validationErrors) {
        const firstErrors = Object.values(validationErrors)[0]
        const firstMsg = Array.isArray(firstErrors) ? firstErrors[0] : firstErrors
        setErrorMessage(typeof firstMsg === "string" ? firstMsg : t("an_error_occurred"))
      } else {
        setErrorMessage(error?.data?.message || error?.message || t("an_error_occurred"))
      }
      setErrorModalVisible(true)
    }
  }

  const handleSuccessClose = () => {
    setSuccessModalVisible(false)
    navigation.goBack()
  }

  return (
    <SafeAreaView edges={["top"]} style={[a.flex_1, styles.safeArea]}>
      {/* Header */}
      <DmView style={[a.flex_row, a.items_center, a.px_16, a.py_12]}>
        <DmView onPress={onGoBack} style={[styles.iconWrap, a.items_center, a.justify_center]}>
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView style={[a.flex_1, a.items_center]}>
          <Text size={16} weight="semibold" leading="legacy">
            {t("change_password")}
          </Text>
        </DmView>
        <DmView style={styles.box} />
      </DmView>
      <DmView style={styles.box2} />

      <AppScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Password */}
        <DmView style={a.mb_20}>
          <DmView style={a.flex_row}>
            <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
              {t("current_password")}
            </Text>
          </DmView>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            textContentType="oneTimeCode"
            autoComplete="off"
            style={[styles.input, a.pb_8, 
              takeFontStyles("font-custom400 leading-[16px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* Enter New Password */}
        <DmView style={a.mb_20}>
          <DmView style={a.flex_row}>
            <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
              {t("enter_new_password")}
            </Text>
          </DmView>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            textContentType="oneTimeCode"
            autoComplete="off"
            style={[styles.input, a.pb_8, 
              takeFontStyles("font-custom400 leading-[16px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
          {showMinLengthError && (
            <Text size={11} leading="legacy" color="brand" style={a.mt_4}>
              {t("password_min_length")}
            </Text>
          )}
        </DmView>

        {/* Repeat new Password */}
        <DmView style={a.mb_20}>
          <DmView style={a.flex_row}>
            <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
              {t("repeat_new_password")}
            </Text>
          </DmView>
          <TextInput
            value={repeatPassword}
            onChangeText={setRepeatPassword}
            secureTextEntry
            textContentType="oneTimeCode"
            autoComplete="off"
            style={[styles.input, a.pb_8, 
              takeFontStyles("font-custom400 leading-[16px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
          {showMismatchError && (
            <Text size={11} leading="legacy" color="brand" style={a.mt_4}>
              {t("passwords_do_not_match")}
            </Text>
          )}
        </DmView>

        {/* Send Button */}
        <DmView style={[a.px_16, a.mt_32]}>
          <Button
            onPress={handleSave}
            size="sm"
            label="sm"
            labelWeight="semibold"
            labelLeading={px(21)}
            disabledLook={disabledLookSubtleInverse}
            style={a.w_full}
            title={t("send")}
            disabled={!isFilled || hasClientError || isLoading}
            isLoading={isLoading}
          />
        </DmView>
      </AppScrollView>
      <ErrorModal
        isVisible={isErrorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        descr={errorMessage}
        Icon={<PasswordErrorIcon width={70} height={57} />}
      />
      <SuccessModal
        isVisible={isSuccessModalVisible}
        onClose={handleSuccessClose}
        title={t("password_changed")}
        descr={t("password_changed_successfully")}
      />
    </SafeAreaView>
  )
}

export default ChangePasswordScreen
