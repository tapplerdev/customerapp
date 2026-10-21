import React from "react"
import { Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { MainModal } from "@tappler/shared/src/components"
import { useTranslation } from "react-i18next"

const summarize = (user, isAr) => ({
  name: isAr ? user?.nameAr : user?.name,
  typeKey: user?.type ? `account_type_${user.type}` : undefined,
  memberSince: user?.createdAt,
})

// The control's compiler shape on DmView: with no compiler it isn't wrapped.
export const SameShapeOnDmView = ({ user }) => {
  const { t, i18n } = useTranslation()
  const profile = summarize(user, i18n.language === "ar")

  return (
    <DmView className="flex-row items-center mt-[23] pl-[19]">
      <DmView className="ml-[10] flex-1">
        {!!profile.name && (
          <DmText className="text-16 leading-[20px] font-custom600">
            {profile.name}
          </DmText>
        )}
        {!!profile.typeKey && (
          <DmText className="text-12 leading-[17px] font-custom400">
            {t(profile.typeKey)}
          </DmText>
        )}
        {!!profile.memberSince && (
          <DmText className="text-12 leading-[17px] font-custom400">
            {t("settings_member_since", { date: profile.memberSince })}
          </DmText>
        )}
      </DmView>
    </DmView>
  )
}

export const Converted = ({ onClose }) => {
  const { t } = useTranslation()

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View style={{ paddingLeft: 16, paddingRight: 16 }}>
        <Text style={{ fontSize: 16, lineHeight: 19 }}>{t("title")}</Text>
      </View>
      <ActionBtn className="h-[47] rounded-5" title={t("save")} />
      <MainModal className="px-[20]" isVisible onClose={onClose} />
    </SafeAreaView>
  )
}
