import React, { useCallback } from "react"
import { I18nManager } from "react-native"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import ChevronRightIcon from "assets/icons/chevron-right.svg"
import { RootStackScreenProps } from "navigation/types"
import colors from "@tappler/shared/src/styles/colors"

type Props = RootStackScreenProps<"AboutAppScreen">

const menuItems = [
  { key: "faq", labelKey: "frequent_asked_questions" },
  { key: "terms", labelKey: "terms_and_conditions" },
  { key: "privacy", labelKey: "privacy_policy" },
  { key: "feedback", labelKey: "feedback_and_suggestions" },
]

const AboutAppScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

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
            {t("about_app")}
          </DmText>
        </DmView>
        <DmView className="w-[32]" />
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      {/* Menu Items */}
      <DmView>
        {menuItems.map((item, index) => (
          <DmView key={item.key} onPress={() => {}}>
            <DmView className="flex-row items-center justify-between px-[24] py-[16]">
              <DmView className="flex-row">
                <DmText className="text-13 font-custom500 text-black">
                  {t(item.labelKey)}
                </DmText>
              </DmView>
              <DmView style={I18nManager.isRTL ? { transform: [{ rotate: "180deg" }] } : undefined}>
                <ChevronRightIcon width={18} height={18} color={colors.red} />
              </DmView>
            </DmView>
            {index < menuItems.length - 1 && (
              <DmView className="h-[0.7] bg-grey19" />
            )}
          </DmView>
        ))}
      </DmView>
    </SafeAreaView>
  )
}

export default AboutAppScreen
