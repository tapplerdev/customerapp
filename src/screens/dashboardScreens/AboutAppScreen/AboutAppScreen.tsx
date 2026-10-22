import React, { useCallback } from "react"
import { I18nManager } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import ChevronRightIcon from "assets/icons/chevron-right.svg"
import { RootStackScreenProps } from "navigation/types"
import colors from "@tappler/shared/src/styles/colors"
import { Text, a } from "@tappler/shared/src/ds"
import styles from "./styles"

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
            {t("about_app")}
          </Text>
        </DmView>
        <DmView style={styles.box} />
      </DmView>
      <DmView style={styles.box2} />

      {/* Menu Items */}
      <DmView>
        {menuItems.map((item, index) => (
          <DmView key={item.key} onPress={() => {}}>
            <DmView style={[a.flex_row, a.items_center, a.justify_between, a.px_24, a.py_16]}>
              <DmView style={a.flex_row}>
                <Text size={13} weight="medium" leading="legacy">
                  {t(item.labelKey)}
                </Text>
              </DmView>
              <DmView style={I18nManager.isRTL ? { transform: [{ rotate: "180deg" }] } : undefined}>
                <ChevronRightIcon width={18} height={18} color={colors.red} />
              </DmView>
            </DmView>
            {index < menuItems.length - 1 && (
              <DmView style={styles.box2} />
            )}
          </DmView>
        ))}
      </DmView>
    </SafeAreaView>
  )
}

export default AboutAppScreen
