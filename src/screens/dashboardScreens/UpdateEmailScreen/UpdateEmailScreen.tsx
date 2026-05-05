import React, { useCallback, useState } from "react"
import { ScrollView, TextInput } from "react-native"
import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
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
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      {/* Header */}
      <DmView className="flex-row items-center px-[16] py-[12]">
        <DmView onPress={onGoBack} className="w-[32] h-[32] items-center justify-center">
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView className="flex-1 items-center">
          <DmText className="text-16 font-custom600 text-black">
            {t("change_email_address")}
          </DmText>
        </DmView>
        <DmView className="w-[32]" />
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Your current email address */}
        <DmView className="mb-[20]">
          <DmView className="flex-row">
            <DmText className="text-11 font-custom700 text-black mb-[6]">
              {t("your_current_email_address")}
            </DmText>
          </DmView>
          <DmView className="flex-row">
            <DmText className="text-14 font-custom400 text-grey15 pb-[8]">
              {currentEmail}
            </DmText>
          </DmView>
          <DmView className="h-[0.7] bg-grey19" />
        </DmView>

        {/* Your new email address */}
        <DmView className="mb-[20]">
          <DmView className="flex-row">
            <DmText className="text-11 font-custom700 text-black mb-[6]">
              {t("your_new_email_address")}
            </DmText>
          </DmView>
          <TextInput
            value={newEmail}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="none"
            autoComplete="off"
            className="text-14 font-custom400 text-black pb-[8] border-b-[0.7px] border-b-grey19"
            style={[
              takeFontStyles("font-custom400 leading-[16px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr", minHeight: 36 },
            ]}
          />
          {showEmailFormatError && (
            <DmText className="mt-[4] text-11 font-custom400 text-red">
              {t("invalid_email_format")}
            </DmText>
          )}
          {showSameEmailError && (
            <DmText className="mt-[4] text-11 font-custom400 text-red">
              {t("same_email_error")}
            </DmText>
          )}
        </DmView>

        {/* Your Password */}
        <DmView className="mb-[20]">
          <DmView className="flex-row">
            <DmText className="text-11 font-custom700 text-black mb-[6]">
              {t("your_password")}
            </DmText>
          </DmView>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="oneTimeCode"
            autoComplete="off"
            className="text-14 font-custom400 text-black pb-[8] border-b-[0.7px] border-b-grey19"
            style={[
              takeFontStyles("font-custom400 leading-[16px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* Change Email Button */}
        <DmView className="px-[16] mt-[32]">
          <ActionBtn
            onPress={handleSave}
            className={`h-[42] w-full ${isFilled && !hasClientError && !isLoading ? "bg-red" : "bg-grey19"}`}
            title={t("change_email")}
            textClassName="text-13 leading-[21px] font-custom600 text-white"
            disable={!isFilled || hasClientError || isLoading}
            isLoading={isLoading}
          />
        </DmView>
      </ScrollView>
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
