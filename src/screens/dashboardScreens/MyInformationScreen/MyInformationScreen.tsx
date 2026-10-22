import React, { useCallback, useMemo, useState } from "react"
import { TextInput } from "react-native"
import { DmChecbox, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import { RootStackScreenProps } from "navigation/types"
import colors from "@tappler/shared/src/styles/colors"
import { takeFontStyles } from "@tappler/shared/src/helpers/helpers"
import { useTypedSelector } from "store"
import { useUpdateCustomerMutation } from "services/api"
import ErrorModal from "components/ErrorModal"
import { AppScrollView } from "components/scroll"
import { Text, Button, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

const disabledLookSubtleInverse = { surface: "subtle", label: "inverse" } as const

type Props = RootStackScreenProps<"MyInformationScreen">

const MyInformationScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const user = useTypedSelector((store) => store.auth.user)

  const [firstName, setFirstName] = useState(user?.firstName || "")
  const [lastName, setLastName] = useState(user?.lastName || "")
  const [gender, setGender] = useState<"female" | "male">(user?.gender || "male")

  const [updateCustomer, { isLoading }] = useUpdateCustomerMutation()
  const [isErrorModalVisible, setErrorModalVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const hasChanges = useMemo(() => {
    return (
      firstName !== (user?.firstName || "") ||
      lastName !== (user?.lastName || "") ||
      gender !== (user?.gender || "male")
    )
  }, [firstName, lastName, gender, user])

  const onGoBack = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const handleSave = async () => {
    try {
      await updateCustomer({ firstName, lastName, gender }).unwrap()
      navigation.goBack()
    } catch (error: any) {
      setErrorMessage(error?.data?.message || t("an_error_occurred"))
      setErrorModalVisible(true)
    }
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
            {t("my_information")}
          </Text>
        </DmView>
        <DmView style={styles.box} />
      </DmView>
      <DmView style={styles.box2} />

      <AppScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* First Name */}
        <DmView style={a.mb_20}>
          <DmView style={a.flex_row}>
            <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
              {t("first_name")}
            </Text>
          </DmView>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            style={[styles.input, a.pb_8, 
              takeFontStyles("font-custom400 leading-[16px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* Last Name */}
        <DmView style={a.mb_20}>
          <DmView style={a.flex_row}>
            <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
              {t("last_name")}
            </Text>
          </DmView>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            style={[styles.input, a.pb_8, 
              takeFontStyles("font-custom400 leading-[16px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* Email Address */}
        <DmView style={a.mb_20}>
          <DmView style={[a.flex_row, a.items_center, a.justify_between]}>
            <DmView style={a.flex_row}>
              <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
                {t("email_address")}
              </Text>
            </DmView>
            <DmView onPress={() => navigation.navigate("UpdateEmailScreen")}>
              <Text size={13} weight="medium" leading="legacy" color="brand">
                {t("change")}
              </Text>
            </DmView>
          </DmView>
          <DmView style={a.flex_row}>
            <Text size={14} leading="legacy" style={[styles.text, a.pb_8]}>
              {user?.email || ""}
            </Text>
          </DmView>
        </DmView>

        {/* Gender */}
        <DmView style={a.mb_28}>
          <DmView style={[a.flex_row, a.items_center]}>
            <DmView style={a.flex_row}>
              <Text size={11} weight="bold" leading="legacy">
                {t("gender")}
              </Text>
            </DmView>
            <DmView style={[a.flex_row, a.items_center, { marginStart: 20 }]}>
              <DmChecbox
                title={t("female")}
                onPress={() => setGender("female")}
                isChecked={gender === "female"}
                textType={{ size: 13, leading: "legacy", weight: "regular" }}
              />
              <DmChecbox
                title={t("male")}
                onPress={() => setGender("male")}
                isChecked={gender === "male"}
                style={a.ml_20}
                textType={{ size: 13, leading: "legacy", weight: "regular" }}
              />
            </DmView>
          </DmView>
        </DmView>

        {/* Save Button */}
        <Button
          onPress={handleSave}
          size="sm"
          label="sm"
          labelWeight="semibold"
          labelLeading={px(21)}
          disabledLook={disabledLookSubtleInverse}
          style={a.w_full}
          title={t("save")}
          disabled={!hasChanges || isLoading}
          isLoading={isLoading}
        />
      </AppScrollView>
      <ErrorModal
        isVisible={isErrorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        descr={errorMessage}
      />
    </SafeAreaView>
  )
}

export default MyInformationScreen
