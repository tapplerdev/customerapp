import React from "react"
import { StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmView } from "@tappler/shared/src/components/UI"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import { RootStackScreenProps } from "navigation/types"

import CloseIcon from "assets/icons/close.svg"
import LucideSend from "assets/icons/lucide-send.svg"
import LucideBell from "assets/icons/lucide-bell.svg"
import LucideMessage from "assets/icons/lucide-message-circle.svg"
import LucideTag from "assets/icons/lucide-tag.svg"
import { Text, a, px } from "@tappler/shared/src/ds"
import dsStyles from "./styles"

type Props = RootStackScreenProps<"AuthGateScreen">

const AuthGateScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const valueProps = [
    { icon: <LucideBell width={20} height={20} color={colors.red} />, title: t("track_your_request"), desc: t("track_your_request_desc") },
    { icon: <LucideMessage width={20} height={20} color={colors.red} />, title: t("chat_with_pros"), desc: t("chat_with_pros_desc") },
    { icon: <LucideTag width={20} height={20} color={colors.red} />, title: t("get_offers_fast"), desc: t("get_offers_fast_desc") },
  ]

  const handleSignUp = () => {
    navigation.goBack()
    setTimeout(() => {
      navigation.navigate("RegisterScreen" as any, { returnTo: true })
    }, 300)
  }

  const handleLogIn = () => {
    navigation.goBack()
    setTimeout(() => {
      navigation.navigate("SignInEmailScreen" as any, { returnTo: true })
    }, 300)
  }

  return (
    <DmView style={[a.flex_1, dsStyles.container]}>
      {/* Top spacing (no grabber) */}
      <DmView style={a.pt_12} />

      {/* Close button */}
      <DmView style={[a.absolute, dsStyles.boxWrap]}>
        <DmView
          onPress={() => navigation.goBack()}
          style={[dsStyles.iconWrap, a.items_center, a.justify_center]}
          hitSlop={HIT_SLOP_DEFAULT}
        >
          <CloseIcon width={12} height={12} color={colors.black} />
        </DmView>
      </DmView>

      {/* Hero icon */}
      <DmView style={[a.items_center, a.mt_20]}>
        <DmView
          style={[dsStyles.lucideSendWrap, a.items_center, a.justify_center, styles.heroIcon]}
        >
          <LucideSend width={36} height={36} color={colors.red} />
        </DmView>
      </DmView>

      {/* Title + subtitle */}
      <DmView style={[a.items_center, a.px_20, a.mt_18]}>
        <Text size={24} align="center" family="system">
          {t("almost_there")}
        </Text>
        <Text size={14} leading="loose" color="tertiary" align="center" style={a.mt_6} numberOfLines={1}>
          {t("create_free_account_subtitle")}
        </Text>
      </DmView>

      {/* Value props */}
      <DmView style={[a.px_22, a.mt_18]}>
        {valueProps.map((vp, idx) => (
          <DmView key={idx} style={[a.flex_row, a.items_center, a.mb_14]}>
            <DmView
              style={[dsStyles.box, a.items_center, a.justify_center, a.mr_14, styles.vpIcon]}
            >
              {vp.icon}
            </DmView>
            <DmView style={a.flex_1}>
              <Text size={14} weight="bold">
                {vp.title}
              </Text>
              <Text size={12} color="tertiary" style={a.mt_2}>
                {vp.desc}
              </Text>
            </DmView>
          </DmView>
        ))}
      </DmView>

      {/* Spacer */}
      <DmView style={a.flex_1} />

      {/* CTAs */}
      <DmView style={[a.px_22, a.pb_16]}>
        <DmView
          onPress={handleSignUp}
          style={[dsStyles.signUpWrap, a.items_center, a.justify_center, styles.signUpShadow]}
        >
          <Text size={16} weight="bold" leading="legacy" color="inverse">
            {t("sign_up")}
          </Text>
        </DmView>
        <DmView
          onPress={handleLogIn}
          style={[
            dsStyles.logInWrap,
            a.items_center,
            a.justify_center,
            a.mt_10,
            a.border_1,
          ]}
        >
          <Text size={16} weight="bold" leading="legacy" color="brand">
            {t("log_in")}
          </Text>
        </DmView>

        <Text size={12} leading={px(18)} color="tertiary" align="center" style={a.mt_14}>
          {t("terms_privacy_agreement")}
        </Text>
      </DmView>
    </DmView>
  )
}

const styles = StyleSheet.create({
  heroIcon: {
    backgroundColor: "#FFF8F8",
    borderWidth: 1,
    borderColor: "#FFE6E6",
  },
  vpIcon: {
    backgroundColor: "#FFF8F8",
  },
  signUpShadow: {
    shadowColor: "#CC0000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
})

export default AuthGateScreen
