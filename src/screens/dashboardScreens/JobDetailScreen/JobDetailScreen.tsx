import React, { useCallback, useEffect, useRef, useState } from "react"
import { Animated, LayoutAnimation, Platform, TextInput, UIManager, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useIsFocused } from "@react-navigation/native"
import FastImage from "react-native-fast-image"

import { DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { api, useCancelJobMutation, useGetChatsQuery, useGetCustomerJobByIdQuery, useLazyOpenChatQuery, useRespondToOpportunityMutation } from "services/api"
import useJobPros from "hooks/useJobPros"
import useCancelJob from "hooks/useCancelJob"
import useRepostRequest from "hooks/useRepostRequest"
import { MainModal } from "@tappler/shared/src/components"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import { JobProType } from "types/job"
import RateComponent from "components/RateComponent/RateComponent"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import IndividualIcon from "assets/icons/individual.svg"
import BusinessIcon from "assets/icons/business.svg"
import MailIcon from "assets/icons/mail.svg"
import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"
import ProCardBase from "components/ProCardBase/ProCardBase"
import ErrorModal from "components/ErrorModal"
import SkeletonLoader from "components/SkeletonLoader/SkeletonLoader"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import DetailsIcon from "assets/icons/details-icon.svg"
import TrashRedIcon from "assets/icons/trash-red.svg"
import CancelJobFeedbackModal from "components/CancelJobFeedbackModal/CancelJobFeedbackModal"
import ClockRedIcon from "assets/icons/clock-red-big.svg"
import UsersRedIcon from "assets/icons/users-red.svg"
import styles from "./styles"
import FoodOrderView, {
  canCancelFoodOrder,
  CUSTOMER_CANCELLED_FOOD_ORDER,
} from "./components/FoodOrderView"
import JobMenuSheet from "./components/JobMenuSheet"
import { AppFlatList } from "components/scroll"
import { Text, a, px } from "@tappler/shared/src/ds"

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

type Props = RootStackScreenProps<"JobDetailScreen">

const JobDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { jobId } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const {
    data: job,
    isLoading: isJobLoading,
    refetch: refetchJob,
  } = useGetCustomerJobByIdQuery(jobId)
  const insets = useSafeAreaInsets()

  // Safety net alongside the socket-driven Jobs invalidation: refetch on
  // RE-focus so a missed socket event (backgrounded app, dropped connection)
  // can't strand the Other Pros tab on a pre-offer snapshot. Mount already
  // fetched — skip the first focus.
  const isFocused = useIsFocused()
  const hasFocusedOnce = useRef(false)
  useEffect(() => {
    if (!isFocused) return
    if (hasFocusedOnce.current) {
      refetchJob()
    } else {
      hasFocusedOnce.current = true
    }
  }, [isFocused])
  const [isMenuVisible, setMenuVisible] = useState(false)
  const [isCancelModalVisible, setCancelModalVisible] = useState(false)
  const [isCancelFeedbackVisible, setCancelFeedbackVisible] = useState(false)
  const [isCancelledModalVisible, setCancelledModalVisible] = useState(false)
  const [isFindProsModalVisible, setFindProsModalVisible] = useState(false)
  const [isRescueBusy, setRescueBusy] = useState(false)
  const prefetchJobDetails = api.usePrefetch("getCustomerJobDetails")

  const [openChat] = useLazyOpenChatQuery()
  const [respondToOpportunity] = useRespondToOpportunityMutation()
  const { data: chatsData } = useGetChatsQuery()

  const getUnreadCount = (proId: number) => {
    const chatPreview = chatsData?.data?.find(
      (c) => c.chat.proId === proId && c.chat.jobId === jobId
    )
    return chatPreview?.notReadMessages || 0
  }
  const [activeTab, setActiveTab] = useState<"selected" | "other">("selected")
  const [localJob, setLocalJob] = useState(job)
  const [isErrorModalVisible, setErrorModalVisible] = useState(false)
  // Guards a double-tap on Yes while the request is in flight, which would
  // otherwise send a second cancel and — now that the server returns 409 for an
  // order already being prepared — could show a "too late" error for a cancel
  // that had in fact just succeeded.
  const [isCancellingFood, setCancellingFood] = useState(false)
  // Null means "use the generic copy". Only the food path sets it, so the other
  // five callers of setErrorModalVisible keep the message they always had.
  const [foodCancelError, setFoodCancelError] = useState<string | null>(null)

  // Sync local state when RTK cache updates (e.g. after mutation invalidation)
  useEffect(() => {
    if (job) setLocalJob(job)
  }, [job])
  const [bannerType, setBannerType] = useState<"new_offers" | "pro_moved" | null>(null)

  // Skeleton → content fade (mirrors the opportunities-list pattern): the
  // skeleton mirrors the real layout, so the swap reads as bars resolving into
  // content rather than a spinner flash. Seeded to 1 when the job is already
  // cached at mount (Talabati prefetches as rows scroll into view) — a warm
  // open renders instantly with NO fade; only real skeleton→content animates.
  const contentFade = useRef(new Animated.Value(job ? 1 : 0)).current
  useEffect(() => {
    if (!isJobLoading && localJob) {
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start()
    }
  }, [isJobLoading, !!localJob])

  // Banner animation
  const bannerOpacity = useRef(new Animated.Value(0)).current
  const bannerTranslateY = useRef(new Animated.Value(-20)).current

  const { selectedPros, otherPros, offersCount } = useJobPros(localJob?.pros)

  // Rescue surfaces. `ended` → repost (new prefilled request). Active with
  // every invited pro declined → "Find other pros" (cancel + prefilled
  // restart). Explicit policy: NO opportunity-pro gate — if opportunity pros
  // bought this lead, their points are accepted collateral (Omar's call).
  const isEnded = localJob?.status === "ended"
  const isStranded =
    localJob?.status === "active" &&
    selectedPros.length > 0 &&
    selectedPros.every((p) => p.selectionStatus === "proRejected")

  const repostFromJob = useRepostRequest()
  const [cancelJobForRescue] = useCancelJobMutation()
  const [isFoodMenuVisible, setFoodMenuVisible] = useState(false)

  // Cancel moved out of the page body and behind the header's ••• menu. Uses
  // the app's own confirm dialog — the same MainModal the regular-service
  // cancel opens — rather than a native Alert.
  const handleCancelFoodOrder = () => {
    setFoodMenuVisible(false)
    setTimeout(() => setCancelModalVisible(true), 400)
  }

  // Was fire-and-forget: the mutation was triggered, the modal closed, and
  // nothing looked at the result. On a failure — flaky signal, 5xx, or the
  // kitchen having started cooking in the meantime — the order stayed live
  // while the customer walked away believing it was cancelled, and on
  // pay-on-delivery that means food arriving to be paid for. So: await it, and
  // say which of the three things happened.
  // The outcome opens only once the "are you sure" card is gone: the request
  // can come back while it is still fading out (a fast 409, offline), and a
  // card presented then never shows on iOS.
  const foodConfirmGoneRef = useRef(true)
  const afterFoodConfirmGoneRef = useRef<(() => void) | null>(null)
  const runAfterFoodConfirmGone = (next: () => void) => {
    if (foodConfirmGoneRef.current) next()
    else afterFoodConfirmGoneRef.current = next
  }
  const handleFoodConfirmHidden = () => {
    foodConfirmGoneRef.current = true
    const next = afterFoodConfirmGoneRef.current
    afterFoodConfirmGoneRef.current = null
    next?.()
  }
  const confirmCancelFoodOrder = useCallback(async () => {
    if (isCancellingFood) return
    setCancellingFood(true)
    foodConfirmGoneRef.current = false
    setCancelModalVisible(false)
    try {
      await cancelJobForRescue({
        jobId,
        // A machine-readable marker rather than a sentence. The old string was
        // English prose written into cancelReasons regardless of the
        // customer's language, and the dashboard had no way to tell a customer
        // cancellation apart from any other free-text reason.
        reasons: [CUSTOMER_CANCELLED_FOOD_ORDER],
      }).unwrap()
      runAfterFoodConfirmGone(() => setCancelledModalVisible(true))
    } catch (e) {
      // 409 is the server saying the kitchen already started — the one failure
      // the customer can actually understand and act on, so it gets its own
      // message instead of the generic "an error occurred".
      //
      // 403 is the order being over (the restaurant ended it, the clock did, or
      // this same cancel already went through and the answer was lost): say so,
      // so the customer is not told "an error occurred" about an order that is
      // already dead. The screen under the sheet refetches by itself: cancelJob
      // invalidates Jobs, and RTK Query does that for a rejected mutation too
      // (the press test counts the order's requests, so a change there shows).
      // The exception is FOOD_ORDER_BUSY, also a 403: the order is fine and a
      // retry will work, so it keeps the generic message.
      const { status, data } = (e ?? {}) as {
        status?: number
        data?: { code?: string }
      }
      const code = data?.code
      const noLongerActive =
        code === "FOOD_ORDER_NOT_ACTIVE" ||
        (status === 403 && code !== "FOOD_ORDER_BUSY")
      const message = noLongerActive
        ? t("food_order_no_longer_active")
        : status === 409
          ? t("food_order_already_preparing")
          : t("an_error_occurred")
      runAfterFoodConfirmGone(() => {
        setFoodCancelError(message)
        setErrorModalVisible(true)
      })
    } finally {
      setCancellingFood(false)
    }
  }, [isCancellingFood, cancelJobForRescue, jobId, t])

  // What follows the find-pros card (the prefilled flow, or the error) runs
  // once the card is gone (its onModalHide), never in the same tick as the
  // close: an error card presented then never shows on iOS.
  const afterFindProsHiddenRef = useRef<(() => void) | null>(null)
  const handleFindProsHidden = () => {
    const next = afterFindProsHiddenRef.current
    afterFindProsHiddenRef.current = null
    next?.()
  }
  const handleConfirmFindOtherPros = useCallback(async () => {
    if (isRescueBusy) return
    setRescueBusy(true)
    try {
      // Close the dead request first (system reason — no reasons quiz for
      // the customer), then walk into the prefilled flow.
      await cancelJobForRescue({
        jobId,
        reasons: ["All selected pros declined — customer restarted the request"],
      }).unwrap()
      afterFindProsHiddenRef.current = () => repostFromJob(jobId)
      setFindProsModalVisible(false)
    } catch {
      afterFindProsHiddenRef.current = () => setErrorModalVisible(true)
      setFindProsModalVisible(false)
    } finally {
      setRescueBusy(false)
    }
  }, [isRescueBusy, cancelJobForRescue, jobId, repostFromJob])

  // The cancel flow's handoffs wait for each card to be GONE (its
  // onModalHide): a modal presented while another is still fading out can
  // fail to show on iOS, or leave an invisible window over the screen. The
  // feedback card cannot be closed while the request is in flight, so it is
  // still up when the result lands.
  const openFeedbackAfterConfirmHideRef = useRef(false)
  const afterFeedbackHideRef = useRef<(() => void) | null>(null)
  const cancel = useCancelJob({
    jobId,
    onSuccess: () => {
      // Say it worked before leaving. It used to pop straight back to whatever
      // pushed this screen, so the request just quietly changed state behind
      // the customer with nothing to confirm an irreversible action had landed
      // — and where they ended up depended on how they got here.
      afterFeedbackHideRef.current = () => setCancelledModalVisible(true)
      setCancelFeedbackVisible(false)
    },
    onError: () => {
      afterFeedbackHideRef.current = () => setErrorModalVisible(true)
      setCancelFeedbackVisible(false)
    },
  })
  const handleCancelFeedbackHide = () => {
    const next = afterFeedbackHideRef.current
    afterFeedbackHideRef.current = null
    next?.()
  }

  const handleCancelledAcknowledged = useCallback(() => {
    setCancelledModalVisible(false)
  }, [])

  // Leaving fires from the cancelled confirmation's onModalHide (both the
  // food and the regular one), so it runs only once the card has finished
  // tearing itself down: popping the screen while it is still fading out
  // pulls its window out from under the dismissal. Guarded on focus, since
  // popping the stack from a screen that is already leaving throws.
  const handleCancelledHidden = useCallback(() => {
    if (navigation.isFocused()) navigation.goBack()
  }, [navigation])

  const activePros = activeTab === "selected" ? selectedPros : otherPros

  const showBanner = useCallback((type: "new_offers" | "pro_moved") => {
    // Reset animation values
    bannerOpacity.setValue(0)
    bannerTranslateY.setValue(-20)
    setBannerType(type)

    Animated.parallel([
      Animated.timing(bannerOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(bannerTranslateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start()

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(bannerOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(bannerTranslateY, { toValue: -20, duration: 400, useNativeDriver: true }),
      ]).start(() => setBannerType(null))
    }, 3000)
  }, [])

  // Show "new offers" banner when offers load
  useEffect(() => {
    if (offersCount > 0) {
      const timer = setTimeout(() => showBanner("new_offers"), 500)
      return () => clearTimeout(timer)
    }
  }, [offersCount, showBanner])

  const categoryName = localJob?.serviceCategory
    ? isAr ? localJob?.serviceCategory.nameAr : localJob?.serviceCategory.nameEn
    : ""

  const handleGoBack = () => {
    navigation.goBack()
  }

  const handleAcceptOpportunity = useCallback((jobPro: JobProType) => {
    // Fire API call but don't await — update UI immediately
    respondToOpportunity({
      jobId: localJob?.id,
      proId: jobPro.proId,
      selectionStatus: "offer",
    }).unwrap().catch(() => {
      setErrorModalVisible(true)
    })

    // Animate card removal immediately
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setLocalJob((prev) => ({
      ...prev,
      pros: prev.pros?.map((p) =>
        p.proId === jobPro.proId
          ? { ...p, selectionStatus: "offer" as const, opportunityAcceptedAt: new Date().toISOString() }
          : p
      ),
    }))
    setTimeout(() => showBanner("pro_moved"), 400)
  }, [localJob?.id, respondToOpportunity, showBanner])

  const handleRejectOpportunity = useCallback((jobPro: JobProType) => {
    // Fire API but don't await — animate immediately
    respondToOpportunity({
      jobId: localJob?.id,
      proId: jobPro.proId,
      selectionStatus: "customerRejected",
    }).unwrap().catch(() => {
      setErrorModalVisible(true)
    })

    // Animate card removal + remaining cards move up
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setLocalJob((prev) => ({
      ...prev,
      pros: prev.pros?.map((p) =>
        p.proId === jobPro.proId
          ? { ...p, selectionStatus: "customerRejected" as const }
          : p
      ),
    }))
  }, [localJob?.id, respondToOpportunity])

  const handleOpenChat = async (jobPro: JobProType) => {
    if (!jobPro.pro) return
    try {
      const chat = await openChat({
        categoryId: localJob?.serviceCategoryId,
        recipientId: jobPro.proId,
        jobId: jobId,
      }).unwrap()

      navigation.navigate("MessagesDetailsScreen", {
        chatPreview: { chat, notReadMessages: 0 },
      })
    } catch (error) {
      setErrorModalVisible(true)
    }
  }

  const renderSelectedProCard = ({ item }: { item: JobProType }) => {
    const pro = item.pro
    if (!pro) return null

    const displayName = pro.businessName || pro.registeredName
    const photoUrl = pro.profilePhoto150 || pro.profilePhoto
    const isCompany = pro.proType === "company"
    const overallScore = pro.reviewScore?.overallScore || 0
    const reviewsCount = pro.reviewScore?.reviewsCount || 0
    const offerAmount = item.ratePerHour
    const isFeatured = pro.serviceCategories?.[0]?.isFeatured
    const unreadCount = getUnreadCount(item.proId)
    // Declined invited pro: the card stays (vanishing would gaslight the
    // customer) but reads as finished — dimmed, photo washed out, offer row
    // replaced by a plain status line, tap disabled.
    const isDeclined = item.selectionStatus === "proRejected"

    return (
      <DmView
        onPress={isDeclined ? undefined : () => handleOpenChat(item)}
        style={[a.p_14, isDeclined ? { opacity: 0.55 } : undefined]}
      >
        <DmView style={[a.flex_row, a.items_start]}>
          <DmView>
            <DmView style={[styles.box, a.overflow_hidden]}>
              {!!photoUrl && (
                <FastImage
                  source={{ uri: photoUrl }}
                  style={styles.profilePhoto}
                  resizeMode={FastImage.resizeMode.cover}
                />
              )}
              {isDeclined && (
                <DmView
                  style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(240,240,240,0.55)" }]}
                />
              )}
            </DmView>
            {isFeatured && (
              <DmView style={[a.absolute, styles.boxWrap, a.self_center]}>
                <DmView
                  style={[styles.featuredWrap, a.px_6, a.items_center, a.justify_center, styles.featuredBadgeBorder]}
                >
                  <Text size={10} weight="bold" style={styles.featured}>
                    {t("featured")}
                  </Text>
                </DmView>
              </DmView>
            )}
          </DmView>
          <DmView style={[a.flex_1, a.ml_10]}>
            <Text size={14} weight="bold" leading={px(16)} style={styles.nameMarginTop}>
              {displayName}
            </Text>
            <DmView style={[isAr ? a.mt_2 : a.mt_6, a.flex_row, a.items_center]}>
              {isCompany ? (
                <BusinessIcon width={14} height={14} />
              ) : (
                <IndividualIcon width={14} height={14} />
              )}
              <Text size={12} weight="medium" leading="tight" style={a.ml_4}>
                {t(isCompany ? "business" : "individual")}
              </Text>
            </DmView>
            <DmView style={isAr ? a.mt_2 : a.mt_8}>
              <RateComponent rate={overallScore} reviewsCount={reviewsCount} itemSize={11} />
            </DmView>
            {isDeclined ? (
              <Text
                size={12}
                color="tertiary"
                style={[isAr ? a.mt_2 : a.mt_8, { fontStyle: "italic", textAlign: "left" }]}
              >
                {t("pro_declined_this_job")}
              </Text>
            ) : (
              <DmView style={[isAr ? a.mt_2 : a.mt_8, a.flex_row, a.items_center, a.justify_between]}>
                <DmView style={[a.flex_row, a.items_center]}>
                  <DmView style={[a.px_8, styles.offerAmountWrap, a.mr_6, styles.offerBadgeBorder, { borderColor: colors.red }]}>
                    <Text size={12} weight="medium" leading="legacy">{t("offer_amount")}</Text>
                  </DmView>
                  <Text size={14} weight="bold" leading="legacy">
                    {offerAmount ? `${offerAmount} ${t("EGP")}` : t("no_offer_yet")}
                  </Text>
                </DmView>
                {unreadCount > 0 && (
                  <DmView>
                    <MailIcon width={22} height={16} />
                    <DmView style={[a.absolute, styles.textWrap, a.items_center, a.justify_center]}>
                      <Text size={9} weight="bold" leading="legacy" color="inverse">{unreadCount}</Text>
                    </DmView>
                  </DmView>
                )}
              </DmView>
            )}
          </DmView>
        </DmView>
        <DmView style={[a.mt_14, styles.box2]} />
      </DmView>
    )
  }

  const renderOtherProCard = ({ item }: { item: JobProType }) => {
    const pro = item.pro
    if (!pro) return null

    const displayName = pro.businessName || pro.registeredName
    const photoUrl = pro.profilePhoto150 || pro.profilePhoto
    const isCompany = pro.proType === "company"
    const overallScore = pro.reviewScore?.overallScore || 0
    const reviewsCount = pro.reviewScore?.reviewsCount || 0
    const isFeatured = pro.serviceCategories?.[0]?.isFeatured
    const subscriptions = pro.serviceCategories?.[0]?.subscriptions || []
    const trustDocs = pro.documents?.filter((d) => d.type === "trust" && d.status === "approved") || []

    return (
      <DmView style={a.p_12}>
        <ProCardBase
          displayName={displayName}
          photoUrl={photoUrl}
          isCompany={isCompany}
          overallScore={overallScore}
          reviewsCount={reviewsCount}
          isFeatured={isFeatured}
          trustDocs={trustDocs}
          subscriptions={subscriptions}
          offerAmount={item.ratePerHour}
          opportunityNotes={item.opportunityNotes}
          showOfferBadge
          showOpportunityNotes
          showSelectPassButtons={localJob?.status === "active" && item.selectionStatus !== "customerRejected"}
          isRejected={item.selectionStatus === "customerRejected"}
          isAr={isAr}
          onPress={() => navigation.navigate("ProProfileScreen", {
            proId: item.proId,
            serviceCategoryId: localJob?.serviceCategoryId,
            serviceCategories: pro.serviceCategories,
            ...(localJob?.status === "active" && { chatJobId: jobId }),
          })}
          onSelect={() => handleAcceptOpportunity(item)}
          onPass={() => handleRejectOpportunity(item)}
        />
      </DmView>
    )
  }

  if (isJobLoading || !localJob) {
    // Skeleton mirrors the real layout (header / tabs pill / heading / pro
    // cards) so loaded content lands in place instead of after a spinner
    // flash. The back button stays real — the user can always leave.
    return (
      <SafeAreaView style={[a.flex_1, styles.safeArea]}>
        <DmView style={[a.flex_row, a.items_center, a.px_16, a.py_12]}>
          <DmView
            style={[styles.iconWrap, a.items_center, a.justify_center]}
            hitSlop={HIT_SLOP_DEFAULT}
            onPress={handleGoBack}
          >
            <ChevronLeftIcon
              color={colors.red}
              style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
            />
          </DmView>
          <DmView style={[a.flex_1, a.items_center]}>
            <SkeletonLoader width={130} height={16} borderRadius={4} />
            <SkeletonLoader width={90} height={11} borderRadius={4} />
          </DmView>
          <DmView style={styles.iconWrap} />
        </DmView>
        <DmView style={[a.items_center, a.mt_14]}>
          <SkeletonLoader width="85%" height={42} borderRadius={8} />
        </DmView>
        <DmView style={[a.mt_12, styles.box2]} />
        <DmView style={[a.px_16, a.pt_18]}>
          <SkeletonLoader width={140} height={18} borderRadius={4} />
          <SkeletonLoader width={230} height={13} borderRadius={4} />
          {[0, 1].map((i) => (
            <DmView key={i} style={[a.flex_row, a.mt_22]}>
              <SkeletonLoader width={85} height={85} borderRadius={4} />
              <DmView style={[a.flex_1, a.ml_12]}>
                <SkeletonLoader width="55%" height={15} borderRadius={4} />
                <SkeletonLoader width="35%" height={12} borderRadius={4} />
                <SkeletonLoader width="45%" height={12} borderRadius={4} />
                <SkeletonLoader width="30%" height={16} borderRadius={8} />
              </DmView>
            </DmView>
          ))}
        </DmView>
      </SafeAreaView>
    )
  }

  // Food (hasMenu) orders: order-centric body — status timeline + itemized
  // breakdown. The pros tabs/offers machinery doesn't apply to a menu order.
  if (localJob?.foodOrderItems?.length) {
    return (
      <SafeAreaView style={[a.flex_1, styles.safeArea]}>
        <Animated.View style={{ flex: 1, opacity: contentFade }}>
          <DmView style={[a.flex_row, a.items_center, a.px_16, a.py_12]}>
            <DmView
              style={[styles.iconWrap, a.items_center, a.justify_center]}
              hitSlop={HIT_SLOP_DEFAULT}
              onPress={handleGoBack}
            >
              <ChevronLeftIcon
                color={colors.red}
                style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
              />
            </DmView>
            <DmView style={[a.flex_1, a.items_center]}>
              <Text size={16} weight="semibold" leading="legacy">
                {categoryName}
              </Text>
              <Text size={11} leading="legacy" color="tertiary">
                {t("order")}: {jobId}
              </Text>
            </DmView>
            <DmView
              style={[styles.iconWrap, a.items_center, a.justify_center]}
              hitSlop={HIT_SLOP_DEFAULT}
              onPress={() => setFoodMenuVisible(true)}
            >
              <DmView style={a.flex_row}>
                <DmView style={styles.box3} />
                <DmView style={styles.box3} />
                <DmView style={styles.box3} />
              </DmView>
            </DmView>
          </DmView>
          <DmView style={styles.box2} />
          <MainModal
            isVisible={isCancelModalVisible}
            onClose={() => setCancelModalVisible(false)}
            Icon={<TrashRedIcon width={40} height={40} />}
            title={t("are_you_sure_cancel")}
            isBtnsTwo
            titleBtn={t("yes")}
            titleBtnSecond={t("no")}
            onPress={confirmCancelFoodOrder}
            onPressSecond={() => setCancelModalVisible(false)}
            onModalHide={handleFoodConfirmHidden}
            isLoading={isCancellingFood}
            titleType={{ size: 14, leading: px(22) }}
            titleStyle={styles.mainModalTitle}
            btnsStyle={styles.mainModalBtns}
            btnsWrapperStyle={[a.mt_20, styles.mainModalBtnsWrapper]}
            modalStyle={styles.mainModalModal}
          />
          <JobMenuSheet
            isVisible={isFoodMenuVisible}
            onClose={() => setFoodMenuVisible(false)}
            onShowDetails={() => {
              setFoodMenuVisible(false)
              setTimeout(
                () => navigation.navigate("RequestDetailsScreen", { jobId }),
                400
              )
            }}
            cancelLabel={t("cancel_order")}
            onCancel={
              canCancelFoodOrder(localJob) ? handleCancelFoodOrder : undefined
            }
          />
          <FoodOrderView
            job={localJob}
            // The order payload carries no chat data; the chats cache does.
            unreadCount={getUnreadCount(localJob.pros?.[0]?.proId ?? -1)}
            onOpenChat={
              localJob.pros?.[0]
                ? () => handleOpenChat(localJob.pros![0])
                : undefined
            }
          />

          {/* Both of these existed only in the service branch below, so the
              food path could set their state and have nothing render — which
              is how a failed cancel became invisible. They live here too now. */}
          {/* Leaving is tied to acknowledging, and the navigation happens in
              onModalHide rather than in the button handler. Navigating from
              the press handler unmounted this screen mid-fade and once left
              the backdrop behind — a screen showing the right data with
              nothing on it clickable. Waiting for the modal to actually be
              gone is what makes the transition safe.

              goBack, not a reset: the mutation already invalidated Jobs, so
              Talabati is showing the cancelled state by the time we land. */}
          <MainModal
            isVisible={isCancelledModalVisible}
            onClose={() => setCancelledModalVisible(false)}
            onPress={() => setCancelledModalVisible(false)}
            onModalHide={handleCancelledHidden}
            Icon={<TrashRedIcon width={40} height={40} />}
            title={t("order_cancelled")}
            descr={t("order_cancelled_descr")}
            titleBtn={t("done")}
            titleType={{ size: 14, leading: px(22) }}
            titleStyle={styles.mainModalTitle}
            actionBtnStyle={styles.mainModalBtns}
            modalStyle={styles.mainModalModal}
          />
          <ErrorModal
            isVisible={isErrorModalVisible}
            onClose={() => {
              setErrorModalVisible(false)
              setFoodCancelError(null)
            }}
            descr={foodCancelError ?? t("an_error_occurred")}
          />
        </Animated.View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[a.flex_1, styles.safeArea]}>
      <Animated.View style={{ flex: 1, opacity: contentFade }}>
      {/* Header */}
      <DmView style={[a.flex_row, a.items_center, a.px_16, a.py_12]}>
        <DmView
          style={[styles.iconWrap, a.items_center, a.justify_center]}
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={handleGoBack}
        >
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView style={[a.flex_1, a.items_center]}>
          <Text size={16} weight="semibold" leading="legacy">
            {categoryName}
          </Text>
          <Text size={11} leading="legacy" color="tertiary">
            {t("request_id")}: {jobId}
          </Text>
        </DmView>
        <DmView
          style={[styles.iconWrap, a.items_center, a.justify_center]}
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={() => {
            setMenuVisible(true)
            prefetchJobDetails(jobId, { ifOlderThan: 60 })
          }}
        >
          <DmView style={a.flex_row}>
            <DmView style={styles.box3} />
            <DmView style={styles.box3} />
            <DmView style={styles.box3} />
          </DmView>
        </DmView>
      </DmView>

      {/* Tabs */}
      <DmView style={[a.items_center, a.mt_14]}>
        <DmView style={styles.tabsWrapper}>
          {/* OFFERS badge centered above Other Pros half */}
          <DmView
            style={[a.absolute, styles.textWrap2, a.px_8, styles.offersBadgeShadow, { left: 205 }]}
          >
            <Text size={9} weight="bold" leading="legacy" color="inverse">
              {t("offers").toUpperCase()}
            </Text>
          </DmView>

          <DmView
            style={[a.flex_row, styles.tabContainer]}
          >
            <DmView
              style={[a.flex_1, a.items_center, a.justify_center, {
                backgroundColor: activeTab === "selected" ? "#4A4A4A" : "transparent",
                borderRadius: 5,
              }]}
              onPress={() => setActiveTab("selected")}
            >
              <Text size={12} weight="semibold" leading="legacy" color={activeTab === "selected" ? "inverse" : "primary"}>
                {t("selected_pros_tab")}
              </Text>
            </DmView>
            <DmView
              style={[a.flex_1, a.items_center, a.justify_center, {
                backgroundColor: activeTab === "other" ? "#4A4A4A" : "transparent",
                borderRadius: 5,
              }]}
              onPress={() => setActiveTab("other")}
            >
              <Text size={12} weight="semibold" leading="legacy" color={activeTab === "other" ? "inverse" : "primary"}>
                {t("other_pros_tab")}
              </Text>
            </DmView>
          </DmView>
        </DmView>
      </DmView>

      <DmView style={[a.mt_12, styles.box2]} />

      {/* Rescue status card (Claude Design "Concept B"): sits between the
          tabs and the section header, in the screen's card language. Icon
          tile + title/subtitle explain the state; the red pill carries the
          action. Row auto-mirrors under forceRTL, chevron flips. */}
      {(isEnded || isStranded) && (
        <DmView
          style={[a.mx_16, a.mt_12, a.flex_row, a.items_center, styles.rescueCard]}
        >
          <DmView style={[a.items_center, a.justify_center, styles.rescueIconTile]}>
            {isEnded ? (
              <ClockRedIcon width={20} height={20} />
            ) : (
              <UsersRedIcon width={20} height={20} />
            )}
          </DmView>
          <DmView style={[a.flex_1, a.mx_12]}>
            <Text
              size={13}
              weight="bold"
              leading={px(17)}
              style={{ textAlign: "left" }}
            >
              {isEnded ? t("request_ended") : t("pros_declined_banner")}
            </Text>
            <Text
              size={11}
              color="secondary"
              style={[a.mt_2, { textAlign: "left" }]}
            >
              {isEnded ? t("request_ended_descr") : t("pros_declined_descr")}
            </Text>
          </DmView>
          <DmView
            style={[styles.textWrap3, a.px_16, styles.rescuePill]}
            onPress={
              isEnded
                ? () => repostFromJob(jobId)
                : () => setFindProsModalVisible(true)
            }
          >
            <Text size={12} weight="semibold" leading="tight" color="inverse">
              {`${isEnded ? t("repost") : t("find_pros")} ${isAr ? "‹" : "›"}`}
            </Text>
          </DmView>
        </DmView>
      )}

      {/* Animated banner — "new offers" or "pro moved" */}
      {bannerType && (
        <Animated.View
          style={{
            opacity: bannerOpacity,
            transform: [{ translateY: bannerTranslateY }],
            position: "absolute",
            top: 168,
            ...(bannerType === "new_offers" ? { right: 30 } : { left: 30 }),
            zIndex: 10,
          }}
        >
          {/* Triangle pointer */}
          <DmView
            style={{
              ...styles.bannerTriangleBase,
              ...(bannerType === "new_offers"
                ? { alignSelf: "flex-end", marginRight: 40 }
                : { alignSelf: "flex-start", marginLeft: 40 }),
              borderBottomColor: colors.red,
            }}
          />
          <DmView
            style={[a.px_28, a.py_14, styles.textWrap4, { backgroundColor: colors.red }]}
          >
            <Text size={12} weight="semibold" leading="legacy" color="inverse">
              {bannerType === "new_offers"
                ? t("you_received_new_offers")
                : t("pro_moved_to_selected")}
            </Text>
          </DmView>
        </Animated.View>
      )}

      {/* Pro list */}
      <AppFlatList
        data={activePros}
        renderItem={activeTab === "other" ? renderOtherProCard : renderSelectedProCard}
        keyExtractor={(item) => String(item.proId)}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        ListHeaderComponent={
          <DmView style={[a.px_14, a.mt_16, a.mb_8]}>
            <Text size={16} weight="semibold" leading="legacy">
              {activeTab === "selected" ? t("selected_pros_tab") : t("other_pros_tab")}
            </Text>
            <Text size={12} leading="legacy" color="tertiary" style={a.mt_2}>
              {activeTab === "selected"
                ? t("the_pros_you_selected")
                : t("other_pros_who_sent_offers")}
            </Text>
          </DmView>
        }
        ListEmptyComponent={
          <DmView style={[a.items_center, a.justify_center, a.py_40]}>
            <Text size={14} leading="legacy" color="tertiary">
              {activeTab === "selected" ? t("no_selected_pros") : t("no_offers_yet")}
            </Text>
          </DmView>
        }
      />
      <ErrorModal
        isVisible={isErrorModalVisible}
        onClose={() => {
          setErrorModalVisible(false)
          setFoodCancelError(null)
        }}
        descr={foodCancelError ?? t("an_error_occurred")}
      />

      {/* Cancelled confirmation. Leaving is deliberately tied to acknowledging
          it, so the screen cannot pop out from under the message. goBack rather
          than a reset: the Jobs cache is already invalidated, so wherever they
          came from is showing the cancelled state by the time they land. */}
      <MainModal
        isVisible={isCancelledModalVisible}
        onClose={handleCancelledAcknowledged}
        onPress={handleCancelledAcknowledged}
        onModalHide={handleCancelledHidden}
        Icon={<TrashRedIcon width={40} height={40} />}
        title={t("job_cancelled")}
        descr={t("job_cancelled_descr")}
        titleBtn={t("done")}
        titleType={{ size: 14, leading: px(22) }}
        titleStyle={styles.mainModalTitle}
        actionBtnStyle={styles.mainModalBtns}
        modalStyle={styles.mainModalModal}
      />

      {/* Cancel confirmation modal */}
      <MainModal
        isVisible={isCancelModalVisible}
        onClose={() => setCancelModalVisible(false)}
        Icon={<TrashRedIcon width={40} height={40} />}
        title={t("are_you_sure_cancel")}
        isBtnsTwo
        titleBtn={t("yes")}
        titleBtnSecond={t("no")}
        onPress={() => {
          openFeedbackAfterConfirmHideRef.current = true
          setCancelModalVisible(false)
        }}
        onPressSecond={() => setCancelModalVisible(false)}
        onModalHide={() => {
          if (openFeedbackAfterConfirmHideRef.current) {
            openFeedbackAfterConfirmHideRef.current = false
            setCancelFeedbackVisible(true)
          }
        }}
        titleType={{ size: 14, leading: px(22) }}
        titleStyle={styles.mainModalTitle}
        btnsStyle={styles.mainModalBtns}
        btnsWrapperStyle={[a.mt_20, styles.mainModalBtnsWrapper]}
        modalStyle={styles.mainModalModal}
      />

      {/* Find-other-pros confirmation: the cancel is irreversible, so say
          exactly what happens in plain words before firing it */}
      <MainModal
        isVisible={isFindProsModalVisible}
        onClose={() => !isRescueBusy && setFindProsModalVisible(false)}
        title={t("find_other_pros")}
        descr={t("find_other_pros_confirm_descr")}
        isBtnsTwo
        titleBtn={t("yes")}
        titleBtnSecond={t("no")}
        onPress={handleConfirmFindOtherPros}
        onPressSecond={() => !isRescueBusy && setFindProsModalVisible(false)}
        onModalHide={handleFindProsHidden}
        titleType={{ size: 14, leading: px(22) }}
        titleStyle={styles.mainModalTitle}
        btnsStyle={styles.mainModalBtns}
        btnsWrapperStyle={[a.mt_20, styles.mainModalBtnsWrapper]}
        modalStyle={styles.mainModalModal}
      />

      {/* Cancel feedback modal — shared with the chat's ••• menu */}
      <CancelJobFeedbackModal
        isVisible={isCancelFeedbackVisible}
        onClose={() => setCancelFeedbackVisible(false)}
        onModalHide={handleCancelFeedbackHide}
        cancel={cancel}
      />

      {/* Three dots bottom sheet menu — same component the food body uses */}
      <JobMenuSheet
        isVisible={isMenuVisible}
        onClose={() => setMenuVisible(false)}
        onShowDetails={() => {
          setMenuVisible(false)
          setTimeout(
            () => navigation.navigate("RequestDetailsScreen", { jobId }),
            400
          )
        }}
        cancelLabel={t("cancel_service_request")}
        onCancel={
          localJob?.status === "active"
            ? () => {
                setMenuVisible(false)
                setTimeout(() => setCancelModalVisible(true), 400)
              }
            : undefined
        }
      />
      </Animated.View>
    </SafeAreaView>
  )
}

export default JobDetailScreen
