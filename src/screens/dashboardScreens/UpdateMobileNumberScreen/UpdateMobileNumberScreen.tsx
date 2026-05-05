import React, { useCallback, useState } from "react"
import { TextInput } from "react-native"
import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import PhoneIcon from "assets/icons/phone.svg"
import FlagEgyptIcon from "assets/icons/flag-egypt.svg"
import ChevronDownIcon from "assets/icons/chevron-down.svg"
import { RootStackScreenProps } from "navigation/types"
import colors from "@tappler/shared/src/styles/colors"
import clsx from "clsx"
import { useTypedSelector } from "store"
import { useUpdateCustomerMutation } from "services/api"
import ErrorModal from "components/ErrorModal"
import SuccessModal from "components/SuccessModal"

type Props = RootStackScreenProps<"UpdateMobileNumberScreen">

const UpdateMobileNumberScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const user = useTypedSelector((store) => store.auth.user)
  const currentMobileNumber = user?.mobileNumber || ""

  const [phoneNumber, setPhoneNumber] = useState("")
  const [updateCustomer, { isLoading }] = useUpdateCustomerMutation()
  const [isErrorModalVisible, setErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isSuccessModalVisible, setSuccessModalVisible] = useState(false)

  const onGoBack = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const showMobileError =
    phoneNumber.length > 0 &&
    (!phoneNumber.startsWith("01") || (phoneNumber.length > 1 && phoneNumber.length < 11))
  const isValidMobile = phoneNumber.length === 11 && phoneNumber.startsWith("01")

  const handleSave = async () => {
    if (!isValidMobile) return
    try {
      await updateCustomer({ mobileNumber: phoneNumber }).unwrap()
      setPhoneNumber("")
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
      {/* Header - just back chevron, no title */}
      <DmView className="px-[16] py-[12]">
        <DmView onPress={onGoBack} className="w-[32] h-[32] items-center justify-center">
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
      </DmView>

      {/* Current mobile number */}
      <DmView className="flex-row items-center px-[31] mt-[10]">
        <PhoneIcon width={16} height={16} />
        <DmText className="px-[2] text-13 leading-[22px] font-custom600">
          {t("your_current_mobile_number")}
          {": "}
          <DmText className="text-13 leading-[22px] font-custom400">
            {currentMobileNumber ? `+20${currentMobileNumber}` : "—"}
          </DmText>
        </DmText>
      </DmView>

      {/* Title & Subtitle */}
      <DmView className="pt-[60] px-[31]">
        <DmView className="flex-row">
          <DmText className="text-20 leading-[24px] font-custom600 text-black pb-[10]">
            {t("update_mobile_number")}
          </DmText>
        </DmView>
        <DmView className="flex-row">
          <DmText className="text-11 leading-[22px] font-custom400 text-black">
            {t("we_will_send_you_a_verification_code")}
          </DmText>
        </DmView>
      </DmView>

      {/* Phone Input */}
      <DmView className="px-[35] pt-[55]">
        <DmView
          className={clsx(
            "flex-row items-center pb-[4] border-b-1 border-grey7",
            isAr && "flex-row-reverse"
          )}
        >
          <DmView
            className={clsx(
              "flex-row items-center border-r-1 border-r-grey7 pr-[7]",
              isAr && "flex-row-reverse border-r-0 border-l-1 border-l-grey7 pl-[7] pr-[0]"
            )}
          >
            <FlagEgyptIcon />
            <DmText
              className={clsx(
                "ml-[10] mr-[2] text-20 font-custom700 leading-[24px]",
                isAr && "ml-[2] mr-[10]"
              )}
            >
              +20
            </DmText>
            <ChevronDownIcon
              stroke={colors.grey7}
              width={18}
              height={18}
              strokeWidth={3}
            />
          </DmView>
          <TextInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="01XXXXXXXXXX"
            placeholderTextColor={colors.grey15}
            keyboardType="number-pad"
            maxLength={11}
            textContentType="none"
            autoComplete="off"
            className={clsx(
              "ml-[8] flex-1 h-[60] text-20 text-black",
              isAr && "ml-[0] mr-[8]"
            )}
            style={isAr ? { textAlign: "left", writingDirection: "rtl" } : undefined}
          />
        </DmView>
        {showMobileError && (
          <DmText className="mt-[4] text-11 font-custom400 text-red">
            {t("invalid_mobile_format")}
          </DmText>
        )}
      </DmView>

      {/* Send Verification Code Button */}
      <DmView className="px-[35] pt-[20]">
        <ActionBtn
          disable={!isValidMobile || isLoading}
          onPress={handleSave}
          isLoading={isLoading}
          textClassName={clsx(
            "text-13 leading-[16px] font-custom500",
            !isValidMobile && "text-grey10"
          )}
          className="h-[47] rounded-10"
          title={t("send_verification_code")}
        />
      </DmView>
      <ErrorModal
        isVisible={isErrorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        descr={errorMessage}
      />
      <SuccessModal
        isVisible={isSuccessModalVisible}
        onClose={handleSuccessClose}
        title={t("mobile_updated")}
        descr={t("mobile_updated_successfully")}
      />
    </SafeAreaView>
  )
}

export default UpdateMobileNumberScreen
