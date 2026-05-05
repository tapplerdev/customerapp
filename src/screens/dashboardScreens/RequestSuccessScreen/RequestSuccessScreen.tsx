import React, { useEffect, useMemo, useRef, useState } from "react"
import { Animated, Dimensions } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import LottieView from "lottie-react-native"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { useTypedSelector } from "store"
import { useLazyGetCustomerMeQuery } from "services/api"

import LocationRedIcon from "assets/icons/location-red.svg"
import successAnimation from "assets/animations/successful.json"
import styles from "./styles"

const SCREEN_HEIGHT = Dimensions.get("window").height

type Props = RootStackScreenProps<"RequestSuccessScreen">

const RequestSuccessScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation()
  const address = route.params?.address
  const { isAuth } = useTypedSelector((store) => store.auth)
  const [, { data: customerData }] = useLazyGetCustomerMeQuery()

  const [isSheetVisible, setSheetVisible] = useState(false)

  // Bottom sheet animation
  const sheetTranslateY = useRef(new Animated.Value(300)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current

  const isAlreadySaved = useMemo(() => {
    if (!address || !customerData?.addresses?.length) return false
    return customerData.addresses.some((saved) => {
      const sLat = saved.address.location.lat
      const sLng = saved.address.location.lng
      return (
        Math.abs(sLat - address.coords.lat) < 0.0001 &&
        Math.abs(sLng - address.coords.lon) < 0.0001
      )
    })
  }, [address, customerData?.addresses])

  const shouldPromptSave = isAuth && !!address && !isAlreadySaved

  const showSheet = () => {
    setSheetVisible(true)
    Animated.parallel([
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start()
  }

  const hideSheet = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: 300,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSheetVisible(false)
      callback?.()
    })
  }

  // Show bottom sheet after 1.5s delay
  useEffect(() => {
    if (shouldPromptSave) {
      const timer = setTimeout(showSheet, 3000)
      return () => clearTimeout(timer)
    }
  }, [shouldPromptSave])

  const handleDone = () => {
    if (isSheetVisible) {
      hideSheet(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: "HomeTabs", params: { screen: "talabati" } }],
        })
      })
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: "HomeTabs", params: { screen: "talabati" } }],
      })
    }
  }

  const handleSaveAddress = () => {
    if (!address) return
    hideSheet(() => {
      setTimeout(() => {
        navigation.navigate("AddNewAddressScreen", {
          address: address.address,
          city: address.city,
          governorate: address.governorate,
          coords: address.coords,
          fromSuccess: true,
        })
      }, 300)
    })
  }

  const handleDismissSave = () => {
    hideSheet()
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

      {/* Bottom sheet overlay */}
      {isSheetVisible && (
        <Animated.View
          className="absolute top-0 left-0 right-0 bottom-0"
          style={{ opacity: backdropOpacity, backgroundColor: "rgba(0,0,0,0.4)" }}
          pointerEvents="auto"
        >
          <DmView className="flex-1" onPress={handleDismissSave} />
        </Animated.View>
      )}

      {/* Bottom sheet */}
      {isSheetVisible && (
        <Animated.View
          className="absolute left-0 right-0 bottom-0 bg-white rounded-t-20 px-[24] pt-[24] pb-[40]"
          style={[
            styles.sheetShadow,
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          <DmView className="flex-row items-center mt-[4]">
            <LocationRedIcon width={20} height={20} />
            <DmText className="ml-[8] text-16 font-custom600 text-black">
              {t("save_this_address")}
            </DmText>
          </DmView>

          <DmText className="mt-[6] text-13 font-custom400 text-grey3">
            {t("save_address_descr")}
          </DmText>

          {/* Address preview */}
          <DmView
            className="mt-[16] px-[14] py-[12] rounded-10"
            style={styles.addressPreviewBg}
          >
            <DmText className="text-13 font-custom500 text-black">
              {address?.address}
            </DmText>
            {(address?.city || address?.governorate) && (
              <DmText className="text-12 font-custom400 text-grey3 mt-[3]">
                {[address.city, address.governorate].filter(Boolean).join(", ")}
              </DmText>
            )}
          </DmView>

          {/* Buttons */}
          <DmView className="flex-row mt-[20]">
            <DmView className="flex-1 mr-[10]">
              <ActionBtn
                title={t("no_thanks")}
                onPress={handleDismissSave}
                variant="white"
                className="h-[44] rounded-10"
                textClassName="text-13 font-custom500"
              />
            </DmView>
            <DmView className="flex-1">
              <ActionBtn
                title={t("save")}
                onPress={handleSaveAddress}
                className="h-[44] rounded-10"
                textClassName="text-13 font-custom600"
              />
            </DmView>
          </DmView>
        </Animated.View>
      )}
    </SafeAreaView>
  )
}

export default RequestSuccessScreen
