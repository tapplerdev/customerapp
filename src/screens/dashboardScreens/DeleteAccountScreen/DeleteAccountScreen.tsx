import React, { useCallback, useState } from "react"
import { TextInput } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { MainModal } from "@tappler/shared/src/components"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import DeleteIcon from "assets/icons/Delete.svg"
import { RootStackScreenProps } from "navigation/types"
import colors from "@tappler/shared/src/styles/colors"
import { takeFontStyles } from "@tappler/shared/src/helpers/helpers"
import { AppKeyboardAwareScrollView } from "components/scroll"
import { Text, Button, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

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
            {t("delete_account")}
          </Text>
        </DmView>
        <DmView style={styles.box} />
      </DmView>
      <DmView style={styles.box2} />

      {/*
        The reason field is MULTILINE, so its return key inserts a newline
        instead of dismissing — and the Delete button below is pinned to the
        physical bottom by the flex-1 spacer. Without a scroller the keyboard
        covered the button with no gesture to get it back, so the flow could
        not be completed at all.

        `flexGrow: 1` is what keeps that spacer doing its job inside a scroll
        view. Same shape as RegisterScreen and SignInEmailScreen; no
        enableOnAndroid, because this app mounts no KeyboardProvider so the
        manifest's adjustResize still shrinks the window on Android.
      */}
      <AppKeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <DmView style={[a.flex_1, a.px_24, a.pt_24]}>
        {/* Warning text */}
        <DmView style={a.flex_row}>
          <Text size={13} leading="loose">
            {t("delete_account_warning")}
          </Text>
        </DmView>

        {/* Reason field */}
        <DmView style={a.mt_24}>
          <DmView style={a.flex_row}>
            <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
              {t("reason_for_cancelling")}
            </Text>
          </DmView>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t("delete_account_reason_placeholder")}
            placeholderTextColor={colors.grey15}
            multiline
            style={[styles.input, 
              takeFontStyles("font-custom400 leading-[20px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr", minHeight: 60 },
            ]}
          />
        </DmView>

        {/* Spacer */}
        <DmView style={a.flex_1} />

        {/* Delete button */}
        <DmView style={a.pb_40}>
          <Button
            onPress={() => setModalVisible(true)}
            size="sm"
            label="sm"
            labelWeight="semibold"
            labelLeading={px(21)}
            style={a.w_full}
            title={t("delete_my_account")}
          />
        </DmView>
      </DmView>
      </AppKeyboardAwareScrollView>

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
        titleType={{ size: 14, leading: px(22) }}
        titleStyle={styles.mainModalTitle}
        btnsStyle={styles.mainModalBtns}
        btnsWrapperStyle={[a.mt_20, styles.mainModalBtnsWrapper]}
        modalStyle={styles.mainModalModal}
      />
    </SafeAreaView>
  )
}

export default DeleteAccountScreen
