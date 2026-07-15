import React, { useCallback, useEffect, useRef, useState } from "react"
import { FlatList } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { api } from "services/api"
import { useTypedSelector } from "store"
import { RootStackScreenProps, AddressInfo } from "navigation/types"
import { ServiceCategoryType } from "types/cms"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import AddressSelectionModal from "components/AddressSelectionModal"
import { addressEventBus } from "@tappler/shared/src/events/AddressBus"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import ChevronRightIcon from "assets/icons/chevron-right.svg"

type Props = RootStackScreenProps<"SubCategoriesScreen">

const SubCategoriesScreen: React.FC<Props> = ({ route, navigation }) => {
  const { service } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const [isAddressModalVisible, setAddressModalVisible] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategoryType | null>(null)

  const handleGoBack = () => {
    navigation.goBack()
  }

  const prefetchService = api.usePrefetch("getServiceById")

  const guestLocation = useTypedSelector((state) => state.auth.guestLocation)

  const handleSubCategoryPress = (category: ServiceCategoryType) => {
    // Warm the service payload (questions/placeOfService) while the customer
    // picks an address — ProsListingScreen's question flow launches from it.
    prefetchService(service.id, { ifOlderThan: 120 })

    // Remote/fixed-only categories: the address never affects matching or
    // submission (serveability for those modes is address-independent in the
    // backend guard + listing filter), so skip the modal and silently carry
    // the last-used address — exactly what the modal's top row would pick.
    // No saved address yet → fall through to the modal once.
    const places = category.placeOfService
    const addressInert =
      !!places?.length &&
      places.every((p) => p === "remoteOrOnline" || p === "fixedLocations")
    if (addressInert && guestLocation?.address) {
      navigation.navigate("SearchAnimationScreen", {
        nextParams: {
          categoryId: category.id,
          categoryName: isAr ? category.nameAr : category.nameEn,
          serviceId: service.id,
          address: guestLocation.address,
        },
      })
      return
    }

    setSelectedCategory(category)
    setAddressModalVisible(true)
  }

  // Subcategory hit from the categories search: proceed straight into the
  // address selection for it, as if it was tapped in this list.
  useEffect(() => {
    const autoId = route.params.autoSelectCategoryId
    if (!autoId) return
    const category = service.categories?.find((c) => c.id === autoId)
    if (!category) return
    // Let the screen's push transition settle before presenting the modal
    const timer = setTimeout(() => handleSubCategoryPress(category), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCloseAddressModal = () => {
    setAddressModalVisible(false)
  }

  // After address is selected, go straight to SearchAnimationScreen (no placeOfService)
  const proceedWithAddress = useCallback((address: AddressInfo) => {
    if (!selectedCategory) return

    navigation.navigate("SearchAnimationScreen", {
      nextParams: {
        categoryId: selectedCategory.id,
        categoryName: isAr ? selectedCategory.nameAr : selectedCategory.nameEn,
        serviceId: service.id,
        address,
      },
    })
  }, [selectedCategory, isAr, navigation, service.id])

  const handleSelectMyAddress = (address: AddressInfo) => {
    setAddressModalVisible(false)
    proceedWithAddress(address)
  }

  const handleSelectNewLocation = () => {
    setAddressModalVisible(false)
    navigation.navigate("PickAddressScreen")
  }

  const handleViewAllAddresses = () => {
    setAddressModalVisible(false)
    navigation.navigate("MySavedAddressesScreen", { selectionMode: true })
  }

  // Listen for address picked from PickAddressScreen or selected from MySavedAddressesScreen
  const selectedCategoryRef = useRef(selectedCategory)
  selectedCategoryRef.current = selectedCategory

  useEffect(() => {
    const handler = (address: AddressInfo) => {
      const cat = selectedCategoryRef.current
      if (!cat) return

      setTimeout(() => {
        // Only act when this screen is focused — it stays mounted beneath the
        // results screen, and without this an address change made THERE would
        // re-trigger the search animation from here.
        if (!navigation.isFocused()) return
        navigation.navigate("SearchAnimationScreen", {
          nextParams: {
            categoryId: cat.id,
            categoryName: isAr ? cat.nameAr : cat.nameEn,
            serviceId: service.id,
            address,
          },
        })
      }, 600)
    }
    addressEventBus.on("address:pick", handler)
    addressEventBus.on("address:select", handler)
    return () => {
      addressEventBus.off("address:pick", handler)
      addressEventBus.off("address:select", handler)
    }
  }, [navigation, isAr, service.id])

  const renderItem = ({ item }: { item: ServiceCategoryType }) => {
    const name = isAr ? item.nameAr : item.nameEn
    return (
      <DmView onPress={() => handleSubCategoryPress(item)}>
        <DmView className="flex-row items-center justify-between px-[19] py-[17]">
          <DmText className="flex-1 text-12 font-custom500 text-black leading-[15]">
            {name}
          </DmText>
          <ChevronRightIcon
            width={16}
            height={16}
            color={colors.black}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView className="mr-[16] border-b-1 border-grey8" />
      </DmView>
    )
  }

  const serviceName = isAr ? service.nameAr : service.nameEn

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <DmView className="flex-row items-center px-[20] pt-[17] pb-[20]">
        <DmView
          className="w-[32] h-[32] items-center justify-center"
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={handleGoBack}
        >
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView className="flex-1 items-center">
          <DmText className="text-16 font-custom600 text-black leading-[19]">
            {serviceName}
          </DmText>
        </DmView>
        <DmView className="w-[32]" />
      </DmView>
      <DmView className="h-[1] bg-grey4" />

      {/* Subcategories list */}
      <FlatList
        data={service.categories}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
      />

      <AddressSelectionModal
        isVisible={isAddressModalVisible}
        onClose={handleCloseAddressModal}
        onSelectAddress={handleSelectMyAddress}
        onSelectNewLocation={handleSelectNewLocation}
        onViewAllAddresses={handleViewAllAddresses}
      />
    </SafeAreaView>
  )
}

export default SubCategoriesScreen
