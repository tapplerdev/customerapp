import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, View } from "react-native"
import { FlashList } from "@shopify/flash-list"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import {
  TourGuideProvider,
  useTourGuideController,
} from "rn-tourguide"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { useLazyGetProsForCategoryQuery, useLazyGetProProfileQuery, useGetServiceByIdQuery, useLazyGetServiceByIdQuery } from "services/api"
import { useTypedSelector } from "store"
import { ProType } from "types/pro"
import { QuestionAnswerType } from "types/job"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"

import ProCard from "./components/ProCard"
import TooltipComponent from "./components/TooltipComponent"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"
import QuestionBottomSheet from "components/QuestionBottomSheet/QuestionBottomSheet"
import AllQuestionsModal from "components/AllQuestionsModal/AllQuestionsModal"
import FiltersModal, { FilterValues } from "components/FiltersModal/FiltersModal"
import SearchLocationModal from "components/SearchLocationModal/SearchLocationModal"
import AddressSelectionModal from "components/AddressSelectionModal"
import { addressEventBus } from "@tappler/shared/src/events/AddressBus"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import SearchIcon from "assets/icons/search-black.svg"
import FiltersIcon from "assets/icons/filters.svg"
import JobDetailsIcon from "assets/icons/job-details.svg"
import FilterSlidersIcon from "assets/icons/filter-sliders.svg"
import ErrorModal from "components/ErrorModal"
import styles from "./styles"

type Props = RootStackScreenProps<"ProsListingScreen">

