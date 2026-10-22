import React, { useState } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { useForm, Controller } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { DmAuthInput, DmView } from "@tappler/shared/src/components/UI"
import ErrorModal from "components/ErrorModal"
import { useCustomerSignUpMutation, useAuthMutation, useLazyGetCustomerMeQuery } from "services/api"
import { setTokens } from "store/auth/slice"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import HideIcon from "assets/icons/hide-password.svg"
import FlagEgyptIcon from "assets/icons/flag-egypt.svg"
import { AppKeyboardAwareScrollView } from "components/scroll"
import { Text, Button, a } from "@tappler/shared/src/ds"
import { gateRegisterScreenStyles } from "./styles"

interface FormValues {
  firstName: string
  lastName: string
  email: string
  password: string
  mobileNumber: string
  gender: "male" | "female"
}

const GateRegisterScreen: React.FC<{ navigation: any; parentNav: any }> = ({ navigation, parentNav }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const dispatch = useDispatch()

  const [isPasswordVisible, setPasswordVisible] = useState(true)
  const [isErrorModalVisible, setErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setLoading] = useState(false)

  const [customerSignUp] = useCustomerSignUpMutation()
  const [auth] = useAuthMutation()
  const [getCustomerMe] = useLazyGetCustomerMeQuery()

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    watch,
    formState: { isValid },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      mobileNumber: "",
      gender: "male",
    },
  })

  const selectedGender = watch("gender")
  const isFormReady = isValid && !isLoading

  const onSubmit = async () => {
    try {
      setLoading(true)
      await customerSignUp({
        firstName: getValues("firstName"),
        lastName: getValues("lastName"),
        email: getValues("email").toLowerCase(),
        password: getValues("password"),
        mobileNumber: getValues("mobileNumber"),
        gender: getValues("gender"),
        signupPlatform: "email",
      }).unwrap()

      const authRes = await auth({
        email: getValues("email").toLowerCase(),
        password: getValues("password"),
        userType: "customer",
        rememberMe: true,
      }).unwrap()

      dispatch(setTokens({ token: authRes.token, refreshToken: authRes.refreshToken }))
      await getCustomerMe().unwrap()

      // Dismiss the auth gate modal — returns to RequestSummaryScreen
      parentNav.goBack()
    } catch (error: any) {
      const validationErrors = error?.data?.validationErrors
      if (validationErrors) {
        const firstErrors = Object.values(validationErrors)[0]
        const firstMsg = Array.isArray(firstErrors) ? firstErrors[0] : firstErrors
        setErrorMessage(typeof firstMsg === "string" ? firstMsg : t("invalid_credentials"))
      } else {
        setErrorMessage(error?.data?.message || t("invalid_credentials"))
      }
      setErrorModalVisible(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={[a.flex_1, gateRegisterScreenStyles.safeArea]} edges={[]}>
      <AppKeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 27 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <DmView style={[a.flex_row, a.items_center, a.px_16, a.py_12]}>
          <DmView
            style={[
              gateRegisterScreenStyles.iconWrap,
              a.items_center,
              a.justify_center,
            ]}
            hitSlop={HIT_SLOP_DEFAULT}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeftIcon
              color={colors.red}
              style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
            />
          </DmView>
          <DmView style={[a.flex_1, a.items_center]}>
            <Text size={16} weight="semibold" leading="legacy">
              {t("register_a_new_account")}
            </Text>
          </DmView>
          <DmView style={gateRegisterScreenStyles.box} />
        </DmView>
        <DmView style={gateRegisterScreenStyles.box2} />

        {/* Form */}
        <DmView style={[a.mt_24, gateRegisterScreenStyles.box3]}>
          <Controller
            control={control}
            rules={{ required: true }}
            render={({ field: { value, onChange } }) => (
              <DmAuthInput value={value} placeholder={t("first_name")} onChangeText={onChange} isBorderVisible={false} />
            )}
            name="firstName"
          />
          <DmView style={gateRegisterScreenStyles.box4} />
          <Controller
            control={control}
            rules={{ required: true }}
            render={({ field: { value, onChange } }) => (
              <DmAuthInput value={value} placeholder={t("last_name")} onChangeText={onChange} isBorderVisible={false} wrapperStyle={a.mt_14} />
            )}
            name="lastName"
          />
          <DmView style={gateRegisterScreenStyles.box4} />
          <Controller
            control={control}
            rules={{ required: true }}
            render={({ field: { value, onChange } }) => (
              <DmAuthInput value={value} placeholder={t("your_email")} onChangeText={onChange} keyboardType="email-address" isBorderVisible={false} wrapperStyle={a.mt_14} />
            )}
            name="email"
          />
          <DmView style={gateRegisterScreenStyles.box4} />
          <Controller
            control={control}
            rules={{ required: true, minLength: 6 }}
            render={({ field: { value, onChange } }) => (
              <DmAuthInput
                value={value}
                placeholder={t("your_password")}
                subLabel={t("password_hint")}
                onChangeText={onChange}
                secureTextEntry={isPasswordVisible}
                onIconPress={() => setPasswordVisible(!isPasswordVisible)}
                isBorderVisible={false}
                wrapperStyle={a.mt_14}
                Icon={<HideIcon fill={!isPasswordVisible ? colors.black : colors.greyPlaceholder} />}
              />
            )}
            name="password"
          />
          <DmView style={gateRegisterScreenStyles.box4} />
          <Controller
            control={control}
            rules={{ required: true, validate: (val) => val.startsWith("01") && val.length === 11 }}
            render={({ field: { value, onChange } }) => (
              <DmView style={a.mt_8}>
                <DmView style={[a.flex_row, a.items_center]}>
                  <DmView style={[a.flex_row, a.items_center, a.mr_10]}>
                    <FlagEgyptIcon width={24} height={16} />
                    <Text size={13} leading="legacy" style={a.ml_6}>+20</Text>
                  </DmView>
                  <DmView style={a.flex_1}>
                    <DmAuthInput value={value} placeholder={t("mobile_number")} onChangeText={onChange} keyboardType="phone-pad" maxLength={11} isBorderVisible={false} />
                  </DmView>
                </DmView>
                <DmView style={gateRegisterScreenStyles.box5} />
              </DmView>
            )}
            name="mobileNumber"
          />
        </DmView>

        {/* Gender */}
        <DmView style={[a.mt_16, gateRegisterScreenStyles.box3]}>
          <Text size={13} leading="legacy" color="placeholder">{t("gender")}</Text>
          <DmView style={[a.flex_row, a.mt_10]}>
            <DmView style={[a.flex_row, a.items_center, a.mr_30]} onPress={() => setValue("gender", "female")}>
              <DmView style={[gateRegisterScreenStyles.box6, a.border_1, a.items_center, a.justify_center]}>
                {selectedGender === "female" && <DmView style={gateRegisterScreenStyles.box7} />}
              </DmView>
              <Text size={14} leading="legacy" style={a.ml_8}>{t("female")}</Text>
            </DmView>
            <DmView style={[a.flex_row, a.items_center]} onPress={() => setValue("gender", "male")}>
              <DmView style={[gateRegisterScreenStyles.box6, a.border_1, a.items_center, a.justify_center]}>
                {selectedGender === "male" && <DmView style={gateRegisterScreenStyles.box7} />}
              </DmView>
              <Text size={14} leading="legacy" style={a.ml_8}>{t("male")}</Text>
            </DmView>
          </DmView>
        </DmView>

        {/* Register button */}
        <DmView style={gateRegisterScreenStyles.buttonWrap}>
          <Button
            size="md"
            loadingSurface={isFormReady ? "brand" : undefined}
            style={a.mt_40}
            onPress={() => handleSubmit(() => onSubmit())()}
            title={t("register")}
            isLoading={isLoading}
            disabled={!isFormReady}
          />
        </DmView>
      </AppKeyboardAwareScrollView>
      <ErrorModal isVisible={isErrorModalVisible} onClose={() => setErrorModalVisible(false)} descr={errorMessage} />
    </SafeAreaView>
  )
}

export default GateRegisterScreen
