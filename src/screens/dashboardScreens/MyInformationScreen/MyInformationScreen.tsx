import React, { useCallback, useMemo, useState } from "react"
import { ScrollView, TextInput } from "react-native"
import { ActionBtn, DmChecbox, DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import { RootStackScreenProps } from "navigation/types"
import colors from "@tappler/shared/src/styles/colors"
import { takeFontStyles } from "@tappler/shared/src/helpers/helpers"
import { useTypedSelector } from "store"
import { useUpdateCustomerMutation } from "services/api"
import ErrorModal from "components/ErrorModal"

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
            {t("my_information")}
          </DmText>
        </DmView>
        <DmView className="w-[32]" />
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* First Name */}
        <DmView className="mb-[20]">
          <DmView className="flex-row">
            <DmText className="text-11 font-custom700 text-black mb-[6]">
              {t("first_name")}
            </DmText>
          </DmView>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            className="text-14 font-custom400 text-black pb-[8] border-b-[0.7px] border-b-grey19"
            style={[
              takeFontStyles("font-custom400 leading-[16px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* Last Name */}
        <DmView className="mb-[20]">
          <DmView className="flex-row">
            <DmText className="text-11 font-custom700 text-black mb-[6]">
              {t("last_name")}
            </DmText>
          </DmView>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            className="text-14 font-custom400 text-black pb-[8] border-b-[0.7px] border-b-grey19"
            style={[
              takeFontStyles("font-custom400 leading-[16px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* Email Address */}
        <DmView className="mb-[20]">
          <DmView className="flex-row items-center justify-between">
            <DmView className="flex-row">
              <DmText className="text-11 font-custom700 text-black mb-[6]">
                {t("email_address")}
              </DmText>
            </DmView>
            <DmView onPress={() => navigation.navigate("UpdateEmailScreen")}>
              <DmText className="text-13 font-custom500 text-red">
                {t("change")}
              </DmText>
            </DmView>
          </DmView>
          <DmView className="flex-row">
            <DmText className="text-14 font-custom400 text-grey15 pb-[8] border-b-[0.7px] border-b-grey19">
              {user?.email || ""}
            </DmText>
          </DmView>
        </DmView>

        {/* Gender */}
        <DmView className="mb-[28]">
          <DmView className="flex-row items-center">
            <DmView className="flex-row">
              <DmText className="text-11 font-custom700 text-black">
                {t("gender")}
              </DmText>
            </DmView>
            <DmView className="flex-row items-center" style={{ marginStart: 20 }}>
              <DmChecbox
                title={t("female")}
                onPress={() => setGender("female")}
                isChecked={gender === "female"}
                textClassName="text-13 font-custom400"
              />
              <DmChecbox
                title={t("male")}
                onPress={() => setGender("male")}
                isChecked={gender === "male"}
                className="ml-[20]"
                textClassName="text-13 font-custom400"
              />
            </DmView>
          </DmView>
        </DmView>

        {/* Save Button */}
        <ActionBtn
          onPress={handleSave}
          className={`h-[42] w-full ${hasChanges && !isLoading ? "bg-red" : "bg-grey19"}`}
          title={t("save")}
          textClassName="text-13 leading-[21px] font-custom600 text-white"
          disable={!hasChanges || isLoading}
          isLoading={isLoading}
        />
      </ScrollView>
      <ErrorModal
        isVisible={isErrorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        descr={errorMessage}
      />
    </SafeAreaView>
  )
}

export default MyInformationScreen
