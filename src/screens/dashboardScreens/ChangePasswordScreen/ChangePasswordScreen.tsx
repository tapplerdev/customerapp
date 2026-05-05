import React, { useCallback, useState } from "react"
import { ScrollView, TextInput } from "react-native"
import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
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
            {t("change_password")}
          </DmText>
        </DmView>
        <DmView className="w-[32]" />
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Password */}
        <DmView className="mb-[20]">
          <DmView className="flex-row">
            <DmText className="text-11 font-custom700 text-black mb-[6]">
              {t("current_password")}
            </DmText>
          </DmView>
          <TextInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
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

        {/* Enter New Password */}
        <DmView className="mb-[20]">
          <DmView className="flex-row">
            <DmText className="text-11 font-custom700 text-black mb-[6]">
              {t("enter_new_password")}
            </DmText>
          </DmView>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            textContentType="oneTimeCode"
            autoComplete="off"
            className="text-14 font-custom400 text-black pb-[8] border-b-[0.7px] border-b-grey19"
            style={[
              takeFontStyles("font-custom400 leading-[16px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
          {showMinLengthError && (
            <DmText className="mt-[4] text-11 font-custom400 text-red">
              {t("password_min_length")}
            </DmText>
          )}
        </DmView>

        {/* Repeat new Password */}
        <DmView className="mb-[20]">
          <DmView className="flex-row">
            <DmText className="text-11 font-custom700 text-black mb-[6]">
              {t("repeat_new_password")}
            </DmText>
          </DmView>
          <TextInput
            value={repeatPassword}
            onChangeText={setRepeatPassword}
            secureTextEntry
            textContentType="oneTimeCode"
            autoComplete="off"
            className="text-14 font-custom400 text-black pb-[8] border-b-[0.7px] border-b-grey19"
            style={[
              takeFontStyles("font-custom400 leading-[16px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
          {showMismatchError && (
            <DmText className="mt-[4] text-11 font-custom400 text-red">
              {t("passwords_do_not_match")}
            </DmText>
          )}
        </DmView>

        {/* Send Button */}
        <DmView className="px-[16] mt-[32]">
          <ActionBtn
            onPress={handleSave}
            className={`h-[42] w-full ${isFilled && !hasClientError && !isLoading ? "bg-red" : "bg-grey19"}`}
            title={t("send")}
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
