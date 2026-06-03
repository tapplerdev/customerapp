import React from "react"
import { StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import { RootStackScreenProps } from "navigation/types"

import CloseIcon from "assets/icons/close.svg"
import LucideSend from "assets/icons/lucide-send.svg"
import LucideBell from "assets/icons/lucide-bell.svg"
import LucideMessage from "assets/icons/lucide-message-circle.svg"
import LucideTag from "assets/icons/lucide-tag.svg"

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
    <DmView className="flex-1 bg-white">
      {/* Top spacing (no grabber) */}
      <DmView className="pt-[12]" />

      {/* Close button */}
      <DmView className="absolute top-[12] right-[16] z-10">
        <DmView
          onPress={() => navigation.goBack()}
          className="w-[32] h-[32] rounded-full bg-grey5 items-center justify-center"
          hitSlop={HIT_SLOP_DEFAULT}
        >
          <CloseIcon width={12} height={12} color={colors.black} />
        </DmView>
      </DmView>

      {/* Hero icon */}
      <DmView className="items-center mt-[20]">
        <DmView
          className="w-[72] h-[72] rounded-[20] items-center justify-center"
          style={styles.heroIcon}
        >
          <LucideSend width={36} height={36} color={colors.red} />
        </DmView>
      </DmView>

      {/* Title + subtitle */}
      <DmView className="items-center px-[20] mt-[18]">
        <DmText className="text-24 leading-[30px] font-custom800 text-black text-center">
          {t("almost_there")}
        </DmText>
        <DmText className="text-14 leading-[20px] font-custom400 text-grey3 text-center mt-[6]" numberOfLines={1}>
          {t("create_free_account_subtitle")}
        </DmText>
      </DmView>

      {/* Value props */}
      <DmView className="px-[22] mt-[18]">
        {valueProps.map((vp, idx) => (
          <DmView key={idx} className="flex-row items-center mb-[14]">
            <DmView
              className="w-[40] h-[40] rounded-[12] items-center justify-center mr-[14]"
              style={styles.vpIcon}
            >
              {vp.icon}
            </DmView>
            <DmView className="flex-1">
              <DmText className="text-14 leading-[18px] font-custom700 text-black">
                {vp.title}
              </DmText>
              <DmText className="text-12 leading-[16px] font-custom400 text-grey3 mt-[2]">
                {vp.desc}
              </DmText>
            </DmView>
          </DmView>
        ))}
      </DmView>

      {/* Spacer */}
      <DmView className="flex-1" />

      {/* CTAs */}
      <DmView className="px-[22] pb-[16]">
        <DmView
          onPress={handleSignUp}
          className="h-[52] rounded-[26] bg-red items-center justify-center"
          style={styles.signUpShadow}
        >
          <DmText className="text-16 font-custom700 text-white">
            {t("sign_up")}
          </DmText>
        </DmView>
        <DmView
          onPress={handleLogIn}
          className="h-[52] rounded-[26] bg-white items-center justify-center mt-[10] border-1 border-red"
        >
          <DmText className="text-16 font-custom700 text-red">
            {t("log_in")}
          </DmText>
        </DmView>

        <DmText className="text-12 leading-[18px] font-custom400 text-grey3 text-center mt-[14]">
          {t("terms_privacy_agreement")}
        </DmText>
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
