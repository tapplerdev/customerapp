import React, { useCallback, useEffect, useRef, useState } from "react"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { useTranslation } from "react-i18next"

import { api } from "services/api"
import { useTypedSelector } from "store"
import { addressEventBus } from "@tappler/shared/src/events/AddressBus"
import { RootStackParamList, AddressInfo } from "navigation/types"
import { ServiceCategoryType, ServiceType } from "types/cms"
import AddressSelectionModal from "components/AddressSelectionModal"

type Nav = NativeStackNavigationProp<RootStackParamList>

/**
 * Owns the "pick a service address for a category, then go to results" flow:
 * the AddressSelectionModal, the proceed-to-results navigation, and the
 * listeners that catch an address coming back from PickAddress /
 * MySavedAddresses.
 *
 * Shared by SubCategoriesScreen (tap a sub in the list) and CategoriesScreen
 * (tap a sub-category search result) so the sheet opens in place instead of
 * hopping through the parent category screen first.
 */
export const useServiceAddressFlow = () => {
  const navigation = useNavigation<Nav>()
  const { i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const prefetchService = api.usePrefetch("getServiceById")
  const guestLocation = useTypedSelector((state) => state.auth.guestLocation)

  const [isAddressModalVisible, setAddressModalVisible] = useState(false)
  const [selectedCategory, setSelectedCategory] =
    useState<ServiceCategoryType | null>(null)
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null)

  const goToResults = useCallback(
    (
      category: ServiceCategoryType,
      service: ServiceType,
      address: AddressInfo
    ) => {
      navigation.navigate("SearchAnimationScreen", {
        nextParams: {
          categoryId: category.id,
          categoryName: isAr ? category.nameAr : category.nameEn,
          serviceId: service.id,
          address,
        },
      })
    },
    [isAr, navigation]
  )

  // Open the address flow for a specific category (+ its parent service).
  const openAddressFor = useCallback(
    (category: ServiceCategoryType, service: ServiceType) => {
      // Warm the service payload (questions/placeOfService) while the customer
      // picks an address — the question flow launches from it.
      prefetchService(service.id, { ifOlderThan: 120 })

      // Remote/fixed-only categories: the address never affects matching or
      // submission, so skip the modal and silently carry the last-used address.
      // No saved address yet → fall through to the modal once.
      const places = category.placeOfService
      const addressInert =
        !!places?.length &&
        places.every((p) => p === "remoteOrOnline" || p === "fixedLocations")
      if (addressInert && guestLocation?.address) {
        goToResults(category, service, guestLocation.address)
        return
      }

      setSelectedCategory(category)
      setSelectedService(service)
      setAddressModalVisible(true)
    },
    [prefetchService, guestLocation, goToResults]
  )

  const closeAddressModal = useCallback(() => setAddressModalVisible(false), [])

  const handleSelectMyAddress = useCallback(
    (address: AddressInfo) => {
      setAddressModalVisible(false)
      if (selectedCategory && selectedService) {
        goToResults(selectedCategory, selectedService, address)
      }
    },
    [selectedCategory, selectedService, goToResults]
  )

  const handleSelectNewLocation = useCallback(() => {
    setAddressModalVisible(false)
    navigation.navigate("PickAddressScreen")
  }, [navigation])

  const handleViewAllAddresses = useCallback(() => {
    setAddressModalVisible(false)
    navigation.navigate("MySavedAddressesScreen", { selectionMode: true })
  }, [navigation])

  // Catch an address picked from PickAddressScreen / selected from
  // MySavedAddressesScreen and proceed to results for the pending category.
  const selectedCategoryRef = useRef(selectedCategory)
  selectedCategoryRef.current = selectedCategory
  const selectedServiceRef = useRef(selectedService)
  selectedServiceRef.current = selectedService

  useEffect(() => {
    const handler = (address: AddressInfo) => {
      const cat = selectedCategoryRef.current
      const svc = selectedServiceRef.current
      if (!cat || !svc) return
      setTimeout(() => {
        // Only act when the hosting screen is focused — it stays mounted beneath
        // the results screen, and without this an address change made THERE
        // would re-trigger the flow from here.
        if (!navigation.isFocused()) return
        goToResults(cat, svc, address)
      }, 600)
    }
    addressEventBus.on("address:pick", handler)
    addressEventBus.on("address:select", handler)
    return () => {
      addressEventBus.off("address:pick", handler)
      addressEventBus.off("address:select", handler)
    }
  }, [navigation, goToResults])

  const addressModal = (
    <AddressSelectionModal
      isVisible={isAddressModalVisible}
      onClose={closeAddressModal}
      onSelectAddress={handleSelectMyAddress}
      onSelectNewLocation={handleSelectNewLocation}
      onViewAllAddresses={handleViewAllAddresses}
    />
  )

  return { openAddressFor, addressModal }
}
