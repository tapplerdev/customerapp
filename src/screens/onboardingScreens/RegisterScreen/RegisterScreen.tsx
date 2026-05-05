import React, { useState } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view"
import { useForm, Controller } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { ActionBtn, DmAuthInput, DmText, DmView } from "@tappler/shared/src/components/UI"
import ErrorModal from "components/ErrorModal"
import { RootStackScreenProps } from "navigation/types"
import { useCustomerSignUpMutation, useAuthMutation, useLazyGetCustomerMeQuery } from "services/api"
import { setTokens } from "store/auth/slice"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import styles from "./styles"
import HideIcon from "assets/icons/hide-password.svg"
import FlagEgyptIcon from "assets/icons/flag-egypt.svg"

type Props = RootStackScreenProps<"RegisterScreen">

interface FormValues {
  firstName: string
  lastName: string
  email: string
  password: string
  mobileNumber: string
  gender: "male" | "female"
}

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
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

  const handleGoBack = () => {
    navigation.goBack()
  }

  const handleTogglePasswordVisible = () => {
    setPasswordVisible((prev) => !prev)
  }

  const handleGoLogin = () => {
    navigation.navigate("SignInEmailScreen")
  }

  const onSubmit = async () => {
    try {
      setLoading(true)
      const signUpPayload = {
        firstName: getValues("firstName"),
        lastName: getValues("lastName"),
        email: getValues("email").toLowerCase(),
        password: getValues("password"),
        mobileNumber: getValues("mobileNumber"),
        gender: getValues("gender"),
        signupPlatform: "email",
      }
      const signUpRes = await customerSignUp(signUpPayload).unwrap()

      const authRes = await auth({
        email: getValues("email").toLowerCase(),
        password: getValues("password"),
        userType: "customer",
        rememberMe: true,
      }).unwrap()

      dispatch(setTokens({ token: authRes.token, refreshToken: authRes.refreshToken }))
      await getCustomerMe().unwrap()

      navigation.reset({
        index: 0,
        routes: [{ name: "HomeTabs" }],
      })
    } catch (error: any) {
      const validationErrors = error?.data?.validationErrors
      if (validationErrors) {
        const firstErrors = Object.values(validationErrors)[0]
        const firstMsg = Array.isArray(firstErrors) ? firstErrors[0] : firstErrors
        if (typeof firstMsg === "string") {
          setErrorMessage(firstMsg)
        } else {
          setErrorMessage(t("invalid_credentials"))
        }
      } else {
        setErrorMessage(error?.data?.message || t("invalid_credentials"))
      }
      setErrorModalVisible(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAwareScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 27,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <DmView>
          {/* Header */}
          <DmView className="flex-row items-center px-[16] py-[12]">
            <DmView
              className="w-[32] h-[32] items-center justify-center"
              hitSlop={HIT_SLOP_DEFAULT}
              onPress={handleGoBack}
            >
              <ChevronLeftIcon
                color={colors.red}
                style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
              />
            </DmView>
            <DmView className="flex-1 items-center">
              <DmText className="text-16 font-custom600 text-black">
                {t("register_a_new_account")}
              </DmText>
            </DmView>
            <DmView className="w-[32]" />
          </DmView>
          <DmView className="h-[0.7] bg-grey19" />

          {/* Form */}
          <DmView className="mt-[24] px-[19]">
            <Controller
              control={control}
              rules={{ required: true }}
              render={({ field: { value, onChange } }) => (
                <DmAuthInput
                  value={value}
                  placeholder={t("first_name")}
                  onChangeText={onChange}
                  textContentType="givenName"
                  autoComplete="given-name"
                  isBorderVisible={false}
                  style={styles.inputHeight}
                />
              )}
              name="firstName"
            />
            <DmView className="h-[0.7] bg-grey1" />
            <Controller
              control={control}
              rules={{ required: true }}
              render={({ field: { value, onChange } }) => (
                <DmAuthInput
                  value={value}
                  placeholder={t("last_name")}
                  onChangeText={onChange}
                  textContentType="familyName"
                  autoComplete="family-name"
                  isBorderVisible={false}
                  wrapperClassName="mt-[14]"
                  style={styles.inputHeight}
                />
              )}
              name="lastName"
            />
            <DmView className="h-[0.7] bg-grey1" />
            <Controller
              control={control}
              rules={{ required: true }}
              render={({ field: { value, onChange } }) => (
                <DmAuthInput
                  value={value}
                  placeholder={t("your_email")}
                  onChangeText={onChange}
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  autoComplete="email"
                  isBorderVisible={false}
                  wrapperClassName="mt-[14]"
                  style={styles.inputHeight}
                />
              )}
              name="email"
            />
            <DmView className="h-[0.7] bg-grey1" />
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
                  onIconPress={handleTogglePasswordVisible}
                  textContentType="newPassword"
                  autoComplete="password-new"
                  isBorderVisible={false}
                  wrapperClassName="mt-[14]"
                  style={styles.inputHeight}
                  Icon={
                    <HideIcon
                      fill={
                        !isPasswordVisible
                          ? colors.black
                          : colors.greyPlaceholder
                      }
                    />
                  }
                />
              )}
              name="password"
            />
            <DmView className="h-[0.7] bg-grey1" />
            <Controller
              control={control}
              rules={{
                required: true,
                validate: (val) => val.startsWith("01") && val.length === 11,
              }}
              render={({ field: { value, onChange } }) => (
                <DmView className="mt-[8]">
                  <DmView className="flex-row items-center">
                    <DmView className="flex-row items-center mr-[10]">
                      <FlagEgyptIcon width={24} height={16} />
                      <DmText className="ml-[6] text-13 font-custom400 text-black">
                        +20
                      </DmText>
                    </DmView>
                    <DmView className="flex-1">
                      <DmAuthInput
                        value={value}
                        placeholder={t("mobile_number")}
                        onChangeText={onChange}
                        keyboardType="phone-pad"
                        maxLength={11}
                        isBorderVisible={false}
                        style={styles.inputHeight}
                      />
                    </DmView>
                  </DmView>
                  <DmView className="border-b-0.5 border-grey1" />
                </DmView>
              )}
              name="mobileNumber"
            />
          </DmView>

          {/* Gender */}
          <DmView className="mt-[16] px-[19]">
            <DmText className="text-13 font-custom400 text-greyPlaceholder">
              {t("gender")}
            </DmText>
            <DmView className="flex-row mt-[10]">
              <DmView
                className="flex-row items-center mr-[30]"
                onPress={() => setValue("gender", "female")}
              >
                <DmView
                  className="w-[22] h-[22] rounded-full border-1 border-grey1 items-center justify-center"
                >
                  {selectedGender === "female" && (
                    <DmView className="w-[12] h-[12] rounded-full bg-red" />
                  )}
                </DmView>
                <DmText className="ml-[8] text-14 font-custom400">
                  {t("female")}
                </DmText>
              </DmView>
              <DmView
                className="flex-row items-center"
                onPress={() => setValue("gender", "male")}
              >
                <DmView
                  className="w-[22] h-[22] rounded-full border-1 border-grey1 items-center justify-center"
                >
                  {selectedGender === "male" && (
                    <DmView className="w-[12] h-[12] rounded-full bg-red" />
                  )}
                </DmView>
                <DmText className="ml-[8] text-14 font-custom400">
                  {t("male")}
                </DmText>
              </DmView>
            </DmView>
          </DmView>

          {/* Register button */}
          <DmView className="px-[53]">
            <ActionBtn
              className={`mt-[40] h-[44] ${isFormReady ? "bg-red" : ""}`}
              onPress={() => handleSubmit(() => onSubmit())()}
              title={t("register")}
              isLoading={isLoading}
              disable={!isFormReady}
            />
          </DmView>

          {/* Login link */}
          <DmView className="mt-[24] px-[19]" onPress={handleGoLogin}>
            <DmText className="text-12 leading-[15px] font-custom400 text-center">
              {t("have_account_login")}
            </DmText>
          </DmView>
        </DmView>
      </KeyboardAwareScrollView>
      <ErrorModal
        isVisible={isErrorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        descr={errorMessage}
      />
    </SafeAreaView>
  )
}

export default RegisterScreen
