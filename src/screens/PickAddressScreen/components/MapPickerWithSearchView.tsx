import {
  ActionBtn,
  DmInput,
  DmText,
  DmView,
} from "@tappler/shared/src/components/UI"
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import DropShadow from "react-native-drop-shadow"
import MapView, {
  Details,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps"
import CloseIcon from "assets/icons/close.svg"
import MyLocationIcon from "assets/icons/my-location-red.svg"
import MapMarkerIcon from "assets/icons/location-red-solid.svg"
import SearchIcon from "assets/icons/search-black.svg"
import LocationRedIcon from "assets/icons/location-red.svg"
import LocationIcon from "assets/icons/location.svg"

import { useSafeAreaInsets } from "react-native-safe-area-context"
import { MapLocationResult, MapPosition } from "services/map-types"
import styles from "../styles"
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  LayoutAnimation,
  ListRenderItemInfo,
  Platform,
  UIManager,
} from "react-native"
import useLocation from "@tappler/shared/src/hooks/useLocation"

import {
  searchAddress,
  searchAddressByPosition,
} from "services/here-maps-api"
import { isEgyptCountry } from "@tappler/shared/src/helpers/helpers"
import { SHOULD_IGNORE_START_TEXT_ADDRESS } from "utils/constants"
import colors from "@tappler/shared/src/styles/colors"

interface Props {
  initPosition?: MapPosition | undefined
  initAddress?: MapLocationResult | undefined
  onClose?: () => void
  onSelectedAddress?: (address: MapLocationResult) => void
}

const defaultLatitudeDelta = 0.004
const defaultLongitudeDelta = 0.002

const isAndroid = Platform.OS === "android"

