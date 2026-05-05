import React, { useCallback, useEffect, useRef } from "react"

// Components
import {
  DmText,
  DmView,
} from "@tappler/shared/src/components/UI"
import { SafeAreaView } from "react-native-safe-area-context"
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from "react-native"
import DropShadow from "react-native-drop-shadow"

// Hooks
import { useTranslation } from "react-i18next"
import useLocation from "@tappler/shared/src/hooks/useLocation"
import { useDispatch } from "react-redux"

// Helpers & Types
import { RootStackScreenProps } from "navigation/types"
import { addressEventBus } from "@tappler/shared/src/events/AddressBus"
import { AddressInfo } from "@tappler/shared/src/types"
import colors from "@tappler/shared/src/styles/colors"
import { setGuestLocation } from "store/auth/slice"

// Assets
import LocationIcon from "assets/icons/precision-location.svg"
import SearchIcon from "assets/icons/search-red.svg"
import HiThereIcon from "assets/icons/hi-there.svg"

type Props = RootStackScreenProps<"GuestLocationScreen">

const GuestLocationScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const onLocationError = useCallback((error: string) => {
    Alert.alert(error)
  }, [])

  const { getCurrentLocation, loading } = useLocation(onLocationError)

  const goToHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: "HomeTabs" }],
    })
  }, [navigation])

  const handleEnable = useCallback(async () => {
    try {
      const pos = await getCurrentLocation()
      if (pos) {
        dispatch(
          setGuestLocation({
            coords: { lat: pos.lat, lng: pos.lng },
            address: null,
          })
        )
        goToHome()
      }
    } catch (e) {
    }
  }, [getCurrentLocation, dispatch, goToHome])

  const handleChoose = useCallback(() => {
    navigation.navigate("PickAddressScreen")
  }, [navigation])

  const pendingNavigateRef = useRef(false)

  useEffect(() => {
    const handler = (data: AddressInfo) => {
      dispatch(
        setGuestLocation({
          coords: data.coords
            ? { lat: data.coords.lat, lng: data.coords.lon }
            : null,
          address: {
            address: data.address || "",
            city: data.city,
            governorate: data.governorate,
            coords: data.coords || { lat: 0, lon: 0 },
          },
        })
      )
      // Defer navigation until after PickAddressScreen has popped itself.
      pendingNavigateRef.current = true
    }
    addressEventBus.on("address:pick", handler)
    return () => {
      addressEventBus.off("address:pick", handler)
    }
  }, [dispatch])

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      if (pendingNavigateRef.current) {
        pendingNavigateRef.current = false
        goToHome()
      }
    })
    return unsub
  }, [navigation, goToHome])

  return (
    <SafeAreaView className="flex-1 bg-white">
      <DmView className="flex-1 px-[24] items-center justify-center">
        <HiThereIcon width={303} height={202} />

        <DmText className="mt-[24] text-24 font-custom600 text-black1 text-center">
          {t("hi_there")}
        </DmText>

        <DmText className="mt-[12] text-14 font-custom400 text-grey3 text-center px-[8]">
          {t("before_using_app_location")}
        </DmText>

        <DmView className="w-full mt-[40]">
          <DropShadow
            style={[
              styles.btnShadow,
              Platform.OS === "android" && styles.btnShadowAndroid,
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={loading ? undefined : handleEnable}
              className="h-[51] bg-red rounded-28 flex-row items-center justify-center"
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <LocationIcon width={20} height={20} />
                  <DmText className="ml-[8] text-13 font-custom500 text-white">
                    {t("enable_your_location")}
                  </DmText>
                </>
              )}
            </TouchableOpacity>
          </DropShadow>
          <DropShadow
            style={[
              styles.btnShadow,
              Platform.OS === "android" && styles.btnShadowAndroid,
              { marginTop: 14 },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleChoose}
              className="h-[51] bg-white rounded-28 flex-row items-center justify-center border-0.5 border-red"
            >
              <SearchIcon width={20} height={20} />
              <DmText className="ml-[8] text-13 font-custom400 text-red">
                {t("choose_your_location")}
              </DmText>
            </TouchableOpacity>
          </DropShadow>
        </DmView>
      </DmView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  btnShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  btnShadowAndroid: {
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
})

export default GuestLocationScreen
