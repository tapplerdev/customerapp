import React from "react"
import { TextInput, StyleSheet, KeyboardAvoidingView, Platform } from "react-native"
import Animated, { FadeInUp } from "react-native-reanimated"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import { takeFontStyles } from "@tappler/shared/src/helpers/helpers"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import TapplerLogo from "assets/icons/tappler-logo-red.svg"
import SearchIcon from "assets/icons/search-red.svg"
import { Text, a, px } from "@tappler/shared/src/ds"
import dsStyles from "./styles"

type Props = RootStackScreenProps<"TapplyAIScreen">

const TapplyAIScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()
  const fontStyles = takeFontStyles("font-custom400", i18n.language)

  return (
    <SafeAreaView style={[a.flex_1, dsStyles.safeArea]} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Back button */}
        <DmView style={[a.px_16, a.pt_8]}>
          <DmView
            onPress={() => navigation.goBack()}
            style={[dsStyles.iconWrap, a.items_center, a.justify_center]}
            hitSlop={HIT_SLOP_DEFAULT}
          >
            <ChevronLeftIcon
              color={colors.red}
              style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
            />
          </DmView>
        </DmView>

        {/* Spacer top */}
        <DmView style={a.flex_1} />

        {/* Logo + greeting — centered */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(100)}
          style={a.items_center}
        >
          <TapplerLogo width={80} height={80} />

          <Text size={22} weight="bold" leading={px(28)} style={a.mt_16}>
            {t("hi_im_tapply")}
          </Text>
          <Text size={14} leading="loose" color="tertiary" style={a.mt_4}>
            {t("how_can_i_help")}
          </Text>
        </Animated.View>

        {/* Spacer bottom */}
        <DmView style={a.flex_1} />

        {/* Search input */}
        <DmView style={[a.px_16, { paddingBottom: insets.bottom + 16 }]}>
          <DmView
            style={[dsStyles.row, a.flex_row, a.items_center, a.px_14, styles.searchInput]}
          >
            <SearchIcon width={16} height={16} />
            <TextInput
              placeholder={t("tapply_search_placeholder")}
              placeholderTextColor={colors.grey3}
              style={[
                fontStyles,
                {
                  flex: 1,
                  marginHorizontal: 8,
                  fontSize: 14,
                  color: colors.black,
                  textAlign: isAr ? "right" : "left",
                  padding: 0,
                },
              ]}
              returnKeyType="search"
            />
          </DmView>
        </DmView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  searchInput: {
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "#D0D0D0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
})

export default TapplyAIScreen
