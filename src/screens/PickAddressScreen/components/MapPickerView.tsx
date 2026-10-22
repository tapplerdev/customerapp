import { DmView } from "@tappler/shared/src/components/UI"
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
import { Alert, Platform, StyleSheet } from "react-native"
import useLocation from "@tappler/shared/src/hooks/useLocation"

import { searchAddressByPosition } from "services/here-maps-api"
import { isEgyptCountry } from "@tappler/shared/src/helpers/helpers"
import { Button, a, px } from "@tappler/shared/src/ds"
import dsStyles from "./styles"

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
      <SafeAreaView style={[a.w_full, a.flex_1, dsStyles.safeArea]}>
        <DmView style={[a.w_full, a.flex_1]}>
          <DmView style={[a.w_full, a.flex_1]}>
            {initPosition && (
              <>
                <MapView
                  style={a.flex_1}
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
                  showsPointsOfInterests={false}
                  showsCompass={false}
                  mapType="standard"
                />
                <DmView
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                >
                  <MapPinPicker
                    showInstruction={!selectedRegion}
                    pinSize="medium"
                  />
                </DmView>
                <DropShadow
                  style={[a.absolute, dsStyles.shadow, 
                    styles.closeShadow,
                    isAndroid && styles.closeShadowAndroid,
                  ]}
                >
                  <DmView
                    onPress={onClosePressed}
                    style={[
                      a.w_full,
                      a.h_full,
                      dsStyles.iconWrap,
                      a.items_center,
                      a.justify_center,
                    ]}
                  >
                    <CloseIcon />
                  </DmView>
                </DropShadow>
                <DropShadow
                  style={[a.absolute, dsStyles.shadow2, 
                    styles.myLocationShadow,
                    isAndroid && styles.myLocationShadowAndroid,
                  ]}
                >
                  <DmView
                    onPress={onGoToMyLocation}
                    style={[
                      a.w_full,
                      a.h_full,
                      dsStyles.iconWrap,
                      a.items_center,
                      a.justify_center,
                    ]}
                  >
                    <MyLocationIcon />
                  </DmView>
                </DropShadow>
              </>
            )}
          </DmView>
        </DmView>
      </SafeAreaView>
      <DmView style={[a.w_full, a.px_16, a.py_30]}>
        <Button
          onPress={onConfirmAddress}
          size="sm"
          label="sm"
          labelWeight="semibold"
          labelLeading={px(21)}
          loadingSurface="shade"
          style={a.w_full}
          title={t("confirm_my_location")}
          isLoading={addressConfirming}
        />
      </DmView>
    </>
  )
}

export default MapPickerView