// Enable LayoutAnimation on Android (one-time setup)
if (
  isAndroid &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const searchModeTransition = {
  duration: 220,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
}

const isNumberStartAddress = (address: string) => {
  return /^[0-9\/\-\_ ]+$/.test(address)
}

const SearchResultItem = (props: {
  item: MapLocationResult
  onPress: (item: MapLocationResult) => void
}) => (
  <DmView onPress={() => props.onPress(props.item)}>
    <DmView
      className="py-[14] flex-row items-center border-b-1 border-b-grey8"
      style={{ marginEnd: 16, paddingStart: 16 }}
    >
      <LocationRedIcon />
      <DmText
        className="text-13 leading-[20px] font-custom400 flex-1"
        style={{ marginStart: 12 }}
      >
        {props.item.title}
      </DmText>
    </DmView>
  </DmView>
)

const MapPickerWithSearchView: React.FC<Props> = ({
  initPosition,
  initAddress,
  onClose,
  onSelectedAddress,
}) => {
  const { t, i18n } = useTranslation()
  const insets = useSafeAreaInsets()

  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
  const [resolvedAddress, setResolvedAddress] =
    useState<MapLocationResult | null>(initAddress || null)
  const [isResolvingAddress, setIsResolvingAddress] = useState(false)

  // Animated pin state (ropacalapp-style bounce + shadow pulse)
  const [isMapMoving, setIsMapMoving] = useState(false)
  const pinTranslateY = useRef(new Animated.Value(0)).current
  const shadowScale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(pinTranslateY, {
        toValue: isMapMoving ? -10 : 0,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(shadowScale, {
        toValue: isMapMoving ? 1.5 : 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start()
  }, [isMapMoving, pinTranslateY, shadowScale])


  // Search state
  const [searchText, setSearchText] = useState("")
  const [searchResults, setSearchResults] = useState<MapLocationResult[]>([])
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [isSearchLoading, setIsSearchLoading] = useState(false)
  const [isValidSearchText, setIsValidSearchText] = useState(false)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)
  const reverseGeocodeTimeout = useRef<NodeJS.Timeout | null>(null)
  const suppressNextGeocodeRef = useRef(false)

  const enterSearchMode = useCallback(() => {
    LayoutAnimation.configureNext(searchModeTransition)
    setIsSearchMode(true)
  }, [])

  const exitSearchMode = useCallback(() => {
    LayoutAnimation.configureNext(searchModeTransition)
    setIsSearchMode(false)
    setSearchText("")
    setSearchResults([])
    setIsValidSearchText(false)
    Keyboard.dismiss()
  }, [])

  // Confirm state
  const [addressConfirming, setAddressConfirming] = useState<boolean>(false)

  const onErrorGetCurrentLocation = useCallback((error: string) => {
    Alert.alert(error)
  }, [])
  const { getCurrentLocation } = useLocation(onErrorGetCurrentLocation)
  const mapRef = useRef<MapView>(null)

  // Reverse geocode helper - debounced, used to populate subtitle as pin moves
  const triggerReverseGeocode = useCallback(
    (position: MapPosition) => {
      if (reverseGeocodeTimeout.current) {
        clearTimeout(reverseGeocodeTimeout.current)
      }
      reverseGeocodeTimeout.current = setTimeout(async () => {
        const lang = i18n.language === "ar" ? "ar" : "en-US"
        const addressResult = await searchAddressByPosition(
          position,
          undefined,
          lang
        )
        const egyAddressRs = addressResult.filter((add) =>
          isEgyptCountry(add.address.countryCode)
        )
        if (egyAddressRs.length > 0) {
          setResolvedAddress(egyAddressRs[0])
        }
        setIsResolvingAddress(false)
      }, 500)
    },
    [i18n.language]
  )

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (reverseGeocodeTimeout.current) {
        clearTimeout(reverseGeocodeTimeout.current)
      }
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current)
      }
    }
  }, [])

  // Search validation (copied from SearchView for behavior parity)
  const getIsValidSearchText = useCallback((text: string) => {
    const content = text.trim()
    if (isNumberStartAddress(content)) return false
    const validWords = content
      .split(/\s+/)
      .filter(
        (word) =>
          !isNumberStartAddress(word) &&
          !SHOULD_IGNORE_START_TEXT_ADDRESS.includes(word)
      )
    const result = validWords.join(" ")
    return result.length >= 4
  }, [])

  const onCheckAndStartSearching = useCallback(
    (text: string) => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current)
        searchTimeout.current = null
      }
      if (getIsValidSearchText(text)) {
        setIsValidSearchText(true)
        setIsSearchLoading(true)
        searchTimeout.current = setTimeout(async () => {
          const lang = i18n.language === "ar" ? "ar" : "en-US"
          const res = await searchAddress(text, undefined, lang)
          setSearchResults(res)
          setIsSearchLoading(false)
        }, 500)
      } else {
        setIsValidSearchText(false)
        setSearchResults([])
      }
    },
    [getIsValidSearchText, i18n.language]
  )

  const onSearchTextChange = useCallback(
    (text: string) => {
      setSearchText(text)
      onCheckAndStartSearching(text.trim())
    },
    [onCheckAndStartSearching]
  )

  // User picked a result from the list → collapse the panel and pan the map
  const onSearchItemPressed = useCallback(
    (item: MapLocationResult) => {
      // Collapse back to the map view (this also clears searchText)
      exitSearchMode()
      // Persist the picked address so the pill placeholder shows it
      setResolvedAddress(item)
      // We already know the address — suppress the reverse-geocode that
      // onRegionChangeComplete would otherwise trigger
      suppressNextGeocodeRef.current = true
      mapRef.current?.animateToRegion(
        {
          latitude: item.position.lat,
          longitude: item.position.lng,
          latitudeDelta: defaultLatitudeDelta,
          longitudeDelta: defaultLongitudeDelta,
        },
        700
      )
    },
    [exitSearchMode]
  )

  // Map region callbacks
  const handleRegionChange = useCallback(() => {
    setIsMapMoving(true)
    if (!suppressNextGeocodeRef.current) {
      setIsResolvingAddress(true)
    }
  }, [])

  const handleRegionChangeCompleted = useCallback(
    (region: Region, details: Details) => {
      setSelectedRegion(region)
      setIsMapMoving(false)

      // If the user dragged the pin, the search text is now stale → clear it
      if (details?.isGesture) {
        setSearchText("")
        setSearchResults([])
        setIsValidSearchText(false)
      }

      if (suppressNextGeocodeRef.current) {
        suppressNextGeocodeRef.current = false
        return
      }

      triggerReverseGeocode({
        lat: region.latitude,
        lng: region.longitude,
      })
    },
    [triggerReverseGeocode]
  )

  // My location FAB (bottom right)
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

  // Confirm flow
  const onConfirmAddress = useCallback(async () => {
    setAddressConfirming(true)
    const position: MapPosition | undefined = selectedRegion
      ? { lat: selectedRegion.latitude, lng: selectedRegion.longitude }
      : initPosition

    if (position) {
      const lang = i18n.language === "ar" ? "ar" : "en-US"
      const addressResult = await searchAddressByPosition(
        position,
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
  }, [
    selectedRegion,
    initPosition,
    onSelectedAddress,
    i18n.language,
    t,
  ])

  // X button has a 3-stage dismiss:
  //   1. Has search text            → clear the text (stay in search mode)
  //   2. Empty text, in search mode → exit search mode back to the map
  //   3. Empty text, not searching  → close the screen
  const onClearOrClose = useCallback(() => {
    if (searchText.length > 0) {
      setSearchText("")
      setSearchResults([])
      setIsValidSearchText(false)
      return
    }
    if (isSearchMode) {
      exitSearchMode()
      return
    }
    setSelectedRegion(null)
    setAddressConfirming(false)
    onClose?.()
  }, [searchText, isSearchMode, exitSearchMode, onClose])

  // "Use current location" from inside the search panel
  const onUseMyLocationFromSearch = useCallback(async () => {
    const rs = await getCurrentLocation()
    if (!rs) return
    // Collapse panel and animate map to the new spot
    exitSearchMode()
    mapRef.current?.animateToRegion(
      {
        latitude: rs.lat,
        longitude: rs.lng,
        latitudeDelta: defaultLatitudeDelta,
        longitudeDelta: defaultLongitudeDelta,
      },
      700
    )
  }, [getCurrentLocation, exitSearchMode])

  // Computed subtitle – short, one-line summary of what the pin is sitting on
  const subtitleText = useMemo(() => {
    if (!resolvedAddress) return ""
    const addr = resolvedAddress.address
    if (addr.houseNumber && addr.street) {
      return `${addr.houseNumber} ${addr.street}`
    }
    if (addr.street) return addr.street
    return addr.label || resolvedAddress.title || ""
  }, [resolvedAddress])

  // When the search field is idle and empty (not in search mode), show the
  // resolved address as a "realistic" placeholder so the user always sees
  // what they're about to confirm. In search mode, show the generic hint.
  // While the map is moving / reverse-geocoding, show "Detecting location…"
  // instead so the user gets immediate feedback.
  const searchPlaceholder = isSearchMode
    ? t("search_for_your_address")
    : isResolvingAddress
    ? t("detecting_location")
    : subtitleText || t("search_for_your_address")
  const placeholderColor = isResolvingAddress
    ? "#9A9A9A"
    : !isSearchMode && subtitleText
    ? "#1A1A1A"
    : "#9A9A9A"

  const renderSearchItem = useCallback(
    (info: ListRenderItemInfo<MapLocationResult>) => (
      <SearchResultItem item={info.item} onPress={onSearchItemPressed} />
    ),
    [onSearchItemPressed]
  )

  return (
    <DmView className="w-full flex-1 bg-white">
      <DmView className="w-full flex-1">
        {initPosition && (
          <>
            <MapView
              provider={PROVIDER_GOOGLE}
              className="flex-1"
              ref={mapRef}
              initialRegion={{
                latitude: initPosition.lat,
                longitude: initPosition.lng,
                latitudeDelta: defaultLatitudeDelta,
                longitudeDelta: defaultLongitudeDelta,
              }}
              onRegionChange={handleRegionChange}
              onRegionChangeComplete={handleRegionChangeCompleted}
              showsMyLocationButton={false}
              toolbarEnabled={false}
              showsUserLocation={false}
              showsBuildings={true}
              mapType="standard"
            />

            {/* Animated pin (ropacalapp-style bounce + shadow pulse) */}
            <DmView
              className="absolute left-0 top-0 right-0 bottom-0 items-center justify-center"
              pointerEvents="none"
            >
              <Animated.View
                style={{
                  alignItems: "center",
                  marginBottom: 34,
                }}
              >
                <Animated.View
                  style={{
                    transform: [{ translateY: pinTranslateY }],
                  }}
                >
                  <MapMarkerIcon width={28} height={36} />
                </Animated.View>
                <Animated.View
                  style={{
                    width: 10,
                    height: 4,
                    borderRadius: 5,
                    backgroundColor: "rgba(0,0,0,0.35)",
                    marginTop: 2,
                    transform: [{ scale: shadowScale }],
                  }}
                />
              </Animated.View>
            </DmView>

            {/* My location FAB (hidden while searching) */}
            {!isSearchMode && (
              <DropShadow
                className="absolute right-[16] bottom-[46] w-[44] h-[44] rounded-full"
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
            )}
          </>
        )}
      </DmView>

      {/* Confirm button (hidden while searching) */}
      {!isSearchMode && (
        <DmView
          className="w-full px-[16] pt-[40]"
          style={{ paddingBottom: Math.max(insets.bottom + 10, 30) }}
        >
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
      )}

      {/*
       * Unified search surface.
       * Collapsed → floating rounded pill over the map.
       * Expanded  → edge-to-edge full-screen panel that covers the map AND
       *             the confirm button (confirm is conditionally unmounted).
       * Transition is driven by LayoutAnimation.
       */}
      {initPosition && (
        <DmView
          className={
            isSearchMode
              ? "absolute left-0 right-0 top-0 bottom-0 bg-white"
              : "absolute left-[16] right-[16]"
          }
          style={
            isSearchMode
              ? { paddingTop: insets.top }
              : { top: insets.top + 12 }
          }
        >
          <DropShadow
            style={
              isSearchMode
                ? [
                    styles.searchHeaderShadow,
                    isAndroid && styles.searchHeaderShadowAndroid,
                  ]
                : [
                    styles.searchShadow,
                    isAndroid && styles.searchShadowAndroid,
                  ]
            }
          >
            <DmView
              className={
                isSearchMode
                  ? "w-full flex-row items-center bg-white px-[16] h-[56]"
                  : `w-full flex-row items-center px-[12] h-[48] rounded-[12] ${
                      isResolvingAddress ? "bg-grey38" : "bg-white"
                    }`
              }
            >
              <DmView className="mr-[4]">
                <SearchIcon width={18} height={18} />
              </DmView>
              <DmView className="flex-1">
                <DmInput
                  isAnimText={false}
                  className="h-[48] bg-transparent border-0 px-[8]"
                  inputClassName="text-14 leading-[19px] font-custom400"
                  value={searchText}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={placeholderColor}
                  onChangeText={onSearchTextChange}
                  onFocus={enterSearchMode}
                />
              </DmView>
              <DmView
                onPress={onClearOrClose}
                className="w-[32] h-[32] items-center justify-center"
              >
                <CloseIcon width={12} height={12} />
              </DmView>
            </DmView>
          </DropShadow>

          {/* Results / empty state / "use current location" — only when expanded */}
          {isSearchMode && (
            <DmView className="flex-1 w-full bg-white">
              <DmView className="border-b-1 border-b-grey8" />
              {searchText.length > 0 ? (
                isSearchLoading ||
                (!isValidSearchText && searchResults.length === 0) ? (
                  <DmView className="py-[20] items-center justify-center">
                    <ActivityIndicator color={colors.red} />
                  </DmView>
                ) : searchResults.length > 0 ? (
                  <FlatList
                    data={searchResults}
                    renderItem={renderSearchItem}
                    keyboardShouldPersistTaps="handled"
                  />
                ) : (
                  <DmView className="flex-1 items-center justify-center pt-[18]">
                    <DmText className="text-14 leading-[18px] font-custom400 text-red">
                      {t("no_address_found")}
                    </DmText>
                  </DmView>
                )
              ) : (
                <DmView onPress={onUseMyLocationFromSearch}>
                  <DmView
                    className="py-[20] flex-row items-center border-b-1 border-b-grey8"
                    style={{ marginEnd: 16, paddingStart: 16 }}
                  >
                    <LocationIcon />
                    <DmText
                      className="text-15 leading-[19px] font-custom500 flex-1"
                      style={{ marginStart: 10 }}
                    >
                      {t("use_current_location")}
                    </DmText>
                  </DmView>
                </DmView>
              )}
            </DmView>
          )}
        </DmView>
      )}
    </DmView>
  )
}

export default MapPickerWithSearchView
