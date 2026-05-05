/* eslint-disable no-extra-parens */
/* eslint-disable no-useless-escape */
import { DmInput, DmText, DmView } from "@tappler/shared/src/components/UI"
import React, { useCallback, useRef, useState } from "react"
import SearchIcon from "assets/icons/search-black.svg"
import CloseIcon from "assets/icons/close.svg"
import LocationIcon from "assets/icons/location.svg"
import LocationRedIcon from "assets/icons/location-red.svg"
import { useTranslation } from "react-i18next"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  ListRenderItemInfo,
} from "react-native"
import useLocation from "@tappler/shared/src/hooks/useLocation"
import { SHOULD_IGNORE_START_TEXT_ADDRESS } from "utils/constants"
import { searchAddress, searchAddressByPosition } from "services/here-maps-api"
import colors from "@tappler/shared/src/styles/colors"
import { MapLocationResult, MapPosition } from "services/map-types"
import { isEgyptCountry } from "@tappler/shared/src/helpers/helpers"

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
      className="mr-[16] border-b-1 border-b-grey8"
      onPress={() => props.onPress(props.item)}
    >
      <DmView className="pb-[16] pt-[24] pl-[16] w-full flex-row items-center justify-center">
        <LocationRedIcon />
        <DmText className="ml-[12] text-13 leading-[20px] font-custom400 flex-1">
          {props.item.title}
        </DmText>
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
    <KeyboardAvoidingView className="w-full flex-1 pt-[8]">
      <DmView className="w-full px-[16] flex-row items-center justify-center">
        <DmInput
          isAnimText={false}
          Icon={<SearchIcon />}
          iconContainerClassName="mr-[8]"
          className="h-[42] bg-grey38 border-0 flex-1"
          inputClassName="text-15 leading-[19px] font-custom400"
          value={searchText}
          placeholder={t("search_for_your_address")}
          onChangeText={onSearchTextChange}
        />
        <DmView className="py-[8] pl-[12]" onPress={onClose}>
          <CloseIcon width={14} height={14} />
        </DmView>
      </DmView>
      {searchText.length > 0 ? (
        <>
          {isLoading || (searchResults.length === 0 && !isValidSearchText) ? (
            <DmView className="mt-[14]">
              <ActivityIndicator color={colors.red} />
            </DmView>
          ) : (
            <FlatList
              data={searchResults}
              renderItem={renderListItem}
              keyExtractor={(item) => item.id || String(item.position?.lat) + String(item.position?.lng)}
              ListEmptyComponent={
                <DmView className="flex-1 items-center justify-center pt-[18]">
                  <DmText className="text-14 leading-[18px] font-custom400 text-red">
                    {t("no_address_found")}
                  </DmText>
                </DmView>
              }
            />
          )}
        </>
      ) : (
        <DmView
          className="w-full py-[20] px-[16] flex-row items-center justify-center"
          onPress={onUseMyLocation}
        >
          <LocationIcon />
          <DmText className="text-15 leading-[19px] font-custom500 flex-1 ml-[6]">
            {t("use_current_location")}
          </DmText>
        </DmView>
      )}
    </KeyboardAvoidingView>
  )
}

export default SearchView
