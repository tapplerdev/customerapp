import React, { useState } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view"
import { useForm, Controller } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { ActionBtn, DmAuthInput, DmText, DmView } from "@tappler/shared/src/components/UI"
import ErrorModal from "components/ErrorModal"
import { RootStackScreenProps } from "navigation/types"
import { useAuthMutation, useLazyGetCustomerMeQuery } from "services/api"
import { setTokens } from "store/auth/slice"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import HideIcon from "assets/icons/hide-password.svg"

type Props = RootStackScreenProps<"SignInEmailScreen">

const SignInEmailScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const dispatch = useDispatch()

  const [isPasswordVisible, setPasswordVisible] = useState(true)
  const [isErrorModalVisible, setErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isLoading, setLoading] = useState(false)

  const [auth] = useAuthMutation()
  const [getCustomerMe] = useLazyGetCustomerMeQuery()

  const {
    control,
    handleSubmit,
    getValues,
  } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const handleGoBack = () => {
    navigation.goBack()
  }

  const handleTogglePasswordVisible = () => {
    setPasswordVisible((prev) => !prev)
  }

  const handleForgotPassword = () => {
  }

  const handleGoRegister = () => {
    navigation.navigate("RegisterScreen")
  }

  const onSubmit = async () => {
    try {
      setLoading(true)
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
          if (firstMsg.includes("Password does not match")) {
            setErrorMessage(t("incorrect_password"))
          } else if (firstMsg.includes("not registered")) {
            setErrorMessage(t("email_not_registered"))
          } else {
            setErrorMessage(t("invalid_credentials"))
          }
        } else {
          setErrorMessage(t("invalid_credentials"))
        }
      } else {
        setErrorMessage(t("invalid_credentials"))
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
          paddingHorizontal: 19,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <DmView className="mt-[18]">
          {/* Back button */}
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

          {/* Title */}
          <DmText className="mt-[88] font-custom600 text-16 leading-[19px]">
            {t("log_in_to_your_account")}
          </DmText>

          {/* Form */}
          <DmView className="pr-[2]">
            <Controller
              control={control}
              rules={{ required: true }}
              render={({ field: { value, onChange } }) => (
                <DmAuthInput
                  value={value}
                  placeholder={t("your_email")}
                  onChangeText={onChange}
                  wrapperClassName="mt-[24]"
                  textContentType="oneTimeCode"
                  keyboardType="email-address"
                  autoComplete="off"
                />
              )}
              name="email"
            />
            <Controller
              control={control}
              rules={{ required: true }}
              render={({ field: { value, onChange } }) => (
                <DmAuthInput
                  value={value}
                  placeholder={t("your_password")}
                  onChangeText={onChange}
                  wrapperClassName="mt-[8]"
                  onIconPress={handleTogglePasswordVisible}
                  secureTextEntry={isPasswordVisible}
                  textContentType="oneTimeCode"
                  autoComplete="off"
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
          </DmView>

          {/* Forgot password */}
          <DmView className="mt-[21]" onPress={handleForgotPassword}>
            <DmText className="font-custom400 text-red text-12 leading-[15px]">
              {t("forgot_your_password")}
            </DmText>
          </DmView>

          {/* Login button */}
          <DmView className="px-[34]">
            <ActionBtn
              className="mt-[32] h-[44]"
              onPress={() => handleSubmit(() => onSubmit())()}
              title={t("log_In")}
              isLoading={isLoading}
              disable={isLoading}
            />
          </DmView>

          {/* Register link */}
          <DmView className="mt-[24]" onPress={handleGoRegister}>
            <DmText className="text-12 leading-[15px] font-custom400 text-center">
              {t("dont_have_an_account")}
              <DmText className="text-red text-12 leading-[15px] font-custom400">
                {" "}
                {t("sign_up")}
              </DmText>
            </DmText>
          </DmView>
        </DmView>
      </KeyboardAwareScrollView>
      <ErrorModal
        isVisible={isErrorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        descr={errorMessage || t("invalid_credentials")}
      />
    </SafeAreaView>
  )
}

export default SignInEmailScreen
