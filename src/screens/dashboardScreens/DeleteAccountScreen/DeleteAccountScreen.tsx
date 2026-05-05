import React, { useCallback, useState } from "react"
import { TextInput } from "react-native"
import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { MainModal } from "@tappler/shared/src/components"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import DeleteIcon from "assets/icons/Delete.svg"
import { RootStackScreenProps } from "navigation/types"
import colors from "@tappler/shared/src/styles/colors"
import { takeFontStyles } from "@tappler/shared/src/helpers/helpers"

type Props = RootStackScreenProps<"DeleteAccountScreen">

const DeleteAccountScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const [reason, setReason] = useState("")
  const [isModalVisible, setModalVisible] = useState(false)

  const onGoBack = useCallback(() => {
    navigation.goBack()
  }, [navigation])

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
            {t("delete_account")}
          </DmText>
        </DmView>
        <DmView className="w-[32]" />
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      <DmView className="flex-1 px-[24] pt-[24]">
        {/* Warning text */}
        <DmView className="flex-row">
          <DmText className="text-13 font-custom400 text-black leading-[20px]">
            {t("delete_account_warning")}
          </DmText>
        </DmView>

        {/* Reason field */}
        <DmView className="mt-[24]">
          <DmView className="flex-row">
            <DmText className="text-11 font-custom700 text-black mb-[6]">
              {t("reason_for_cancelling")}
            </DmText>
          </DmView>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t("delete_account_reason_placeholder")}
            placeholderTextColor={colors.grey15}
            multiline
            className="text-14 font-custom400 text-black"
            style={[
              takeFontStyles("font-custom400 leading-[20px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr", minHeight: 60 },
            ]}
          />
        </DmView>

        {/* Spacer */}
        <DmView className="flex-1" />

        {/* Delete button */}
        <DmView className="pb-[40]">
          <ActionBtn
            onPress={() => setModalVisible(true)}
            className="h-[42] w-full bg-red"
            title={t("delete_my_account")}
            textClassName="text-13 leading-[21px] font-custom600 text-white"
          />
        </DmView>
      </DmView>

      {/* Confirmation Modal */}
      <MainModal
        isVisible={isModalVisible}
        onClose={() => setModalVisible(false)}
        Icon={<DeleteIcon width={48} height={48} />}
        title={t("confirm_delete_account")}
        isBtnsTwo
        titleBtn={t("yes")}
        titleBtnSecond={t("no")}
        onPress={() => {}}
        onPressSecond={() => setModalVisible(false)}
        classNameTitle="mt-[17] text-14 leading-[22px] font-custom600"
        classNameBtns="h-[40]"
        classNameBtnsWrapper="mt-[20] mx-[15]"
        classNameModal="px-[17]"
      />
    </SafeAreaView>
  )
}

export default DeleteAccountScreen
