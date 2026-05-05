import React, { useCallback, useMemo, useRef, useState } from "react"

import { SafeAreaView } from "react-native-safe-area-context"
import {
  Animated,
  I18nManager,
  ScrollView,
  useWindowDimensions,
  ViewStyle,
} from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"

import { RootStackScreenProps } from "navigation/types"
import SearchView from "./components/SearchView"
import MapPickerView from "./components/MapPickerView"
import MapPickerWithSearchView from "./components/MapPickerWithSearchView"
import { MapLocationResult, MapPosition } from "services/map-types"
import { isArLang } from "@tappler/shared/src/helpers/helpers"
import { addressEventBus } from "@tappler/shared/src/events/AddressBus"

type Props = RootStackScreenProps<"PickAddressScreen">
const AnimatedScrollView = Animated.createAnimatedComponent(Animated.ScrollView)

// Feature flag — when true, use the new single-screen search+map picker.
// Set to false to revert to the legacy 2-page horizontal scroll flow.
const USE_COMBINED_SEARCH_MAP = true

const PickAddressScreen: React.FC<Props> = ({ navigation }) => {
  const { width } = useWindowDimensions()
  const [positionPicked, setPositionPicked] = useState<MapPosition | undefined>(
    undefined
  )
  const [addressPicked, setAddressPicked] = useState<
    MapLocationResult | undefined
  >(undefined)

  // The combined view needs a starting position. We intentionally do NOT
  // request GPS here — the user arrived on this screen precisely because
  // they chose "Choose your location" instead of "Enable your location".
  // Default to Cairo (Tahrir Square) as a neutral centroid. Inside the
  // picker, they can tap the FAB to use their current location if they want.
  const combinedInitPosition = useMemo<MapPosition>(
    () => ({ lat: 30.0444, lng: 31.2357 }),
    []
  )

  const { i18n } = useTranslation()

  const scrollViewRef = useRef<ScrollView>(null)
  const itemViewStyle = useMemo<ViewStyle>(() => {
    return {
      width,
      flex: 1,
    }
  }, [width])

  const onBackToSearch = useCallback(() => {
    scrollViewRef.current?.scrollTo({
      x: I18nManager.isRTL ? width : 0,
      y: 0,
      animated: true,
    })
    setPositionPicked(undefined)
  }, [width])

  const onClose = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const onSelectedAddress = useCallback(
    async (address: MapLocationResult) => {
      const mapAddress = address.address

      let addressLabel = ""
      if (mapAddress.houseNumber && mapAddress.street) {
        addressLabel = `${mapAddress.houseNumber} ${mapAddress.street}`
      } else if (mapAddress.street) {
        addressLabel = mapAddress.street
      } else {
        const labelParts = mapAddress.label?.split(",") || []
        addressLabel = labelParts[0] || mapAddress.label || ""
      }

      const city = address.address.city
      const governorate =
        address.address.county || address.address.state

      const pickedAddressInfo = {
        address: addressLabel,
        city,
        governorate,
        coords: {
          lat: address.position.lat,
          lon: address.position.lng,
        },
      }

      addressEventBus.emit("address:pick", pickedAddressInfo)

      await new Promise((resolve) => setTimeout(resolve, 500))

      navigation.goBack()
    },
    [navigation, i18n]
  )

  const onLocationSelect = useCallback(
    (position: MapPosition, address: MapLocationResult | undefined) => {
      setPositionPicked(position)
      setAddressPicked(address)
      scrollViewRef.current?.scrollTo({
        x: I18nManager.isRTL ? 0 : width,
        y: 0,
        animated: true,
      })
    },
    [width]
  )

  if (USE_COMBINED_SEARCH_MAP) {
    return (
      <MapPickerWithSearchView
        initPosition={combinedInitPosition}
        initAddress={undefined}
        onClose={onClose}
        onSelectedAddress={onSelectedAddress}
      />
    )
  }

  return (
    <SafeAreaView className="w-full flex-1 bg-white">
      <AnimatedScrollView
        className="w-full flex-1"
        ref={scrollViewRef}
        scrollEnabled={false}
        horizontal={true}
        pagingEnabled={true}
        snapToInterval={width}
        showsHorizontalScrollIndicator={false}
      >
        <DmView key={0} style={itemViewStyle}>
          <SearchView onClose={onClose} onLocationSelect={onLocationSelect} />
        </DmView>
        <DmView key={1} style={itemViewStyle}>
          <MapPickerView
            onClose={onBackToSearch}
            initPosition={positionPicked}
            initAddress={addressPicked}
            onSelectedAddress={onSelectedAddress}
          />
        </DmView>
      </AnimatedScrollView>
    </SafeAreaView>
  )
}

export default PickAddressScreen
