import { DmInput, DmView } from "@tappler/shared/src/components/UI"
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
import MapMarkerIcon from "@tappler/shared/src/assets/icons/map-pin.svg"
import { MAP_PIN_SIZE } from "@tappler/shared/src/components/MapPinMarker"
import SearchIcon from "assets/icons/search-black.svg"
import LocationRedIcon from "assets/icons/location-red.svg"
import LocationIcon from "assets/icons/location.svg"

import { useSafeAreaInsets } from "react-native-safe-area-context"
import { MapLocationResult, MapPosition } from "services/map-types"
import styles from "../styles"
import { ActivityIndicator, Alert, Animated, Easing, Keyboard, LayoutAnimation, ListRenderItemInfo, Platform, UIManager, StyleSheet } from "react-native"
import useLocation from "@tappler/shared/src/hooks/useLocation"

import {
  searchAddress,
  searchAddressByPosition,
} from "services/here-maps-api"
import { isEgyptCountry } from "@tappler/shared/src/helpers/helpers"
import { SHOULD_IGNORE_START_TEXT_ADDRESS } from "utils/constants"
import colors from "@tappler/shared/src/styles/colors"
import { AppFlatList } from "components/scroll"
import { Text, Button, a, px } from "@tappler/shared/src/ds"
import { mapPickerWithSearchViewStyles } from "./styles"

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
      style={[a.py_14, a.flex_row, a.items_center, a.border_b_1, mapPickerWithSearchViewStyles.row, { marginEnd: 16, paddingStart: 16 }]}
    >
      <LocationRedIcon />
      <Text
        size={13}
        leading="loose"
        style={[a.flex_1, { marginStart: 12 }]}
      >
        {props.item.title}
      </Text>
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
    <DmView style={[a.w_full, a.flex_1, mapPickerWithSearchViewStyles.container]}>
      <DmView style={[a.w_full, a.flex_1]}>
        {initPosition && (
          <>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={a.flex_1}
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
              style={[
                StyleSheet.absoluteFill,
                a.items_center,
                a.justify_center,
              ]}
              pointerEvents="none"
            >
              <Animated.View
                style={{
                  alignItems: "center",
                  // Puts the pin's tip on the map centre (2pt above it,
                  // where it has always sat): this column (pin + 2 + 4
                  // shadow) is centred, then lifted by half this margin.
                  marginBottom: MAP_PIN_SIZE.height - 2,
                }}
              >
                <Animated.View
                  style={{
                    transform: [{ translateY: pinTranslateY }],
                  }}
                >
                  <MapMarkerIcon
                    width={MAP_PIN_SIZE.width}
                    height={MAP_PIN_SIZE.height}
                  />
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
                style={[a.absolute, mapPickerWithSearchViewStyles.shadow, 
                  styles.myLocationShadow,
                  isAndroid && styles.myLocationShadowAndroid,
                ]}
              >
                <DmView
                  onPress={onGoToMyLocation}
                  style={[
                    a.w_full,
                    a.h_full,
                    mapPickerWithSearchViewStyles.iconWrap,
                    a.items_center,
                    a.justify_center,
                  ]}
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
          style={[a.w_full, a.px_16, a.pt_40, { paddingBottom: Math.max(insets.bottom + 10, 30) }]}
        >
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
          style={
            [isSearchMode ? mapPickerWithSearchViewStyles.boxSearchMode : mapPickerWithSearchViewStyles.boxNotSearchMode, isSearchMode
              ? { paddingTop: insets.top }
              : { top: insets.top + 12 }]
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
              style={isSearchMode ? mapPickerWithSearchViewStyles.rowSearchMode : [mapPickerWithSearchViewStyles.rowNotSearchMode, isResolvingAddress ? mapPickerWithSearchViewStyles.rowNotSearchModeResolvingAddress : mapPickerWithSearchViewStyles.container]}
            >
              <DmView style={a.mr_4}>
                <SearchIcon width={18} height={18} />
              </DmView>
              <DmView style={a.flex_1}>
                <DmInput
                  isAnimText={false}
                  height={48}
                  containerStyle={[
                    mapPickerWithSearchViewStyles.dmInputContainer,
                    a.border_b_0,
                    a.px_8,
                  ]}
                  inputType={{ size: 14, weight: "regular", arabicLeading: px(19) }}
                  value={searchText}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={placeholderColor}
                  onChangeText={onSearchTextChange}
                  onFocus={enterSearchMode}
                />
              </DmView>
              <DmView
                onPress={onClearOrClose}
                style={[
                  mapPickerWithSearchViewStyles.iconWrap2,
                  a.items_center,
                  a.justify_center,
                ]}
              >
                <CloseIcon width={12} height={12} />
              </DmView>
            </DmView>
          </DropShadow>

          {/* Results / empty state / "use current location" — only when expanded */}
          {isSearchMode && (
            <DmView style={[a.flex_1, a.w_full, mapPickerWithSearchViewStyles.container]}>
              <DmView style={[a.border_b_1, mapPickerWithSearchViewStyles.row]} />
              {searchText.length > 0 ? (
                isSearchLoading ||
                (!isValidSearchText && searchResults.length === 0) ? (
                  <DmView style={[a.py_20, a.items_center, a.justify_center]}>
                    <ActivityIndicator color={colors.red} />
                  </DmView>
                ) : searchResults.length > 0 ? (
                  <AppFlatList
                    data={searchResults}
                    renderItem={renderSearchItem}
                    keyboardShouldPersistTaps="handled"
                  />
                ) : (
                  <DmView style={[a.flex_1, a.items_center, a.justify_center, a.pt_18]}>
                    <Text size={14} color="brand">
                      {t("no_address_found")}
                    </Text>
                  </DmView>
                )
              ) : (
                <DmView onPress={onUseMyLocationFromSearch}>
                  <DmView
                    style={[a.py_20, a.flex_row, a.items_center, a.border_b_1, mapPickerWithSearchViewStyles.row, { marginEnd: 16, paddingStart: 16 }]}
                  >
                    <LocationIcon />
                    <Text
                      size={15}
                      weight="medium"
                      leading="tight"
                      style={[a.flex_1, { marginStart: 10 }]}
                    >
                      {t("use_current_location")}
                    </Text>
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