const ProsListingContent: React.FC<Props> = ({ route, navigation }) => {
  const { placeOfService: initialPlaceOfService } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const { dontShowBestDealTooltip } = useTypedSelector((store) => store.auth)
  const insets = useSafeAreaInsets()

  // Mutable local state — initialized from route params, updatable when customer changes service/address
  const [categoryId, setCategoryId] = useState(route.params.categoryId)
  const [categoryName, setCategoryName] = useState(route.params.categoryName)
  const [serviceId, setServiceId] = useState(route.params.serviceId)
  const [address, setAddress] = useState(route.params.address)

  const [selectedPros, setSelectedPros] = useState<number[]>([])
  const [getPros, { data, isLoading, isError }] = useLazyGetProsForCategoryQuery()
  const [getProProfile] = useLazyGetProProfileQuery()
  const [getServiceData] = useLazyGetServiceByIdQuery()

  const { canStart, start } = useTourGuideController()

  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isErrorModalVisible, setErrorModalVisible] = useState(false)
  const [isRefetching, setIsRefetching] = useState(false)

  // Search modal state
  const [isSearchModalVisible, setSearchModalVisible] = useState(false)
  const [isAddressModalVisible, setAddressModalVisible] = useState(false)

  // Filters state
  const [isFiltersVisible, setFiltersVisible] = useState(false)
  const [currentFilters, setCurrentFilters] = useState<FilterValues>({})

  // Question flow state
  const [isSheetVisible, setSheetVisible] = useState(!initialPlaceOfService)
  const [isAllQuestionsVisible, setAllQuestionsVisible] = useState(false)
  const [currentPlaceOfService, setCurrentPlaceOfService] = useState<string | undefined>(initialPlaceOfService)
  const [allAnswers, setAllAnswers] = useState<QuestionAnswerType[]>([])
  const [dataAnswers, setDataAnswers] = useState<QuestionAnswerType[]>([])

  // Fetch service data to get placeOfService options for the question flow
  const { data: serviceData } = useGetServiceByIdQuery(serviceId)
  const category = serviceData?.categories?.find((c) => c.id === categoryId)
  const placeOfServiceOptions = category?.placeOfService || []
  const customerQuestions = category?.customerQuestions || []

  // Compute answered count for the banner
  const allCustomerQuestions = customerQuestions.filter((q) => q.assignee === "customer")
  const totalQuestions = allCustomerQuestions.length + (placeOfServiceOptions.length > 1 ? 1 : 0)
  const answeredCount = useMemo(() => {
    let count = currentPlaceOfService ? 1 : 0
    allCustomerQuestions.forEach((q) => {
      const ans = allAnswers.find((a) => a.questionId === q.id)
      if (!ans) return
      if (q.type === "shortAnswer" || q.type === "paragraph") { if (ans.answer) count++ }
      else if (q.type === "oneChoice") { if (ans.optionId) count++ }
      else if (q.type === "multipleChoice") { if (ans.optionsIds?.length) count++ }
      else if (q.type === "dateTime") { if (ans.date || ans.startDate) count++ }
    })
    return count
  }, [allAnswers, allCustomerQuestions, currentPlaceOfService])

  // Continue button slide animation
  const hasSelection = selectedPros.length > 0
  const [showContinue, setShowContinue] = useState(false)
  const slideAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (hasSelection) {
      setShowContinue(true)
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start()
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setShowContinue(false))
    }
  }, [hasSelection])

  // Initial fetch (already done by SearchAnimationScreen, RTK Query cache serves it)
  useEffect(() => {
    const skipAddress =
      initialPlaceOfService === "remoteOrOnline" || initialPlaceOfService === "fixedLocations"
    const customerAddress =
      skipAddress ? undefined : address?.coords ? { latitude: address.coords.lat, longitude: address.coords.lon } : undefined

    getPros({ categoryId, placeOfService: initialPlaceOfService, customerAddress }, true)
  }, [categoryId])

  // Shared refetch logic — merges question filters + pro-level filters
  const doRefetch = useCallback(
    (opts: {
      pos?: string
      filterOptionIds?: number[]
      filters?: FilterValues
    }) => {
      const placeOfService = opts.pos ?? currentPlaceOfService
      const skipAddress = !placeOfService || placeOfService === "remoteOrOnline" || placeOfService === "fixedLocations"
      const customerAddress = skipAddress
        ? undefined
        : address?.coords
          ? { latitude: address.coords.lat, longitude: address.coords.lon }
          : undefined

      const f = opts.filters ?? currentFilters

      setIsRefetching(true)
      getPros(
        {
          categoryId,
          placeOfService,
          customerAddress,
          filterOptionsIds: opts.filterOptionIds?.length ? opts.filterOptionIds : undefined,
          proType: f.proType,
          distanceKm: f.distanceKm,
          minRating: f.minRating,
          maxResponseTimeHours: f.maxResponseTimeHours,
          creditCardPayment: f.creditCardPayment,
        },
        true
      )
        .unwrap()
        .finally(() => setIsRefetching(false))
    },
    [categoryId, address, getPros, currentPlaceOfService, currentFilters]
  )

  const refetchWithFilters = useCallback(
    (result: { placeOfService?: string; filterOptionIds: number[]; filtersChanged: boolean }) => {
      if (!result.filtersChanged) return
      doRefetch({ pos: result.placeOfService, filterOptionIds: result.filterOptionIds })
    },
    [doRefetch]
  )

  // Handle step-by-step sheet dismiss
  const handleSheetDismiss = useCallback(
    (result: {
      placeOfService?: string
      filterOptionIds: number[]
      dataAnswers: QuestionAnswerType[]
      allAnswers: QuestionAnswerType[]
      filtersChanged: boolean
    }) => {
      setSheetVisible(false)
      setCurrentPlaceOfService(result.placeOfService)
      setDataAnswers(result.dataAnswers)
      setAllAnswers(result.allAnswers)
      refetchWithFilters(result)
    },
    [refetchWithFilters]
  )

  // Handle all-questions modal dismiss
  const handleAllQuestionsDismiss = useCallback(
    (result: {
      placeOfService?: string
      filterOptionIds: number[]
      dataAnswers: QuestionAnswerType[]
      allAnswers: QuestionAnswerType[]
      filtersChanged: boolean
    }) => {
      setAllQuestionsVisible(false)
      setCurrentPlaceOfService(result.placeOfService)
      setDataAnswers(result.dataAnswers)
      setAllAnswers(result.allAnswers)
      refetchWithFilters(result)
    },
    [refetchWithFilters]
  )

  // Handle pro-level filters dismiss
  const handleFiltersDismiss = useCallback(
    (filters: FilterValues) => {
      setFiltersVisible(false)
      setCurrentFilters(filters)
      doRefetch({ filters })
    },
    [doRefetch]
  )

  // Handle service change from search modal
  const handleSelectService = useCallback(
    (newCategoryId: number, newCategoryName: string, newServiceId: number) => {
      setSearchModalVisible(false)
      setCategoryId(newCategoryId)
      setCategoryName(newCategoryName)
      setServiceId(newServiceId)
      // Reset all question/filter state
      setAllAnswers([])
      setDataAnswers([])
      setCurrentPlaceOfService(undefined)
      setCurrentFilters({})
      setSelectedPros([])
      setSheetVisible(true)
      // Prefetch service data + fetch pros
      setIsRefetching(true)
      getServiceData(newServiceId)
      getPros({ categoryId: newCategoryId }, true)
        .unwrap()
        .finally(() => setIsRefetching(false))
    },
    [getPros, getServiceData]
  )

  // Handle address change
  const handleSelectNewAddress = useCallback(
    (newAddress: any) => {
      setAddressModalVisible(false)
      setAddress(newAddress)
      const customerAddress = newAddress?.coords
        ? { latitude: newAddress.coords.lat, longitude: newAddress.coords.lon }
        : undefined
      setIsRefetching(true)
      getPros(
        {
          categoryId,
          placeOfService: currentPlaceOfService,
          customerAddress,
          ...currentFilters,
        },
        true
      )
        .unwrap()
        .finally(() => setIsRefetching(false))
    },
    [categoryId, currentPlaceOfService, currentFilters, getPros]
  )

  const handleChangeLocation = useCallback(() => {
    setSearchModalVisible(false)
    setTimeout(() => setAddressModalVisible(true), 300)
  }, [])

  // Listen for address picked from PickAddressScreen
  useEffect(() => {
    const handler = (newAddress: any) => {
      setTimeout(() => handleSelectNewAddress(newAddress), 600)
    }
    addressEventBus.on("address:pick", handler)
    addressEventBus.on("address:select", handler)
    return () => {
      addressEventBus.off("address:pick", handler)
      addressEventBus.off("address:select", handler)
    }
  }, [handleSelectNewAddress])

  useEffect(() => {
    if (canStart && !dontShowBestDealTooltip && data?.data?.length) {
      const timer = setTimeout(() => start(), 500)
      return () => clearTimeout(timer)
    }
  }, [canStart, dontShowBestDealTooltip, data?.data?.length])

  const handleGoBack = () => {
    navigation.goBack()
  }

  const handleToggleSelect = useCallback((pro: ProType) => {
    setSelectedPros((prev) =>
      prev.includes(pro.id)
        ? prev.filter((id) => id !== pro.id)
        : [...prev, pro.id]
    )
  }, [])

  const handleMessage = useCallback((pro: ProType) => {
  }, [])

  const handlePressProfile = useCallback(async (pro: ProType) => {
    setIsProfileLoading(true)
    try {
      await getProProfile({ proId: pro.id, serviceCategoryId: categoryId }, true).unwrap()
      await new Promise((resolve) => setTimeout(resolve, 300))
      navigation.navigate("ProProfileScreen", { proId: pro.id, serviceCategoryId: categoryId, serviceCategories: pro.serviceCategories })
    } catch (e) {
      setErrorModalVisible(true)
    } finally {
      setIsProfileLoading(false)
    }
  }, [navigation, categoryId, getProProfile])

  const pros = data?.data || []

  const handleContinue = () => {
    // Resolve pro names now while we have the data
    const proNames = selectedPros.map((id) => {
      const pro = pros.find((p) => p.id === id)
      return pro?.businessName || pro?.registeredName || `#${id}`
    }).join(", ")

    // Always go to ServiceRequestDetailsScreen — it handles both
    // unanswered questions AND the mandatory date/time step
    navigation.navigate("ServiceRequestDetailsScreen", {
      categoryId,
      categoryName,
      serviceId,
      selectedProIds: selectedPros,
      selectedProNames: proNames,
      address,
      placeOfService: currentPlaceOfService,
      answeredQuestions: dataAnswers,
    })
  }

  const renderItem = useCallback(
    ({ item, index }: { item: ProType; index: number }) => {
      return (
        <ProCard
          pro={item}
          isSelected={selectedPros.includes(item.id)}
          onSelect={handleToggleSelect}
          onMessage={handleMessage}
          onPressProfile={handlePressProfile}
          isTourTarget={index === 0}
        />
      )
    },
    [selectedPros, handleToggleSelect, handleMessage, handlePressProfile]
  )

  return (
    <View className="flex-1" style={styles.screenBg}>
      {/* White status bar area */}
      <View style={{ backgroundColor: "#FFFFFF", paddingTop: insets.top }} />
      <DmView className="flex-1">
      {/* Header */}
      <DmView className="flex-row items-center px-[12] py-[10] bg-white">
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
        {/* Search pill */}
        <DmView
          className="flex-1 flex-row items-center bg-white rounded-full mx-[8] px-[12] h-[38]"
          style={styles.searchPill}
          onPress={() => setSearchModalVisible(true)}
        >
          <SearchIcon width={14} height={14} />
          <DmText className="ml-[6] text-13 leading-[16px] font-custom500 text-black" numberOfLines={1} style={{ flexShrink: 1 }}>
            {categoryName}
          </DmText>
          <DmText className="text-13 leading-[16px] font-custom400 text-black" numberOfLines={1}>
            {" • "}{address?.city || address?.governorate || ""}
          </DmText>
        </DmView>
        <DmView
          onPress={() => setFiltersVisible(true)}
          className="w-[32] h-[32] items-center justify-center"
          hitSlop={HIT_SLOP_DEFAULT}
        >
          <FilterSlidersIcon width={22} height={22} color={colors.black} />
        </DmView>
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      {/* Job details banner + matches heading */}
      <DmView className="px-[16] pt-[10] pb-[6] bg-white">
        {totalQuestions > 0 && (
          <DmView
            onPress={() => setAllQuestionsVisible(true)}
            className="flex-row items-center mb-[8]"
          >
            <JobDetailsIcon width={18} height={18} color={colors.red} />
            <DmText className="text-13 leading-[16px] font-custom600 text-red ml-[6]">
              {t("job_details_added", { answered: answeredCount, total: totalQuestions })}
            </DmText>
          </DmView>
        )}
        {pros.length > 0 && (
          <DmText className="text-17 leading-[22px] font-custom700 text-black">
            {pros.length} {t("matches_based_on_answers")}
          </DmText>
        )}
      </DmView>

      {/* Content */}
      {isLoading && !pros.length ? (
        <DmView className="flex-1">
          <LoadingOverlay />
        </DmView>
      ) : !isRefetching && (isError || pros.length === 0) ? (
        <DmView className="flex-1 items-center justify-center px-[40]">
          <DmText className="text-16 font-custom600 text-grey3 text-center">
            {t("no_pros_found")}
          </DmText>
          <DmText className="mt-[8] text-12 font-custom400 text-grey3 text-center">
            {t("no_pros_found_descr")}
          </DmText>
        </DmView>
      ) : (
        <FlashList
          data={pros}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          extraData={selectedPros}
          estimatedItemSize={250}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      </DmView>

      {/* Continue button - absolute, slides up from bottom */}
      {showContinue && (
        <Animated.View
          style={[
            styles.continueContainer,
            {
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [150, 0],
                }),
              }],
            },
          ]}
        >
          <ActionBtn
            title={t("continue")}
            onPress={handleContinue}
            textClassName="text-14 font-custom600"
          />
        </Animated.View>
      )}

      {/* Question bottom sheet (gorhom BottomSheetModal — portals to root) */}
      <QuestionBottomSheet
        isVisible={isSheetVisible}
        serviceName={categoryName}
        placeOfServiceOptions={placeOfServiceOptions}
        customerQuestions={customerQuestions}
        onDismiss={handleSheetDismiss}
      />

      <AllQuestionsModal
        isVisible={isAllQuestionsVisible}
        categoryName={categoryName}
        placeOfServiceOptions={placeOfServiceOptions}
        customerQuestions={customerQuestions}
        initialAnswers={allAnswers}
        initialPlaceOfService={currentPlaceOfService}
        onDismiss={handleAllQuestionsDismiss}
      />

      <FiltersModal
        isVisible={isFiltersVisible}
        currentPlaceOfService={currentPlaceOfService}
        initialFilters={currentFilters}
        onDismiss={handleFiltersDismiss}
      />

      <SearchLocationModal
        isVisible={isSearchModalVisible}
        currentCategoryName={categoryName}
        currentAddress={address}
        onSelectService={handleSelectService}
        onChangeLocation={handleChangeLocation}
        onClose={() => setSearchModalVisible(false)}
      />

      <AddressSelectionModal
        isVisible={isAddressModalVisible}
        onClose={() => setAddressModalVisible(false)}
        onSelectAddress={handleSelectNewAddress}
        onSelectNewLocation={() => {
          setAddressModalVisible(false)
          navigation.navigate("PickAddressScreen")
        }}
        onViewAllAddresses={() => {
          setAddressModalVisible(false)
          navigation.navigate("MySavedAddressesScreen", { selectionMode: true })
        }}
      />

      {/* Refetching overlay — over existing results */}
      {isRefetching && (
        <DmView className="absolute top-0 left-0 right-0 bottom-0">
          <LoadingOverlay />
        </DmView>
      )}

      {/* Loading overlay when navigating to profile */}
      {isProfileLoading && (
        <DmView className="absolute top-0 left-0 right-0 bottom-0">
          <LoadingOverlay />
        </DmView>
      )}
      <ErrorModal
        isVisible={isErrorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        descr={t("an_error_occurred")}
      />
    </View>
  )
}

const ProsListingScreen: React.FC<Props> = (props) => {
  return (
    <TourGuideProvider
      preventOutsideInteraction
      tooltipComponent={TooltipComponent}
      maskOffset={0}
      borderRadius={20}
      tooltipStyle={{ overflow: "visible", marginTop: -70 }}
      animationDuration={400}
      backdropColor="rgba(0, 0, 0, 0.7)"
    >
      <ProsListingContent {...props} />
    </TourGuideProvider>
  )
}

export default ProsListingScreen
