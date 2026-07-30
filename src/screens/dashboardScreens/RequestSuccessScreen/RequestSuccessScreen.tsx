import React, { useEffect, useMemo } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import LottieView from "lottie-react-native"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { useTypedSelector } from "store"
import { useGetCustomerMeQuery } from "services/api"

import successAnimation from "assets/animations/successful.json"
import styles from "./styles"

type Props = RootStackScreenProps<"RequestSuccessScreen">

const RequestSuccessScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation()
  const address = route.params?.address
  const { isAuth } = useTypedSelector((store) => store.auth)
  // useLazyGetCustomerMeQuery's trigger was discarded (`[, { data }]`), so the
  // fetch never fired and `data` sat permanently undefined. That made
  // isAlreadySaved always false, which made the prompt always show — the whole
  // point of the check. Same pattern AddressSelectionModal already uses.
  const { data: customerData } = useGetCustomerMeQuery(undefined, {
    skip: !isAuth,
  })

  const isAlreadySaved = useMemo(() => {
    // Hoisted: narrowing `address.coords` does not survive into the .some()
    // callback, but a local const does.
    const coords = address?.coords
    if (!coords || !customerData?.addresses?.length) return false
    return customerData.addresses.some((saved) => {
      const sLat = saved.address.location.lat
      const sLng = saved.address.location.lng
      return (
        Math.abs(sLat - coords.lat) < 0.0001 &&
        Math.abs(sLng - coords.lon) < 0.0001
      )
    })
  }, [address, customerData?.addresses])

  // Requires the addresses to have actually ARRIVED, not merely "no first load
  // in flight". isLoading is false on a REJECTED request too, and the api's
  // error handling deliberately keeps the session alive on network errors and
  // 5xx, so on flaky connectivity we'd have isAuth true, data undefined,
  // isAlreadySaved false — and the prompt would fire for an address the
  // customer already has, which is the exact bug this was meant to kill.
  // Failing closed here loses a save offer; failing open re-creates the bug.
  const shouldPromptSave = isAuth && !!address && !!customerData && !isAlreadySaved

  // Let the success animation land before the sheet slides up. clearTimeout
  // covers the case where Done is tapped first — that resets the stack, which
  // unmounts this screen, and the sheet must not open onto a dead route.
  useEffect(() => {
    if (shouldPromptSave) {
      const timer = setTimeout(
        () => navigation.navigate("SaveAddressSheetScreen", { address }),
        3000,
      )
      return () => clearTimeout(timer)
    }
  }, [shouldPromptSave, navigation, address])

  const handleDone = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "HomeTabs", params: { screen: "talabati" } }],
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <DmView className="flex-1 items-center justify-center px-[40]">
        <LottieView
          source={successAnimation}
          autoPlay
          loop
          style={styles.lottieSize}
        />
        <DmText className="mt-[24] text-20 font-custom600 text-black text-center">
          {t("we_received_your_request_v2")}
        </DmText>
        <DmText className="mt-[12] text-14 font-custom400 text-grey3 text-center">
          {t("check_request_status_prefix")}{"\n"}
          "<DmText className="text-14 font-custom600 text-red">{t("talabati")}</DmText>
          " {t("section")}
        </DmText>
      </DmView>

      <DmView className="px-[20] mb-[30]">
        <ActionBtn
          title={t("done")}
          onPress={handleDone}
          textClassName="text-14 font-custom600"
        />
      </DmView>
    </SafeAreaView>
  )
}

export default RequestSuccessScreen
