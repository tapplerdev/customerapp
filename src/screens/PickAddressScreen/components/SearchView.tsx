/* eslint-disable no-extra-parens */
/* eslint-disable no-useless-escape */
import { DmInput, DmView } from "@tappler/shared/src/components/UI"
import React, { useCallback, useRef, useState } from "react"
import SearchIcon from "assets/icons/search-black.svg"
import CloseIcon from "assets/icons/close.svg"
import LocationIcon from "assets/icons/location.svg"
import LocationRedIcon from "assets/icons/location-red.svg"
import { useTranslation } from "react-i18next"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ListRenderItemInfo,
} from "react-native"
import useLocation from "@tappler/shared/src/hooks/useLocation"
import { SHOULD_IGNORE_START_TEXT_ADDRESS } from "utils/constants"
import { searchAddress, searchAddressByPosition } from "services/here-maps-api"
import colors from "@tappler/shared/src/styles/colors"
import { MapLocationResult, MapPosition } from "services/map-types"
import { isEgyptCountry } from "@tappler/shared/src/helpers/helpers"
import { AppFlatList } from "components/scroll"
import { Text, a, px } from "@tappler/shared/src/ds"
import { searchViewStyles } from "./styles"

interface Props {
  onClose: () => void
  onLocationSelect: (
    position: MapPosition,
    address: MapLocationResult | undefined
  ) => void
}

const isNumberStartAddress = (address: string) => {
  return /^[0-9\/\-\_ ]+$/.test(address)
}

const ItemAddress = (props: {
  item: MapLocationResult
  onPress: (item: MapLocationResult) => void
}) => {
  return (
    <DmView
      style={[a.mr_16, a.border_b_1, searchViewStyles.container]}
      onPress={() => props.onPress(props.item)}
    >
      <DmView style={[a.pb_16, a.pt_24, a.pl_16, a.w_full, a.flex_row, a.items_center, a.justify_center]}>
        <LocationRedIcon />
        <Text size={13} leading="loose" style={[a.ml_12, a.flex_1]}>
          {props.item.title}
        </Text>
      </DmView>
    </DmView>
  )
}

const SearchView: React.FC<Props> = ({ onClose, onLocationSelect }) => {
  const [searchText, setSearchText] = useState("")
  const [isValidSearchText, setIsValidSearchText] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<MapLocationResult[]>([])
  const searchTextRef = useRef("")
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)

  const { t, i18n } = useTranslation()

  const onErrorGetCurrentLocation = useCallback((error: string) => {
    Alert.alert(error)
  }, [])
  const { getCurrentLocation } = useLocation(onErrorGetCurrentLocation)

  const onUseMyLocation = useCallback(async () => {
    const rs = await getCurrentLocation()
    if (rs) {
      const lang = i18n.language === "ar" ? "ar" : "en-US"
      const addressRs = await searchAddressByPosition(rs, undefined, lang)
      const egyAddressRs = addressRs.filter((add) =>
        isEgyptCountry(add.address.countryCode)
      )
      if (egyAddressRs.length > 0) {
        onLocationSelect(egyAddressRs[0].position, egyAddressRs[0])
      } else {
        Alert.alert(t("your_location_is_outside"))
      }
    }
  }, [onLocationSelect, i18n.language])

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
        setIsLoading(true)
        searchTimeout.current = setTimeout(async () => {
          const lang = i18n.language === "ar" ? "ar" : "en-US"
          const res = await searchAddress(text, undefined, lang)
          setSearchResults(res)
          setIsLoading(false)
        }, 500)
      } else {
        setIsValidSearchText(false)
      }
    },
    [getIsValidSearchText, i18n.language]
  )

  const onSearchTextChange = useCallback(
    (text: string) => {
      const trimText = text.trim()
      setSearchText(text)
      searchTextRef.current = text
      onCheckAndStartSearching(trimText)
    },
    [onCheckAndStartSearching]
  )

  const onItemPressed = useCallback(
    (item: MapLocationResult) => {
      onLocationSelect(item.position, item)
    },
    [onLocationSelect]
  )

  const renderListItem = useCallback(
    (info: ListRenderItemInfo<MapLocationResult>) => {
      return <ItemAddress item={info.item} onPress={onItemPressed} />
    },
    [onItemPressed]
  )

  return (
    <KeyboardAvoidingView style={[a.w_full, a.flex_1, a.pt_8]}>
      <DmView style={[a.w_full, a.px_16, a.flex_row, a.items_center, a.justify_center]}>
        <DmInput
          isAnimText={false}
          Icon={<SearchIcon />}
          iconContainerStyle={a.mr_8}
          height={42}
          containerStyle={[
            searchViewStyles.dmInputContainer,
            a.border_b_0,
            a.flex_1,
          ]}
          inputType={{ size: 15, weight: "regular", arabicLeading: px(19) }}
          value={searchText}
          placeholder={t("search_for_your_address")}
          onChangeText={onSearchTextChange}
        />
        <DmView style={[a.py_8, a.pl_12]} onPress={onClose}>
          <CloseIcon width={14} height={14} />
        </DmView>
      </DmView>
      {searchText.length > 0 ? (
        <>
          {isLoading || (searchResults.length === 0 && !isValidSearchText) ? (
            <DmView style={a.mt_14}>
              <ActivityIndicator color={colors.red} />
            </DmView>
          ) : (
            <AppFlatList
              data={searchResults}
              renderItem={renderListItem}
              keyExtractor={(item) => item.id || String(item.position?.lat) + String(item.position?.lng)}
              ListEmptyComponent={
                <DmView style={[a.flex_1, a.items_center, a.justify_center, a.pt_18]}>
                  <Text size={14} color="brand">
                    {t("no_address_found")}
                  </Text>
                </DmView>
              }
            />
          )}
        </>
      ) : (
        <DmView
          style={[
            a.w_full,
            a.py_20,
            a.px_16,
            a.flex_row,
            a.items_center,
            a.justify_center,
          ]}
          onPress={onUseMyLocation}
        >
          <LocationIcon />
          <Text size={15} weight="medium" leading="tight" style={[a.flex_1, a.ml_6]}>
            {t("use_current_location")}
          </Text>
        </DmView>
      )}
    </KeyboardAvoidingView>
  )
}

export default SearchView
