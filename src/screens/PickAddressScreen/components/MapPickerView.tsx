import { ActionBtn, DmView } from "@tappler/shared/src/components/UI"
import React, { useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import DropShadow from "react-native-drop-shadow"
import MapView, { Details, PROVIDER_GOOGLE, Region } from "react-native-maps"
import CloseIcon from "assets/icons/close.svg"
import MyLocationIcon from "assets/icons/my-location-red.svg"
import MapPinPicker from "components/MapPinPicker/MapPinPicker"

import { SafeAreaView } from "react-native-safe-area-context"
import { MapLocationResult, MapPosition } from "services/map-types"
import styles from "../styles"
import { Alert, Platform } from "react-native"
import useLocation from "@tappler/shared/src/hooks/useLocation"

import { searchAddressByPosition } from "services/here-maps-api"
import { isEgyptCountry } from "@tappler/shared/src/helpers/helpers"

interface Props {
  initPosition?: MapPosition | undefined
  initAddress?: MapLocationResult | undefined
  onClose?: () => void
  onSelectedAddress?: (address: MapLocationResult) => void
}

const defaultLatitudeDelta = 0.005
const defaultLongitudeDelta = 0.0025

const isAndroid = Platform.OS === "android"

const MapPickerView: React.FC<Props> = ({
  initPosition,
  onClose,
  onSelectedAddress,
}) => {
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
  const [addressConfirming, setAddressConfirming] = useState<boolean>(false)

  const onErrorGetCurrentLocation = useCallback((error: string) => {
    Alert.alert(error)
  }, [])
  const { getCurrentLocation } = useLocation(onErrorGetCurrentLocation)
  const mapRef = useRef<MapView>(null)

  const { t, i18n } = useTranslation()

  const onGoToMyLocation = useCallback(async () => {
    const rs = await getCurrentLocation()
    if (rs) {
      mapRef.current?.animateToRegion(
        {
          latitude: rs.lat,
          longitude: rs.lng,
          latitudeDelta: defaultLatitudeDelta,
          longitudeDelta: defaultLongitudeDelta,
        },
        1000
      )
    }
  }, [])

  const onConfirmAddress = useCallback(async () => {
    setAddressConfirming(true)

    const postion: MapPosition | undefined = selectedRegion
      ? {
          lat: selectedRegion.latitude,
          lng: selectedRegion.longitude,
        }
      : initPosition

    if (postion) {
      const lang = i18n.language === "ar" ? "ar" : "en-US"
      const addressResult = await searchAddressByPosition(
        postion,
        undefined,
        lang
      )

      const egyAddressRs = addressResult.filter((add) =>
        isEgyptCountry(add.address.countryCode)
      )

      if (egyAddressRs.length > 0) {
        onSelectedAddress?.(egyAddressRs[0])
      } else {
        Alert.alert(t("your_location_is_outside"))
        setAddressConfirming(false)
      }
    } else {
      setAddressConfirming(false)
    }
  }, [selectedRegion, initPosition, onSelectedAddress, i18n.language])

  const handleRegionChangeCompleted = useCallback(
    (region: Region, _details: Details) => {
      setSelectedRegion(region)
    },
    []
  )

  const onClosePressed = useCallback(() => {
    setSelectedRegion(null)
    setAddressConfirming(false)
    onClose?.()
  }, [onClose])

  return (
    <>
      <SafeAreaView className="w-full flex-1 bg-white">
        <DmView className="w-full flex-1">
          <DmView className="w-full flex-1">
            {initPosition && (
              <>
                <MapView
                  className="flex-1"
                  ref={mapRef}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={{
                    latitude: initPosition.lat,
                    longitude: initPosition.lng,
                    latitudeDelta: defaultLatitudeDelta,
                    longitudeDelta: defaultLongitudeDelta,
                  }}
                  onRegionChangeComplete={handleRegionChangeCompleted}
                  showsMyLocationButton={false}
                  toolbarEnabled={false}
                  showsUserLocation={false}
                  showsBuildings={true}
                  showsPointsOfInterest={false}
                  showsCompass={false}
                  mapType="standard"
                />
                <DmView
                  className="absolute left-0 top-0 right-0 bottom-0"
                  pointerEvents="none"
                >
                  <MapPinPicker
                    showInstruction={!selectedRegion}
                    pinSize="medium"
                  />
                </DmView>
                <DropShadow
                  className="absolute left-[8] top-[8] w-[48] h-[48] rounded-full"
                  style={[
                    styles.closeShadow,
                    isAndroid && styles.closeShadowAndroid,
                  ]}
                >
                  <DmView
                    onPress={onClosePressed}
                    className="w-full h-full rounded-full bg-white items-center justify-center"
                  >
                    <CloseIcon />
                  </DmView>
                </DropShadow>
                <DropShadow
                  className="absolute right-[16] bottom-[70] w-[44] h-[44] rounded-full"
                  style={[
                    styles.myLocationShadow,
                    isAndroid && styles.myLocationShadowAndroid,
                  ]}
                >
                  <DmView
                    onPress={onGoToMyLocation}
                    className="w-full h-full rounded-full bg-white items-center justify-center"
                  >
                    <MyLocationIcon />
                  </DmView>
                </DropShadow>
              </>
            )}
          </DmView>
        </DmView>
      </SafeAreaView>
      <DmView className="w-full px-[16] py-[30]">
        <ActionBtn
          onPress={onConfirmAddress}
          className={`h-[42] w-full ${
            addressConfirming ? "bg-grey4" : ""
          }`}
          title={t("confirm_my_location")}
          textClassName="text-13 leading-[21px] font-custom600"
          isLoading={addressConfirming}
        />
      </DmView>
    </>
  )
}

export default MapPickerView
