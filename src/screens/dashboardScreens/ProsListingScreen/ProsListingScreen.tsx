import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import clsx from "clsx"
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
import { collectProStickerUrls, prefetchSvgs } from "services/svgCache"
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
import SortIcon from "assets/icons/sort.svg"
import ErrorModal from "components/ErrorModal"
import FoodSortSheet from "components/FoodSortSheet/FoodSortSheet"
import styles from "./styles"

type Props = RootStackScreenProps<"ProsListingScreen">

const ProsListingContent: React.FC<Props> = ({ route, navigation }) => {
  const { placeOfService: initialPlaceOfService, forceQuestionFlow } = route.params
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
  const prefetchMenu = api.usePrefetch("getProMenu")

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
  // HARD "questions first" gate: the list stays non-interactive until the
  // question flow has actually presented, or is ruled out for this arrival
  // (place of service already chosen via params, or the service loads with
  // zero customer questions). Closes the cold-cache window where the list was
  // tappable before the sheet appeared, and surfaces a retry if the service
  // (questions) fetch fails — previously that failure silently never asked.
  const [questionsSettled, setQuestionsSettled] = useState(
    // Repost (forceQuestionFlow) re-presents the flow even with a known
    // placeOfService — it opens pre-filled, so the arrival feels brand-new.
    !!initialPlaceOfService && !forceQuestionFlow
  )
  const [currentPlaceOfService, setCurrentPlaceOfService] = useState<string | undefined>(initialPlaceOfService)
  // Food only: broad-first fulfillment mode. "all" shows every pro (any-mode)
  // with capability badges; delivery/pickup narrows. Rides to checkout via cart.
  const [foodFulfillment, setFoodFulfillment] = useState<"all" | "delivery" | "pickup">("all")
  // Food sort — undefined = Default (backend pro_score ranking).
  const [sortBy, setSortBy] = useState<"distance" | "rating" | "responseTime" | undefined>(undefined)
  const [sortVisible, setSortVisible] = useState(false)
  // Repost arrivals seed the previous job's answers so the question flow and
  // request-details steps open pre-filled instead of blank. The listing stays
  // broad until the customer opens/edits questions — normal broad-first rules.
  const [allAnswers, setAllAnswers] = useState<QuestionAnswerType[]>(
    route.params.initialAnswers ?? []
  )
  const [dataAnswers, setDataAnswers] = useState<QuestionAnswerType[]>(
    route.params.initialAnswers ?? []
  )

  // Fetch service data to get placeOfService options for the question flow.
  // NOTE: the services LIST endpoint does NOT include category questions (its
  // relations omit categories.questions — adversarially verified against the
  // running backend), so a list-cache fallback here cannot unblock the question
  // flow. Instant launch comes from cache-warming instead: SubCategoriesScreen
  // prefetches this query on category tap, and SearchAnimationScreen refreshes
  // it during the transition — by mount time the cache is warm on normal paths.
  const {
    data: serviceData,
    isError: isServiceError,
    refetch: refetchService,
  } = useGetServiceByIdQuery(serviceId)
  const category = serviceData?.categories?.find((c) => c.id === categoryId)
  const placeOfServiceOptions = category?.placeOfService || []
  const customerQuestions = category?.customerQuestions || []
  // Food-ordering category: the menu IS the request — no question flow, no
  // shortlisting; cards lead to the pro's menu instead.
  const isFoodCategory = !!category?.hasMenu

  // Compute answered count for the banner
  const allCustomerQuestions = customerQuestions.filter((q) => q.assignee === "customer")
  // Food's filter questions are PRO-declared (assignee='pro', e.g. Cuisines),
  // which the backend strips from customerQuestions — so pull them from
  // proQuestions for the Filters modal. Regular services surface only their
  // customer-facing refinement-tier filters.
  const refinementFilters = isFoodCategory
    ? (category?.proQuestions ?? []).filter((q) => q.isFilter)
    : allCustomerQuestions.filter((q) => q.isFilter && q.tier === "refinement")
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

    getPros(
      {
        categoryId,
        placeOfService: isFoodCategory
          ? foodFulfillment === "all"
            ? undefined
            : foodFulfillment
          : initialPlaceOfService,
        customerAddress,
      },
      true
    )
  }, [categoryId])

  // Launch native question flow on first mount + whenever the service changes
  // (replaces gorhom QuestionBottomSheet)
  useEffect(() => {
    if (isFoodCategory) {
      // Food flow: never present questions; release the list immediately.
      hasLaunchedQuestions.current = true
      relaunchQuestions.current = false
      setQuestionsSettled(true)
      return
    }
    const firstLaunch =
      !hasLaunchedQuestions.current &&
      (!initialPlaceOfService || !!forceQuestionFlow)
    if (!firstLaunch && !relaunchQuestions.current) return
    if (customerQuestions.length === 0) return // wait for the (new) service's questions to load
    hasLaunchedQuestions.current = true
    relaunchQuestions.current = false
    if (Platform.OS === "ios") {
      // Wait out the screen's own push animation before presenting natively
      InteractionManager.runAfterInteractions(() => {
        setQuestionsOpenCount((c) => c + 1)
        setQuestionsVisible(true)
        // Gate drops only as the sheet actually presents — not at effect time,
        // or the push-animation window would reopen.
        setQuestionsSettled(true)
      })
    } else {
      navigation.push("QuestionStepScreen", {
        categoryId,
        categoryName,
        serviceId,
        placeOfServiceOptions,
        customerQuestions,
        // Seeded on repost, empty otherwise — flow opens pre-filled
        initialAnswers: allAnswers,
        initialPlaceOfService: currentPlaceOfService,
      })
      setQuestionsSettled(true)
    }
  }, [customerQuestions.length, serviceId])

  // Gate rule-out: the service payload arrived but this category asks nothing
  // (also covers a categoryId missing from the payload) — there is no flow to
  // wait for, so release the list rather than blocking forever.
  useEffect(() => {
    if (!questionsSettled && serviceData && customerQuestions.length === 0) {
      setQuestionsSettled(true)
    }
  }, [questionsSettled, serviceData, customerQuestions.length])

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
    // Food: the card's primary action opens the MENU (not the profile), so warm
    // the first few menus too — tapping "Food Menu" then renders from cache.
    // Fewer than profiles (menu payloads are heavier); scroll warms the rest.
    if (isFoodCategory) {
      list.slice(0, 5).forEach((p) =>
        prefetchMenu({ proId: p.id, serviceCategoryId: categoryId }, { ifOlderThan: 120 })
      )
    }
  }, [data?.data, categoryId, prefetchProfile, preloadProImages, isFoodCategory, prefetchMenu])

  // Warm EVERY loaded card's sticker/trust SVGs into svgCache (fire-and-forget;
  // a few KB each). By the time a card can scroll into view its artwork is
  // cached, so recycled SvgUriContainers render it in the same frame — no
  // pop-in below the fold. Re-runs per page/filter change; the cache dedupes.
  useEffect(() => {
    const list = data?.data
    if (!list?.length) return
    prefetchSvgs(collectProStickerUrls(list, isAr))
  }, [data?.data, isAr])

  // Shared refetch logic — merges question filters + pro-level filters
  const doRefetch = useCallback(
    (opts: {
      pos?: string
      questionFilterOptionIds?: number[]
      refinementFilterOptionIds?: number[]
      ranges?: { filterId: number; min?: number; max?: number }[]
      filters?: FilterValues
      sortBy?: "distance" | "rating" | "responseTime"
    }) => {
      // 'pos' in opts distinguishes "explicitly cleared" (Reset all → back to
      // the ANY-MODE serveability list) from "not provided" (keep the current
      // choice) — `??` can't. Coords must ride along whenever no POS is set,
      // matching the initial fetch — dropping them would fall back to the
      // backend's legacy UNFILTERED list and show pros the submission guard
      // rejects.
      const placeOfService = 'pos' in opts ? opts.pos : (isFoodCategory ? (foodFulfillment === "all" ? undefined : foodFulfillment) : currentPlaceOfService)
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
          sortBy: 'sortBy' in opts ? opts.sortBy : sortBy,
        },
        true
      )
        .unwrap()
        .finally(() => setIsRefetching(false))
    },
    [categoryId, address, getPros, currentPlaceOfService, isFoodCategory, foodFulfillment, sortBy, currentFilters, questionFilterOptionIds, refinementFilterOptionIds, rangeFilters]
  )

  const refetchWithFilters = useCallback(
    (result: { placeOfService?: string; filterOptionIds: number[]; filtersChanged: boolean }) => {
      if (!result.filtersChanged) return
      doRefetch({ pos: result.placeOfService, questionFilterOptionIds: result.filterOptionIds })
    },
    [doRefetch]
  )

  const handleSortChange = useCallback(
    (newSort: "distance" | "rating" | "responseTime" | undefined) => {
      setSortVisible(false)
      if (newSort === sortBy) return
      setSortBy(newSort)
      doRefetch({ sortBy: newSort })
    },
    [sortBy, doRefetch]
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

  // A pro who doesn't match the current answers cannot stay selected. When
  // the list refreshes (filters/answers/address changed), drop selected pros
  // that fell out and say so — never silently keep a mismatched pro, never
  // silently submit to one.
  const [shortlistNotice, setShortlistNotice] = useState(false)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 0 = hidden (16px low, transparent) → 1 = resting. Slide-up on show,
  // slide-down on auto-dismiss; stays mounted until the exit finishes.
  const noticeAnim = useRef(new Animated.Value(0)).current
  const showShortlistNotice = useCallback(() => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setShortlistNotice(true)
    Animated.timing(noticeAnim, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start()
    noticeTimer.current = setTimeout(() => {
      Animated.timing(noticeAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShortlistNotice(false)
      })
    }, 4000)
  }, [noticeAnim])
  useEffect(() => {
    const list = data?.data
    if (!list) return
    setSelectedPros((prev) => {
      if (!prev.length) return prev
      const ids = new Set(list.map((p) => p.id))
      const kept = prev.filter((id) => ids.has(id))
      if (kept.length === prev.length) return prev
      showShortlistNotice()
      return kept
    })
  }, [data?.data, showShortlistNotice])
  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
  }, [])

  // Details-stage redirect: a late filter answer excluded a selected pro.
  // Merge the final answers, recompute filter ids, refetch — the prune
  // effect above then trims the selection and shows the notice.
  useEffect(() => {
    const handler = ({ answers }: { answers: QuestionAnswerType[] }) => {
      setAllAnswers(answers)
      setDataAnswers(answers)
      const ids: number[] = []
      customerQuestions.forEach((q) => {
        if (!q.isFilter || q.tier === "refinement") return
        const a = answers.find((x) => x.questionId === q.id)
        const sel = a?.optionsIds ?? (a?.optionId ? [a.optionId] : [])
        sel.forEach((oid) => {
          const opt = q.options?.find((o) => o.id === oid)
          if (opt?.serviceCategoryFilterOptionId) ids.push(opt.serviceCategoryFilterOptionId)
        })
      })
      setQuestionFilterOptionIds(ids)
      doRefetch({ questionFilterOptionIds: ids })
    }
    questionFlowEventBus.on("details:answersChanged", handler)
    return () => {
      questionFlowEventBus.off("details:answersChanged", handler)
    }
  }, [customerQuestions, doRefetch])

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
    (filters: FilterValues & { refinementFilterOptionIds: number[]; ranges: { filterId: number; min?: number; max?: number }[]; fulfillment?: "all" | "delivery" | "pickup" }) => {
      const { refinementFilterOptionIds: refinementIds, ranges, fulfillment, ...rest } = filters
      setCurrentFilters(rest)
      setRefinementFilterOptionIds(refinementIds)
      setRangeFilters(ranges)
      if (fulfillment) setFoodFulfillment(fulfillment)
      doRefetch({
        filters: rest,
        refinementFilterOptionIds: refinementIds,
        ranges,
        // Food fulfillment drives placeOfService; "all" → broad (undefined)
        ...(fulfillment && { pos: fulfillment === "all" ? undefined : fulfillment }),
      })
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
      setQuestionsSettled(false) // re-arm the questions-first gate for the new service
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

  // Food listing: card action opens the pro's menu straight away
  const handleViewMenu = useCallback(
    (pro: ProType) => {
      navigation.navigate("FoodMenuScreen", {
        proId: pro.id,
        serviceCategoryId: categoryId,
        serviceId,
        proName: pro.screenName || pro.businessName || pro.registeredName || "",
        categoryName,
        address: address ?? null,
        fulfillmentMode: foodFulfillment === "all" ? undefined : foodFulfillment,
      })
    },
    [navigation, categoryId, serviceId, categoryName, address, foodFulfillment]
  )

  const handlePressProfile = useCallback(async (pro: ProType) => {
    const arg = { proId: pro.id, serviceCategoryId: categoryId }
    const goToProfile = () =>
      navigation.navigate("ProProfileScreen", {
        proId: pro.id,
        serviceCategoryId: categoryId,
        serviceCategories: pro.serviceCategories,
        // Food category: the profile shows a floating "Food Menu" pill
        ...(isFoodCategory && {
          foodMenu: { serviceId, categoryName, address: address ?? null },
        }),
      })

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
  }, [navigation, categoryId, getProProfile, preloadProImages, isFoodCategory, serviceId, categoryName, address])

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
      // ALL answers, filter ones included: Details must not re-ask questions
      // the customer already answered pre-selection (re-asking let them flip
      // a filter answer to something the selected pro doesn't serve), and the
      // created job should record filter answers — matching how reposted
      // jobs already behave.
      answeredQuestions: allAnswers,
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
        // Food: warm each menu as its card scrolls into view (Strategy B for menus)
        if (isFoodCategory) {
          prefetchMenu({ proId: p.id, serviceCategoryId: categoryId }, { ifOlderThan: 120 })
        }
      })
  }, [prefetchProfile, categoryId, preloadProImages, isFoodCategory, prefetchMenu])

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
          foodMode={isFoodCategory}
          onViewMenu={handleViewMenu}
        />
      )
    },
    [selectedPros, handleToggleSelect, handleMessage, handlePressProfile, isFoodCategory, handleViewMenu]
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
        <DmView className="flex-row items-center">
          {isFoodCategory && (
            <DmView
              onPress={() => setSortVisible(true)}
              className="w-[32] h-[32] items-center justify-center mr-[4]"
              hitSlop={HIT_SLOP_DEFAULT}
            >
              <SortIcon
                width={20}
                height={20}
                color={sortBy ? colors.red : colors.black}
              />
            </DmView>
          )}
          <DmView
            onPress={() => {
              if (Platform.OS === "ios") {
                setFiltersOpenCount((c) => c + 1)
                setFiltersVisible(true)
              } else {
                navigation.navigate("FiltersScreen", {
                  currentPlaceOfService,
                  isFoodCategory,
                  foodMode: foodFulfillment,
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
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      {/* Job details banner + matches heading */}
      <DmView className="px-[16] pt-[14] pb-[8] bg-white">
        {totalQuestions > 0 && !isFoodCategory && (
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
            {pros.length}{" "}
            {isFoodCategory
              ? foodFulfillment === "pickup"
                ? t("available_for_pickup")
                : foodFulfillment === "delivery"
                  ? t("available_for_delivery")
                  : t("available_pros")
              : t("matches_based_on_answers")}
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
      {/* Shortlist-updated toast: selected pros that stopped matching were
          just removed — say it, don't let them wonder. Slides up in, slides
          down out. */}
      {shortlistNotice && (
        <Animated.View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 130,
            zIndex: 50,
            opacity: noticeAnim,
            transform: [
              {
                translateY: noticeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          }}
          pointerEvents="none"
        >
          <DmView
            className="rounded-10 px-[14] py-[10]"
            style={{ backgroundColor: "rgba(28,25,23,0.92)" }}
          >
            <DmText className="text-12 leading-[16px] font-custom600 text-white text-center">
              {t("shortlist_updated_notice")}
            </DmText>
          </DmView>
        </Animated.View>
      )}
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

      {/* "Questions first" gate — swallows all touches until the question flow
          has presented or been ruled out. On the warm path (cache prefetched by
          SubCategories/SearchAnimation) it's invisible for just the push
          animation; on a cold cache it shows a spinner while the service
          payload loads; if that fetch failed it offers a retry instead of
          silently never asking. System back (edge-swipe / hardware) still
          works — the gate only blocks in-screen touches. */}
      {!questionsSettled && (
        <DmView
          className="absolute top-0 left-0 right-0 bottom-0"
          onStartShouldSetResponder={() => true}
        >
          {isServiceError ? (
            <DmView className="flex-1 bg-white items-center justify-center px-[40]">
              <DmText className="text-16 font-custom600 text-grey3 text-center">
                {t("an_error_occurred")}
              </DmText>
              <ActionBtn
                title={t("try_again")}
                onPress={() => refetchService()}
                className="mt-[20] rounded-5 h-[41] px-[40]"
                textClassName="text-13 font-custom600"
              />
            </DmView>
          ) : !serviceData ? (
            <LoadingOverlay />
          ) : null}
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
        initialAnswers={allAnswers}
        initialPlaceOfService={currentPlaceOfService}
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
        isFoodCategory={isFoodCategory}
        foodMode={foodFulfillment}
        initialFilters={currentFilters}
        refinementFilters={refinementFilters}
        initialRefinementOptionIds={refinementFilterOptionIds}
        initialRanges={rangeFilters}
        upfrontSelections={upfrontSelections}
        onApply={handleFiltersDismiss}
      />

      {/* Food Sort sheet (native on iOS, modal fallback on Android) */}
      <FoodSortSheet
        visible={sortVisible}
        value={sortBy}
        onSelect={handleSortChange}
        onClose={() => setSortVisible(false)}
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
