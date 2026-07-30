import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, FlatList, Platform, StyleSheet, TextInput } from "react-native"
import Modal from "react-native-modal"
import NativePushBackSheet, {
  useFullSheetHeight,
} from "@tappler/shared/src/components/NativePushBackSheet/NativePushBackSheet"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import { AddressInfo } from "navigation/types"
import { useGetServicesQuery } from "services/api"
import { ServiceCategoryType } from "types/cms"

import SearchIcon from "assets/icons/search-black.svg"
import LocationRedIcon from "assets/icons/location-red.svg"
import CloseIcon from "assets/icons/close.svg"
import SkeletonLoader from "components/SkeletonLoader/SkeletonLoader"

type FlatCategory = ServiceCategoryType & {
  serviceName: string
  serviceNameAr: string
  parentServiceId: number
}

interface SearchLocationModalProps {
  isVisible: boolean
  currentCategoryName: string
  currentAddress?: AddressInfo
  onSelectService: (categoryId: number, categoryName: string, serviceId: number) => void
  onChangeLocation: () => void
  onClose: () => void
}

const SearchLocationModal: React.FC<SearchLocationModalProps> = ({
  isVisible,
  currentCategoryName,
  currentAddress,
  onSelectService,
  onChangeLocation,
  onClose,
}) => {
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const inputRef = useRef<TextInput>(null)


  const [searchText, setSearchText] = useState(currentCategoryName)
  const [debouncedSearch, setDebouncedSearch] = useState(currentCategoryName)

  const { data: servicesData, isFetching } = useGetServicesQuery()

  useEffect(() => {
    if (isVisible) {
      setSearchText(currentCategoryName)
      setDebouncedSearch(currentCategoryName)
      setTimeout(() => inputRef.current?.focus(), 400)
    }
  }, [isVisible, currentCategoryName])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300)
    return () => clearTimeout(timer)
  }, [searchText])

  // Flatten all categories into searchable list
  const allCategories = useMemo<FlatCategory[]>(() => {
    if (!servicesData?.data) return []
    return servicesData.data.flatMap((service) =>
      (service.categories || []).map((cat) => ({
        ...cat,
        serviceName: service.nameEn,
        serviceNameAr: service.nameAr,
        parentServiceId: service.id,
      }))
    )
  }, [servicesData])

  // Filter by search text — includes the CMS `keywords` field so e.g. "carpet"
  // matches categories whose names don't contain it (same behavior as proapp).
  const filteredCategories = useMemo(() => {
    if (!debouncedSearch.trim()) return allCategories
    const query = debouncedSearch.toLowerCase()
    return allCategories.filter(
      (c) =>
        c.nameEn.toLowerCase().includes(query) ||
        c.nameAr.includes(query) ||
        c.serviceName.toLowerCase().includes(query) ||
        c.serviceNameAr.includes(query) ||
        (c.keywords || "").toLowerCase().includes(query)
    )
  }, [allCategories, debouncedSearch])

  // Fade the results in whenever the (debounced) query settles or data arrives —
  // proapp's search transition mechanic (300ms opacity).
  const listFade = useRef(new Animated.Value(0)).current
  const hasData = allCategories.length > 0
  useEffect(() => {
    listFade.setValue(0)
    Animated.timing(listFade, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [debouncedSearch, hasData])

  const handleSelectCategory = (cat: FlatCategory) => {
    const name = isAr ? cat.nameAr : cat.nameEn
    onSelectService(cat.id, name, cat.parentServiceId)
    onClose()
  }

  const handleLocationPress = () => {
    onClose()
    onChangeLocation()
  }

  const handleClose = () => {
    onClose()
  }

  const handleDismiss = useCallback(() => {
    onClose()
  }, [onClose])

  const addressParts = [currentAddress?.address, currentAddress?.city || currentAddress?.governorate].filter(Boolean)
  const locationDisplay = addressParts.join(" • ") || ""

  const renderItem = ({ item }: { item: FlatCategory }) => {
    const name = isAr ? item.nameAr : item.nameEn
    const parentName = isAr ? item.serviceNameAr : item.serviceName
    return (
      <>
        <DmView
          onPress={() => handleSelectCategory(item)}
          className="px-[24] py-[14]"
        >
          <DmText className="text-14 leading-[18px] font-custom500 text-black">
            {name}
          </DmText>
          <DmText className="text-11 leading-[14px] font-custom400 text-grey3 mt-[2]">
            {parentName}
          </DmText>
        </DmView>
        <DmView className="ml-[24] h-[0.5] bg-grey5" />
      </>
    )
  }

  // 92% of the screen was what the gorhom snapPoint asked for; useFullSheetHeight
  // is the same intent expressed off the safe area, so the top edge lands below
  // the status bar on every device instead of at a fixed fraction.
  //
  // No pushBackScale override: this is a NEAR-FULL sheet, and the native 0.92
  // default is what that size was tuned for. BOTTOM_SHEET_PUSH_BACK_SCALE is
  // for the short ones.
  const fullSheetHeight = useFullSheetHeight()

  const content = (
    <DmView
      className="flex-1 bg-white"
      style={{ borderTopLeftRadius: 10, borderTopRightRadius: 10, overflow: "hidden" }}
    >
      {/* Header */}
      <DmView className="flex-row items-center justify-between px-[20] pt-[16] pb-[12]">
        <DmView onPress={handleClose} hitSlop={HIT_SLOP_DEFAULT}>
          <DmText className="text-14 leading-[18px] font-custom500 text-red">
            {t("cancel")}
          </DmText>
        </DmView>
        <DmView onPress={handleClose} hitSlop={HIT_SLOP_DEFAULT}>
          <DmText className="text-14 leading-[18px] font-custom600 text-red">
            {t("search")}
          </DmText>
        </DmView>
      </DmView>

      {/* Search inputs container with bottom shadow */}
      <DmView className="pb-[12] bg-white" style={modalStyles.inputsContainer}>
        {/* Service search input */}
        <DmView className="mx-[20] mb-[8] flex-row items-center bg-white rounded-full px-[14] h-[44]" style={modalStyles.inputBorder}>
          <SearchIcon width={16} height={16} />
          <TextInput
            ref={inputRef}
            value={searchText}
            onChangeText={setSearchText}
            placeholder={t("search_for_service")}
            placeholderTextColor={colors.grey3}
            selectTextOnFocus
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 14,
              color: colors.black,
              textAlign: isAr ? "right" : "left",
            }}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <DmView onPress={() => setSearchText("")} hitSlop={HIT_SLOP_DEFAULT}>
              <CloseIcon width={12} height={12} color={colors.grey3} />
            </DmView>
          )}
        </DmView>

        {/* Location field */}
        <DmView
          onPress={handleLocationPress}
          className="mx-[20] flex-row items-center bg-white rounded-full px-[14] h-[40]"
          style={modalStyles.inputBorder}
        >
          <LocationRedIcon width={16} height={16} />
          <DmText className="ml-[8] text-13 leading-[16px] font-custom400 text-black flex-1" numberOfLines={1}>
            {locationDisplay}
          </DmText>
        </DmView>
      </DmView>

      {/* Results — skeleton shimmer while the services payload first loads,
          then results fade in (mirrors proapp's search) */}
      {isFetching && !hasData ? (
        <DmView>
          {[64, 46, 72, 55, 38, 60].map((w, i) => (
            <DmView key={i} className="px-[24] py-[14] border-b-0.5 border-b-grey5">
              <SkeletonLoader width={`${w}%`} height={15} borderRadius={4} />
              <DmView className="mt-[6]">
                <SkeletonLoader width={`${Math.max(24, w - 25)}%`} height={11} borderRadius={4} />
              </DmView>
            </DmView>
          ))}
        </DmView>
      ) : (
        <Animated.View style={{ flex: 1, opacity: listFade }}>
          <FlatList
            data={filteredCategories}
            renderItem={renderItem}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      )}
    </DmView>
  )

  if (Platform.OS === "ios") {
    return (
      <NativePushBackSheet
        visible={isVisible}
        height={fullSheetHeight}
        onDismissed={handleDismiss}
      >
        {content}
      </NativePushBackSheet>
    )
  }

  // Android: react-native-modal, the same fallback every other native sheet in
  // this app uses. Replaces the gorhom BottomSheetModal (and with it the
  // FullWindowOverlay container gorhom needed to escape the RN root on iOS).
  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={handleDismiss}
      onSwipeComplete={handleDismiss}
      swipeDirection="down"
      className="m-0 justify-end"
      animationIn="slideInUp"
      animationOut="slideOutDown"
      hardwareAccelerated
      statusBarTranslucent
      backdropOpacity={0.5}
      backdropTransitionOutTiming={0}
      hideModalContentWhileAnimating
      avoidKeyboard
    >
      <DmView style={{ height: fullSheetHeight }}>{content}</DmView>
    </Modal>
  )
}

const modalStyles = StyleSheet.create({
  inputsContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 5,
  },
  inputBorder: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
})

export default SearchLocationModal
