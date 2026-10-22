import React, { useCallback, useState } from "react"
import { TextInput } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import PhoneIcon from "assets/icons/phone.svg"
import FlagEgyptIcon from "assets/icons/flag-egypt.svg"
import ChevronDownIcon from "assets/icons/chevron-down.svg"
import { RootStackScreenProps } from "navigation/types"
import colors from "@tappler/shared/src/styles/colors"
import { useTypedSelector } from "store"
import { useUpdateCustomerMutation } from "services/api"
import ErrorModal from "components/ErrorModal"
import SuccessModal from "components/SuccessModal"
import { Text, Button, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

const disabledLookLegacyMuted = { surface: "legacy", label: "muted" } as const

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
    <SafeAreaView edges={["top"]} style={[a.flex_1, styles.safeArea]}>
      {/* Header - just back chevron, no title */}
      <DmView style={[a.px_16, a.py_12]}>
        <DmView onPress={onGoBack} style={[styles.iconWrap, a.items_center, a.justify_center]}>
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
      </DmView>

      {/* Current mobile number */}
      <DmView style={[a.flex_row, a.items_center, styles.row, a.mt_10]}>
        <PhoneIcon width={16} height={16} />
        <Text size={13} weight="semibold" leading={px(22)} style={a.px_2}>
          {t("your_current_mobile_number")}
          {": "}
          <Text size={13} leading={px(22)}>
            {currentMobileNumber ? `+20${currentMobileNumber}` : "—"}
          </Text>
        </Text>
      </DmView>

      {/* Title & Subtitle */}
      <DmView style={styles.box}>
        <DmView style={a.flex_row}>
          <Text size={20} weight="semibold" leading="tight" style={a.pb_10}>
            {t("update_mobile_number")}
          </Text>
        </DmView>
        <DmView style={a.flex_row}>
          <Text size={11} leading={px(22)}>
            {t("we_will_send_you_a_verification_code")}
          </Text>
        </DmView>
      </DmView>

      {/* Phone Input */}
      <DmView style={styles.box2}>
        <DmView
          style={[
            a.flex_row,
            a.items_center,
            a.pb_4,
            a.border_b_1,
            styles.row2,
            isAr && styles.rowAr,
          ]}
        >
          <DmView
            style={[
              a.flex_row,
              a.items_center,
              styles.row3,
              isAr && styles.rowAr2,
            ]}
          >
            <FlagEgyptIcon />
            <Text
              size={20}
              weight="bold"
              leading="tight"
              style={[a.ml_10, a.mr_2, isAr && styles.textAr]}
            >
              +20
            </Text>
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
            style={[a.ml_8, a.flex_1, styles.input, isAr && styles.inputAr, isAr ? { textAlign: "left", writingDirection: "rtl" } : undefined]}
          />
        </DmView>
        {showMobileError && (
          <Text size={11} leading="legacy" color="brand" style={a.mt_4}>
            {t("invalid_mobile_format")}
          </Text>
        )}
      </DmView>

      {/* Send Verification Code Button */}
      <DmView style={[styles.buttonWrap, a.pt_20]}>
        <Button
          disabled={!isValidMobile || isLoading}
          onPress={handleSave}
          isLoading={isLoading}
          size="lg"
          shape="r10"
          label="sm"
          disabledLook={isValidMobile ? isLoading ? undefined : disabledLookLegacyMuted : disabledLookLegacyMuted}
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
