import React, { useState } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { useForm, Controller } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { DmAuthInput, DmView } from "@tappler/shared/src/components/UI"
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
import { AppKeyboardAwareScrollView } from "components/scroll"
import { Text, Button, a } from "@tappler/shared/src/ds"

type Props = RootStackScreenProps<"RegisterScreen">

interface FormValues {
  firstName: string
  lastName: string
  email: string
  password: string
  mobileNumber: string
  gender: "male" | "female"
}

const RegisterScreen: React.FC<Props> = ({ route, navigation }) => {
  const returnTo = (route.params as any)?.returnTo
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
    navigation.navigate("SignInEmailScreen" as any, returnTo ? { returnTo: true } : undefined)
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
    <SafeAreaView style={[a.flex_1, styles.safeArea]}>
      <AppKeyboardAwareScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: 27,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <DmView>
          {/* Header */}
          <DmView style={[a.flex_row, a.items_center, a.px_16, a.py_12]}>
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
            <DmView style={[a.flex_1, a.items_center]}>
              <Text size={16} weight="semibold" leading="legacy">
                {t("register_a_new_account")}
              </Text>
            </DmView>
            <DmView style={styles.box} />
          </DmView>
          <DmView style={styles.box2} />

          {/* Form */}
          <DmView style={[a.mt_24, styles.box3]}>
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
            <DmView style={styles.box4} />
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
                  wrapperStyle={a.mt_14}
                  style={styles.inputHeight}
                />
              )}
              name="lastName"
            />
            <DmView style={styles.box4} />
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
                  wrapperStyle={a.mt_14}
                  style={styles.inputHeight}
                />
              )}
              name="email"
            />
            <DmView style={styles.box4} />
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
                  wrapperStyle={a.mt_14}
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
            <DmView style={styles.box4} />
            <Controller
              control={control}
              rules={{
                required: true,
                validate: (val) => val.startsWith("01") && val.length === 11,
              }}
              render={({ field: { value, onChange } }) => (
                <DmView style={a.mt_8}>
                  <DmView style={[a.flex_row, a.items_center]}>
                    <DmView style={[a.flex_row, a.items_center, a.mr_10]}>
                      <FlagEgyptIcon width={24} height={16} />
                      <Text size={13} leading="legacy" style={a.ml_6}>
                        +20
                      </Text>
                    </DmView>
                    <DmView style={a.flex_1}>
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
                  <DmView style={styles.box5} />
                </DmView>
              )}
              name="mobileNumber"
            />
          </DmView>

          {/* Gender */}
          <DmView style={[a.mt_16, styles.box3]}>
            <Text size={13} leading="legacy" color="placeholder">
              {t("gender")}
            </Text>
            <DmView style={[a.flex_row, a.mt_10]}>
              <DmView
                style={[a.flex_row, a.items_center, a.mr_30]}
                onPress={() => setValue("gender", "female")}
              >
                <DmView
                  style={[
                    styles.box6,
                    a.border_1,
                    a.items_center,
                    a.justify_center,
                  ]}
                >
                  {selectedGender === "female" && (
                    <DmView style={styles.box7} />
                  )}
                </DmView>
                <Text size={14} leading="legacy" style={a.ml_8}>
                  {t("female")}
                </Text>
              </DmView>
              <DmView
                style={[a.flex_row, a.items_center]}
                onPress={() => setValue("gender", "male")}
              >
                <DmView
                  style={[
                    styles.box6,
                    a.border_1,
                    a.items_center,
                    a.justify_center,
                  ]}
                >
                  {selectedGender === "male" && (
                    <DmView style={styles.box7} />
                  )}
                </DmView>
                <Text size={14} leading="legacy" style={a.ml_8}>
                  {t("male")}
                </Text>
              </DmView>
            </DmView>
          </DmView>

          {/* Register button */}
          <DmView style={styles.buttonWrap}>
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

          {/* Login link */}
          <DmView style={[a.mt_24, styles.box3]} onPress={handleGoLogin}>
            <Text size={12} leading="tight" align="center">
              {t("have_account_login")}
            </Text>
          </DmView>
        </DmView>
      </AppKeyboardAwareScrollView>
      <ErrorModal
        isVisible={isErrorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        descr={errorMessage}
      />
    </SafeAreaView>
  )
}

export default RegisterScreen
