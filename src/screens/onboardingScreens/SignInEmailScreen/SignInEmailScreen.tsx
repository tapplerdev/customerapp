import React, { useState } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { useForm, Controller } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { DmAuthInput, DmView } from "@tappler/shared/src/components/UI"
import ErrorModal from "components/ErrorModal"
import { RootStackScreenProps } from "navigation/types"
import { useAuthMutation, useLazyGetCustomerMeQuery } from "services/api"
import { setTokens } from "store/auth/slice"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import HideIcon from "assets/icons/hide-password.svg"
import { AppKeyboardAwareScrollView } from "components/scroll"
import { Text, Button, a } from "@tappler/shared/src/ds"
import styles from "./styles"

type Props = RootStackScreenProps<"SignInEmailScreen">

const SignInEmailScreen: React.FC<Props> = ({ route, navigation }) => {
  const returnTo = (route.params as any)?.returnTo
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
    navigation.navigate("RegisterScreen" as any, returnTo ? { returnTo: true } : undefined)
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

      if (returnTo) {
        // Came from auth gate — go back to preserve the job flow
        navigation.goBack()
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: "HomeTabs" }],
        })
      }
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
    <SafeAreaView style={[a.flex_1, styles.safeArea]}>
      <AppKeyboardAwareScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 27,
          paddingHorizontal: 19,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <DmView style={a.mt_18}>
          {/* Back button */}
          <DmView
            style={[styles.iconWrap, a.items_center, a.justify_center]}
            hitSlop={HIT_SLOP_DEFAULT}
            onPress={handleGoBack}
          >
            <ChevronLeftIcon
              color={colors.red}
              style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
            />
          </DmView>

          {/* Title */}
          <Text size={16} weight="semibold" leading="tight" style={styles.logInToYourAccount}>
            {t("log_in_to_your_account")}
          </Text>

          {/* Form */}
          <DmView style={a.pr_2}>
            <Controller
              control={control}
              rules={{ required: true }}
              render={({ field: { value, onChange } }) => (
                <DmAuthInput
                  value={value}
                  placeholder={t("your_email")}
                  onChangeText={onChange}
                  wrapperStyle={a.mt_24}
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
                  wrapperStyle={a.mt_8}
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
          <DmView style={styles.forgotYourPasswordWrap} onPress={handleForgotPassword}>
            <Text size={12} leading="tight" color="brand">
              {t("forgot_your_password")}
            </Text>
          </DmView>

          {/* Login button */}
          <DmView style={styles.buttonWrap}>
            <Button
              size="md"
              style={a.mt_32}
              onPress={() => handleSubmit(() => onSubmit())()}
              title={t("log_In")}
              isLoading={isLoading}
              disabled={isLoading}
            />
          </DmView>

          {/* Register link */}
          <DmView style={a.mt_24} onPress={handleGoRegister}>
            <Text size={12} leading="tight" align="center">
              {t("dont_have_an_account")}
              <Text size={12} leading="tight" color="brand">
                {" "}
                {t("sign_up")}
              </Text>
            </Text>
          </DmView>
        </DmView>
      </AppKeyboardAwareScrollView>
      <ErrorModal
        isVisible={isErrorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        descr={errorMessage || t("invalid_credentials")}
      />
    </SafeAreaView>
  )
}

export default SignInEmailScreen
