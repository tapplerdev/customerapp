import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, InteractionManager, Platform, View, ViewToken } from "react-native"
import { FlashList } from "@shopify/flash-list"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import {
  TourGuideProvider,
  useTourGuideController,
} from "rn-tourguide"

import FastImage from "react-native-fast-image"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { api, useLazyGetProsForCategoryQuery, useLazyGetProProfileQuery, useGetServiceByIdQuery, useLazyOpenChatQuery, useLazyGetChatMessagesQuery } from "services/api"
import { store, useTypedSelector } from "store"
import { ProType } from "types/pro"
import { QuestionAnswerType } from "types/job"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"

import ProCard, { estimateProCardHeight } from "./components/ProCard"
import TooltipComponent from "./components/TooltipComponent"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"
// import QuestionBottomSheet from "components/QuestionBottomSheet/QuestionBottomSheet"
import { questionFlowEventBus } from "events/questionFlowEventBus"
import AllQuestionsModal from "components/AllQuestionsModal/AllQuestionsModal"
import { FiltersSheet, FilterValues } from "screens/dashboardScreens/FiltersScreen/FiltersScreen"
import { QuestionFlowSheet } from "screens/dashboardScreens/QuestionStepScreen/QuestionStepScreen"
import { AllQuestionsSheet } from "screens/dashboardScreens/AllQuestionsScreen/AllQuestionsScreen"
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
  const [openChat] = useLazyOpenChatQuery()
  const [getChatMessages] = useLazyGetChatMessagesQuery()
  const prefetchProfile = api.usePrefetch("getProProfile")

  const { canStart, start } = useTourGuideController()

  const [isProfileLoading, setIsProfileLoading] = useState(false)
  const [isErrorModalVisible, setErrorModalVisible] = useState(false)
  const [isRefetching, setIsRefetching] = useState(false)

  // Search modal state
  const [isSearchModalVisible, setSearchModalVisible] = useState(false)
  const [isAddressModalVisible, setAddressModalVisible] = useState(false)

  // Filters state
  const [currentFilters, setCurrentFilters] = useState<FilterValues>({})
  // iOS presents filters in the native push-back sheet; the counter re-seeds
  // the sheet's state from the latest applied filters on every open
  const [filtersVisible, setFiltersVisible] = useState(false)
  const [filtersOpenCount, setFiltersOpenCount] = useState(0)
  const [questionsVisible, setQuestionsVisible] = useState(false)
  const [questionsOpenCount, setQuestionsOpenCount] = useState(0)
  const [allQuestionsVisible, setAllQuestionsVisible] = useState(false)
  const [allQuestionsOpenCount, setAllQuestionsOpenCount] = useState(0)
  // Service filter option ids: primary (from the upfront flow) + refinement (from the filters modal)
  const [questionFilterOptionIds, setQuestionFilterOptionIds] = useState<number[]>([])
  const [refinementFilterOptionIds, setRefinementFilterOptionIds] = useState<number[]>([])
  const [rangeFilters, setRangeFilters] = useState<{ filterId: number; min?: number; max?: number }[]>([])

  // Question flow state
  // const [isSheetVisible, setSheetVisible] = useState(!initialPlaceOfService) // OLD: gorhom sheet
  const hasLaunchedQuestions = useRef(false)
  const relaunchQuestions = useRef(false)
  const [currentPlaceOfService, setCurrentPlaceOfService] = useState<string | undefined>(initialPlaceOfService)
  const [allAnswers, setAllAnswers] = useState<QuestionAnswerType[]>([])
  const [dataAnswers, setDataAnswers] = useState<QuestionAnswerType[]>([])

  // Fetch service data to get placeOfService options for the question flow.
  // NOTE: the services LIST endpoint does NOT include category questions (its
  // relations omit categories.questions — adversarially verified against the
  // running backend), so a list-cache fallback here cannot unblock the question
  // flow. Instant launch comes from cache-warming instead: SubCategoriesScreen
  // prefetches this query on category tap, and SearchAnimationScreen refreshes
  // it during the transition — by mount time the cache is warm on normal paths.
  const { data: serviceData } = useGetServiceByIdQuery(serviceId)
  const category = serviceData?.categories?.find((c) => c.id === categoryId)
  const placeOfServiceOptions = category?.placeOfService || []
  const customerQuestions = category?.customerQuestions || []

  // Compute answered count for the banner
  const allCustomerQuestions = customerQuestions.filter((q) => q.assignee === "customer")
  const refinementFilters = allCustomerQuestions.filter((q) => q.isFilter && q.tier === "refinement")
  // Primary (asked-upfront) filter picks — passed to the modal as locked cascade parents
  const upfrontSelections = allCustomerQuestions
    .filter((q) => q.isFilter && q.tier !== "refinement")
    .map((q) => ({
      questionText: q.text,
      questionTextAr: q.textAr,
      options: (q.options ?? [])
        .filter(
          (o) =>
            !!o.serviceCategoryFilterOptionId &&
            !!o.filterOptionKey &&
            questionFilterOptionIds.includes(o.serviceCategoryFilterOptionId)
        )
        .map((o) => ({ key: o.filterOptionKey!, label: o.label, labelAr: o.labelAr })),
    }))
    .filter((s) => s.options.length > 0)
  // Refinement filters live in the Filters modal, not the upfront flow, so exclude them from the banner count
  const upfrontQuestions = allCustomerQuestions.filter((q) => !(q.isFilter && q.tier === "refinement"))
  const totalQuestions = upfrontQuestions.length + (placeOfServiceOptions.length > 1 ? 1 : 0)
  const answeredCount = useMemo(() => {
    let count = currentPlaceOfService ? 1 : 0
    upfrontQuestions.forEach((q) => {
      const ans = allAnswers.find((a) => a.questionId === q.id)
      if (!ans) return
      if (q.type === "shortAnswer" || q.type === "paragraph") { if (ans.answer) count++ }
      else if (q.type === "oneChoice") { if (ans.optionId) count++ }
      else if (q.type === "multipleChoice") { if (ans.optionsIds?.length) count++ }
      else if (q.type === "dateTime") { if (ans.date || ans.startDate) count++ }
    })
    return count
  }, [allAnswers, upfrontQuestions, currentPlaceOfService])

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

  // Initial fetch (already done by SearchAnimationScreen, RTK Query cache serves it).
  // The committed service address rides along: with no placeOfService yet, the
  // backend returns only pros who could serve that point under AT LEAST ONE of
  // their modes (ANY-MODE serveability, in lockstep with @ProsServeJobLocation
  // at submission) — the question flow then narrows the list further.
  useEffect(() => {
    const skipAddress =
      initialPlaceOfService === "remoteOrOnline" || initialPlaceOfService === "fixedLocations"
    const customerAddress =
      skipAddress ? undefined : address?.coords ? { latitude: address.coords.lat, longitude: address.coords.lon } : undefined

    getPros({ categoryId, placeOfService: initialPlaceOfService, customerAddress }, true)
  }, [categoryId])

  // Launch native question flow on first mount + whenever the service changes
  // (replaces gorhom QuestionBottomSheet)
  useEffect(() => {
    const firstLaunch = !hasLaunchedQuestions.current && !initialPlaceOfService
    if (!firstLaunch && !relaunchQuestions.current) return
    if (customerQuestions.length === 0) return // wait for the (new) service's questions to load
    hasLaunchedQuestions.current = true
    relaunchQuestions.current = false
    if (Platform.OS === "ios") {
      // Wait out the screen's own push animation before presenting natively
      InteractionManager.runAfterInteractions(() => {
        setQuestionsOpenCount((c) => c + 1)
        setQuestionsVisible(true)
      })
    } else {
      navigation.push("QuestionStepScreen", {
        categoryId,
        categoryName,
        serviceId,
        placeOfServiceOptions,
        customerQuestions,
      })
    }
  }, [customerQuestions.length, serviceId])

  // Preload a pro's image BYTES into FastImage's disk cache so the profile
  // screen renders them instantly instead of popping them in on arrival.
  const preloadProImages = useCallback((p: ProType) => {
    const uris = [p.profilePhoto150, p.profilePhoto, ...(p.photosOfWork?.slice(0, 4) ?? [])]
      .filter(Boolean)
      .map((uri) => ({ uri: uri as string }))
    if (uris.length) FastImage.preload(uris)
  }, [])

  // Strategy C: prefetch the first N pro profiles (data + image bytes) once the
  // list loads, so tapping a card opens ProProfileScreen instantly from cache.
  // `ifOlderThan` skips re-fetch if already warm, so this is cheap even if the
  // effect re-runs. FastImage.preload dedupes against its own cache.
  useEffect(() => {
    const list = data?.data
    if (!list?.length) return
    list.slice(0, 10).forEach((p) => {
      prefetchProfile({ proId: p.id, serviceCategoryId: categoryId }, { ifOlderThan: 120 })
      preloadProImages(p)
    })
  }, [data?.data, categoryId, prefetchProfile, preloadProImages])

  // Shared refetch logic — merges question filters + pro-level filters
  const doRefetch = useCallback(
    (opts: {
      pos?: string
      questionFilterOptionIds?: number[]
      refinementFilterOptionIds?: number[]
      ranges?: { filterId: number; min?: number; max?: number }[]
      filters?: FilterValues
    }) => {
      // 'pos' in opts distinguishes "explicitly cleared" (Reset all → back to
      // the ANY-MODE serveability list) from "not provided" (keep the current
      // choice) — `??` can't. Coords must ride along whenever no POS is set,
      // matching the initial fetch — dropping them would fall back to the
      // backend's legacy UNFILTERED list and show pros the submission guard
      // rejects.
      const placeOfService = 'pos' in opts ? opts.pos : currentPlaceOfService
      const skipAddress = placeOfService === "remoteOrOnline" || placeOfService === "fixedLocations"
      const customerAddress = skipAddress
        ? undefined
        : address?.coords
          ? { latitude: address.coords.lat, longitude: address.coords.lon }
          : undefined

      const f = opts.filters ?? currentFilters
      const mergedFilterOptionIds = [
        ...(opts.questionFilterOptionIds ?? questionFilterOptionIds),
        ...(opts.refinementFilterOptionIds ?? refinementFilterOptionIds),
      ]

      setIsRefetching(true)
      getPros(
        {
          categoryId,
          placeOfService,
          customerAddress,
          filterOptionsIds: mergedFilterOptionIds.length ? mergedFilterOptionIds : undefined,
          filterRanges: opts.ranges ?? rangeFilters,
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
    [categoryId, address, getPros, currentPlaceOfService, currentFilters, questionFilterOptionIds, refinementFilterOptionIds, rangeFilters]
  )

  const refetchWithFilters = useCallback(
    (result: { placeOfService?: string; filterOptionIds: number[]; filtersChanged: boolean }) => {
      if (!result.filtersChanged) return
      doRefetch({ pos: result.placeOfService, questionFilterOptionIds: result.filterOptionIds })
    },
    [doRefetch]
  )

  // Listen for question flow results (emitted by QuestionStepScreen)
  useEffect(() => {
    const handler = (result: {
      placeOfService?: string
      filterOptionIds: number[]
      dataAnswers: QuestionAnswerType[]
      allAnswers: QuestionAnswerType[]
      filtersChanged: boolean
    }) => {
      setCurrentPlaceOfService(result.placeOfService)
      setDataAnswers(result.dataAnswers)
      setAllAnswers(result.allAnswers)
      setQuestionFilterOptionIds(result.filterOptionIds)
      refetchWithFilters(result)
    }

    questionFlowEventBus.on("questions:done", handler)
    return () => {
      questionFlowEventBus.off("questions:done", handler)
    }
  }, [refetchWithFilters])

  // Handle all-questions modal dismiss
  const handleAllQuestionsDismiss = useCallback(
    (result: {
      placeOfService?: string
      filterOptionIds: number[]
      dataAnswers: QuestionAnswerType[]
      allAnswers: QuestionAnswerType[]
      filtersChanged: boolean
      resetAll?: boolean
    }) => {
      setCurrentPlaceOfService(result.placeOfService)
      setDataAnswers(result.dataAnswers)
      setAllAnswers(result.allAnswers)
      setQuestionFilterOptionIds(result.filterOptionIds)
      if (result.resetAll) {
        // "Reset all" also nukes the slider-modal filters (pro-level +
        // refinement + ranges) — pass explicit empties so the refetch doesn't
        // resurrect them from stale state closures.
        setCurrentFilters({})
        setRefinementFilterOptionIds([])
        setRangeFilters([])
        doRefetch({
          pos: result.placeOfService,
          questionFilterOptionIds: result.filterOptionIds,
          refinementFilterOptionIds: [],
          ranges: [],
          filters: {},
        })
        return
      }
      refetchWithFilters(result)
    },
    [refetchWithFilters, doRefetch]
  )

  // Handle pro-level filters dismiss
  const handleFiltersDismiss = useCallback(
    (filters: FilterValues & { refinementFilterOptionIds: number[]; ranges: { filterId: number; min?: number; max?: number }[] }) => {
      const { refinementFilterOptionIds: refinementIds, ranges, ...rest } = filters
      setCurrentFilters(rest)
      setRefinementFilterOptionIds(refinementIds)
      setRangeFilters(ranges)
      doRefetch({ filters: rest, refinementFilterOptionIds: refinementIds, ranges })
    },
    [doRefetch]
  )

  // Handle service change from search modal
  const handleSelectService = useCallback(
    (newCategoryId: number, newCategoryName: string, newServiceId: number) => {
      setSearchModalVisible(false)
      // Same service re-selected (e.g. the user only came to change the address):
      // keep placeOfService/answers/filters — no reset, no question re-ask.
      if (newServiceId === serviceId && newCategoryId === categoryId) return
      setCategoryId(newCategoryId)
      setCategoryName(newCategoryName)
      setServiceId(newServiceId)
      // Reset all question/filter state
      setAllAnswers([])
      setDataAnswers([])
      setCurrentPlaceOfService(undefined)
      setCurrentFilters({})
      setQuestionFilterOptionIds([])
      setRefinementFilterOptionIds([])
      setRangeFilters([])
      setSelectedPros([])
      relaunchQuestions.current = true // re-launch the native question flow once the new service's data loads
      // No explicit service-data fetch needed: setServiceId re-runs the
      // useGetServiceByIdQuery hook for the new id (cache-served when warm —
      // the old lazy call here force-re-downloaded the heavy payload every
      // switch). The interim pros fetch carries the committed address so it's
      // the ANY-MODE serveability list (same as a fresh search); the question
      // flow narrows it once completed.
      setIsRefetching(true)
      const customerAddress = address?.coords
        ? { latitude: address.coords.lat, longitude: address.coords.lon }
        : undefined
      getPros({ categoryId: newCategoryId, customerAddress }, true)
        .unwrap()
        .finally(() => setIsRefetching(false))
    },
    [serviceId, categoryId, address, getPros]
  )

  // Handle address change
  const handleSelectNewAddress = useCallback(
    (newAddress: any) => {
      setAddressModalVisible(false)
      setAddress(newAddress)
      // remoteOrOnline/fixedLocations must not send coords — the backend DTO
      // validator 400s on customerAddress for those modes.
      const skipAddress =
        currentPlaceOfService === "remoteOrOnline" || currentPlaceOfService === "fixedLocations"
      const customerAddress = skipAddress
        ? undefined
        : newAddress?.coords
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

  // Listen for address picked from PickAddressScreen.
  // Several screens listen to this bus and stay mounted in the stack — only the
  // FOCUSED screen may act, or one pick triggers them all (e.g. SubCategories
  // re-launching the search animation on top of these results).
  useEffect(() => {
    const handler = (newAddress: any) => {
      setTimeout(() => {
        if (!navigation.isFocused()) return
        handleSelectNewAddress(newAddress)
      }, 600)
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

  const handleMessage = useCallback(async (pro: ProType) => {
    // Open (or resume) a direct chat with this pro — backend creates a bare
    // chat (no job) or returns the existing customer/pro/category thread.
    setIsProfileLoading(true)
    try {
      const chat = await openChat({ categoryId, recipientId: pro.id }, true).unwrap()
      // Prefetch page 1 of messages (same arg the chat screen queries) so it
      // mounts straight onto content — failure here shouldn't block the chat.
      await getChatMessages({ chatId: chat.id, page: 1, perPage: 20 }, true)
        .unwrap()
        .catch(() => {})
      navigation.navigate("MessagesDetailsScreen", {
        chatPreview: { chat, notReadMessages: 0 },
      })
    } catch (e) {
      setErrorModalVisible(true)
    } finally {
      setIsProfileLoading(false)
    }
  }, [categoryId, navigation, openChat, getChatMessages])

  const handlePressProfile = useCallback(async (pro: ProType) => {
    const arg = { proId: pro.id, serviceCategoryId: categoryId }
    const goToProfile = () =>
      navigation.navigate("ProProfileScreen", { proId: pro.id, serviceCategoryId: categoryId, serviceCategories: pro.serviceCategories })

    // Already prefetched (strategy C) → open instantly, no overlay, no delay
    const cached = api.endpoints.getProProfile.select(arg)(store.getState()).data
    if (cached) {
      preloadProImages(cached as unknown as ProType) // head start for any not-yet-cached bytes
      goToProfile()
      return
    }

    // Cold cache → fetch with overlay, then navigate as soon as it resolves
    setIsProfileLoading(true)
    try {
      const profile = await getProProfile(arg, true).unwrap()
      preloadProImages(profile as unknown as ProType) // images load during the transition
      goToProfile()
    } catch (e) {
      setErrorModalVisible(true)
    } finally {
      setIsProfileLoading(false)
    }
  }, [navigation, categoryId, getProProfile, preloadProImages])

  const pros = data?.data || []

  const handleContinue = () => {
    // Resolve pro data now while we have it
    const proNames = selectedPros.map((id) => {
      const pro = pros.find((p) => p.id === id)
      return pro?.businessName || pro?.registeredName || `#${id}`
    }).join(", ")

    const prosInfo = selectedPros.map((id) => {
      const pro = pros.find((p) => p.id === id)
      return {
        id,
        name: pro?.businessName || pro?.registeredName || `#${id}`,
        photo: pro?.profilePhoto150 || pro?.profilePhoto,
        rating: pro?.reviewScore?.overallScore,
        reviewsCount: pro?.reviewScore?.reviewsCount,
        proType: (pro?.proType || "individual") as "individual" | "company",
      }
    })

    // Always go to ServiceRequestDetailsScreen — it handles both
    // unanswered questions AND the mandatory date/time step
    navigation.navigate("ServiceRequestDetailsScreen", {
      categoryId,
      categoryName,
      serviceId,
      selectedProIds: selectedPros,
      selectedProNames: proNames,
      selectedProsInfo: prosInfo,
      address,
      placeOfService: currentPlaceOfService,
      answeredQuestions: dataAnswers,
    })
  }

  // Strategy B: prefetch profiles of pros as they scroll into view, so they're
  // instant too. FlashList captures onViewableItemsChanged once and disallows
  // changing it, so the handler is a stable ref that calls the latest prefetch
  // logic (kept current via the effect below, so categoryId never goes stale).
  const prefetchVisibleRef = useRef<(items: ProType[]) => void>(() => {})
  useEffect(() => {
    prefetchVisibleRef.current = (items) =>
      items.forEach((p) => {
        prefetchProfile({ proId: p.id, serviceCategoryId: categoryId }, { ifOlderThan: 120 })
        preloadProImages(p)
      })
  }, [prefetchProfile, categoryId, preloadProImages])

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    prefetchVisibleRef.current(viewableItems.map((v) => v.item).filter(Boolean) as ProType[])
  }).current

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50, minimumViewTime: 200 }).current

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
          onPress={() => {
            if (Platform.OS === "ios") {
              setFiltersOpenCount((c) => c + 1)
              setFiltersVisible(true)
            } else {
              navigation.navigate("FiltersScreen", {
                currentPlaceOfService,
                initialFilters: currentFilters,
                refinementFilters,
                initialRefinementOptionIds: refinementFilterOptionIds,
                initialRanges: rangeFilters,
                upfrontSelections,
                onApply: handleFiltersDismiss,
              })
            }
          }}
          className="w-[32] h-[32] items-center justify-center"
          hitSlop={HIT_SLOP_DEFAULT}
        >
          <FilterSlidersIcon width={22} height={22} color={colors.black} />
        </DmView>
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      {/* Job details banner + matches heading */}
      <DmView className="px-[16] pt-[14] pb-[8] bg-white">
        {totalQuestions > 0 && (
          <DmView
            onPress={() => {
              if (Platform.OS === "ios") {
                setAllQuestionsOpenCount((c) => c + 1)
                setAllQuestionsVisible(true)
              } else {
                navigation.navigate("AllQuestionsScreen", {
                  categoryName,
                  placeOfServiceOptions,
                  customerQuestions,
                  initialAnswers: allAnswers,
                  initialPlaceOfService: currentPlaceOfService,
                  onApply: handleAllQuestionsDismiss,
                })
              }
            }}
            className="flex-row items-center mb-[12]"
          >
            <JobDetailsIcon width={18} height={18} color={colors.red} />
            <DmText className="text-13 leading-[16px] font-custom600 text-red ml-[6]">
              {t("job_details_added", { answered: answeredCount, total: totalQuestions })}
            </DmText>
          </DmView>
        )}
        {pros.length > 0 && (
          <DmText className="text-19 leading-[24px] font-custom700 text-black">
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
          overrideItemLayout={(layout, pro) => {
            layout.size = estimateProCardHeight(pro)
          }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 90 }}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
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

      {/* Question flow is now a native screen (QuestionStepScreen, formSheet) — launched via
          navigation.push and resolved via questionFlowEventBus, replacing the gorhom QuestionBottomSheet */}

      {/* AllQuestionsModal — replaced with native AllQuestionsScreen (modal)
      <AllQuestionsModal
        isVisible={isAllQuestionsVisible}
        categoryName={categoryName}
        placeOfServiceOptions={placeOfServiceOptions}
        customerQuestions={customerQuestions}
        initialAnswers={allAnswers}
        initialPlaceOfService={currentPlaceOfService}
        onDismiss={handleAllQuestionsDismiss}
      />
      */}

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

      {/* First-time question flow — native push-back sheet (iOS); Android
          uses the QuestionStepScreen route */}
      <QuestionFlowSheet
        visible={questionsVisible}
        contentKey={questionsOpenCount}
        onClose={() => setQuestionsVisible(false)}
        categoryId={categoryId}
        categoryName={categoryName}
        serviceId={serviceId}
        placeOfServiceOptions={placeOfServiceOptions}
        customerQuestions={customerQuestions}
      />

      {/* Job-details editor — native push-back sheet (iOS); Android uses the
          AllQuestionsScreen route */}
      <AllQuestionsSheet
        visible={allQuestionsVisible}
        contentKey={allQuestionsOpenCount}
        onClose={() => setAllQuestionsVisible(false)}
        categoryName={categoryName}
        placeOfServiceOptions={placeOfServiceOptions}
        customerQuestions={customerQuestions}
        initialAnswers={allAnswers}
        initialPlaceOfService={currentPlaceOfService}
        onApply={handleAllQuestionsDismiss}
      />

      {/* Filters — native push-back sheet (iOS); Android uses the FiltersScreen route */}
      <FiltersSheet
        visible={filtersVisible}
        contentKey={filtersOpenCount}
        onClose={() => setFiltersVisible(false)}
        currentPlaceOfService={currentPlaceOfService}
        initialFilters={currentFilters}
        refinementFilters={refinementFilters}
        initialRefinementOptionIds={refinementFilterOptionIds}
        initialRanges={rangeFilters}
        upfrontSelections={upfrontSelections}
        onApply={handleFiltersDismiss}
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
