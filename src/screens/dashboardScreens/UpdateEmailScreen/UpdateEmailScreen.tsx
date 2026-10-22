import React, { useCallback, useState } from "react"
import { TextInput } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import EmailExistIcon from "assets/icons/email-exist.svg"
import { RootStackScreenProps } from "navigation/types"
import colors from "@tappler/shared/src/styles/colors"
import { takeFontStyles } from "@tappler/shared/src/helpers/helpers"
import { useTypedSelector } from "store"
import { useUpdateCustomerMutation } from "services/api"
import ErrorModal from "components/ErrorModal"
import SuccessModal from "components/SuccessModal"
import { AppScrollView } from "components/scroll"
import { Text, Button, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

const disabledLookSubtleInverse = { surface: "subtle", label: "inverse" } as const

type Props = RootStackScreenProps<"UpdateEmailScreen">

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const UpdateEmailScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const user = useTypedSelector((store) => store.auth.user)
  const currentEmail = user?.email || ""

  const [newEmail, setNewEmail] = useState("")
  const [password, setPassword] = useState("")

  const [updateCustomer, { isLoading }] = useUpdateCustomerMutation()
  const [isErrorModalVisible, setErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isSuccessModalVisible, setSuccessModalVisible] = useState(false)

  const onGoBack = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const isFilled = newEmail && password
  const showEmailFormatError = newEmail.length > 0 && !isValidEmail(newEmail)
  const showSameEmailError = newEmail.length > 0 && isValidEmail(newEmail) && newEmail.toLowerCase() === currentEmail.toLowerCase()
  const hasClientError = showEmailFormatError || showSameEmailError

  const handleSave = async () => {
    if (hasClientError) return
    try {
      await updateCustomer({ email: newEmail.toLowerCase() }).unwrap()
      setNewEmail("")
      setPassword("")
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
            {t("change_email_address")}
          </Text>
        </DmView>
        <DmView style={styles.box} />
      </DmView>
      <DmView style={styles.box2} />

      <AppScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Your current email address */}
        <DmView style={a.mb_20}>
          <DmView style={a.flex_row}>
            <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
              {t("your_current_email_address")}
            </Text>
          </DmView>
          <DmView style={a.flex_row}>
            <Text size={14} leading="legacy" style={[styles.text, a.pb_8]}>
              {currentEmail}
            </Text>
          </DmView>
          <DmView style={styles.box2} />
        </DmView>

        {/* Your new email address */}
        <DmView style={a.mb_20}>
          <DmView style={a.flex_row}>
            <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
              {t("your_new_email_address")}
            </Text>
          </DmView>
          <TextInput
            value={newEmail}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="none"
            autoComplete="off"
            style={[styles.input, a.pb_8, 
              takeFontStyles("font-custom400 leading-[16px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr", minHeight: 36 },
            ]}
          />
          {showEmailFormatError && (
            <Text size={11} leading="legacy" color="brand" style={a.mt_4}>
              {t("invalid_email_format")}
            </Text>
          )}
          {showSameEmailError && (
            <Text size={11} leading="legacy" color="brand" style={a.mt_4}>
              {t("same_email_error")}
            </Text>
          )}
        </DmView>

        {/* Your Password */}
        <DmView style={a.mb_20}>
          <DmView style={a.flex_row}>
            <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
              {t("your_password")}
            </Text>
          </DmView>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="oneTimeCode"
            autoComplete="off"
            style={[styles.input, a.pb_8, 
              takeFontStyles("font-custom400 leading-[16px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* Change Email Button */}
        <DmView style={[a.px_16, a.mt_32]}>
          <Button
            onPress={handleSave}
            size="sm"
            label="sm"
            labelWeight="semibold"
            labelLeading={px(21)}
            disabledLook={disabledLookSubtleInverse}
            style={a.w_full}
            title={t("change_email")}
            disabled={!isFilled || hasClientError || isLoading}
            isLoading={isLoading}
          />
        </DmView>
      </AppScrollView>
      <ErrorModal
        isVisible={isErrorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        descr={errorMessage}
        Icon={<EmailExistIcon width={67} height={64} />}
      />
      <SuccessModal
        isVisible={isSuccessModalVisible}
        onClose={handleSuccessClose}
        title={t("email_updated")}
        descr={t("email_updated_successfully")}
      />
    </SafeAreaView>
  )
}

export default UpdateEmailScreen
