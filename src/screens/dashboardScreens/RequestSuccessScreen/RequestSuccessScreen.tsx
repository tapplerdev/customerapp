import React, { useEffect, useMemo, useRef } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import LottieView from "lottie-react-native"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { useTypedSelector } from "store"
import { useGetCustomerMeQuery } from "services/api"
import { useRequestPushPermission } from "hooks/usePushNotifications"

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
  // savedAddressId is the exact answer and is checked first: the address came
  // off the account, so there is nothing to offer. The coordinate comparison
  // stays as a backstop for addresses that reached here by other routes, but it
  // is an approximation — a saved address re-geocoded, or stored at different
  // precision, lands outside the 0.0001 window and the prompt fires for
  // something the customer already has. Which is what it was doing.
  const shouldPromptSave =
    isAuth &&
    !!address &&
    !address.savedAddressId &&
    !!customerData &&
    !isAlreadySaved

  // Let the success animation land before the sheet slides up. Held in a ref
  // as well as cleared on unmount, because Done now has to be able to cancel it
  // directly — see handleDone.
  const saveSheetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (shouldPromptSave) {
      saveSheetTimer.current = setTimeout(
        () => navigation.navigate("SaveAddressSheetScreen", { address }),
        3000,
      )
      return () => {
        if (saveSheetTimer.current) clearTimeout(saveSheetTimer.current)
        saveSheetTimer.current = null
      }
    }
  }, [shouldPromptSave, navigation, address])

  const requestPushPermission = useRequestPushPermission()
  const isLeaving = useRef(false)

  // The app's only notification-permission prompt, spent here on purpose.
  //
  // The customer has just submitted a request and is being told to watch
  // Talabati for a response — which is precisely what a notification would save
  // them from having to do. Asked on first launch instead, the same prompt is a
  // question about nothing, and iOS gives an app exactly one chance at it.
  //
  // Three things this got wrong the first time, all from awaiting it here:
  //
  //   - Done went dead for as long as the dialog, a token fetch and a POST
  //     with a 20s timeout took, with no spinner and nothing disabled.
  //   - ActionBtn has no debounce, so a second tap during that dead window ran
  //     navigation.reset twice and fired two concurrent registrations, which
  //     the registeredToken memo cannot dedupe because both read it before
  //     either writes.
  //   - Worst: the screen stayed mounted, so tapping Done at t=2.9s let the
  //     3s timer fire underneath the dialog. The save-address sheet pushed,
  //     the dialog covered it, and answering the dialog reset the stack out
  //     from under the sheet — it flashed up and vanished, and the customer
  //     lost the offer to save their address.
  //
  // So: cancel that timer, leave immediately, and let the prompt come up over
  // Talabati a moment later, where the customer can see the request it is
  // about sitting in the list.
  const handleDone = () => {
    if (isLeaving.current) return
    isLeaving.current = true

    if (saveSheetTimer.current) {
      clearTimeout(saveSheetTimer.current)
      saveSheetTimer.current = null
    }

    navigation.reset({
      index: 0,
      routes: [{ name: "HomeTabs", params: { screen: "talabati" } }],
    })

    requestPushPermission()
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
