import React, { useCallback, useEffect, useRef, useState } from "react"
import { Animated, FlatList, LayoutAnimation, Platform, TextInput, UIManager } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useIsFocused } from "@react-navigation/native"
import FastImage from "react-native-fast-image"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
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
import Modal from "react-native-modal"
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
  const confirmCancelFoodOrder = useCallback(async () => {
    if (isCancellingFood) return
    setCancellingFood(true)
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
      setTimeout(() => setCancelledModalVisible(true), 400)
    } catch (e) {
      // 409 is the server saying the kitchen already started — the one failure
      // the customer can actually understand and act on, so it gets its own
      // message instead of the generic "an error occurred".
      const status = (e as { status?: number })?.status
      setFoodCancelError(
        status === 409 ? t("food_order_already_preparing") : t("an_error_occurred")
      )
      setErrorModalVisible(true)
    } finally {
      setCancellingFood(false)
    }
  }, [isCancellingFood, cancelJobForRescue, jobId, t])

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
      setFindProsModalVisible(false)
      repostFromJob(jobId)
    } catch {
      setFindProsModalVisible(false)
      setErrorModalVisible(true)
    } finally {
      setRescueBusy(false)
    }
  }, [isRescueBusy, cancelJobForRescue, jobId, repostFromJob])

  const cancel = useCancelJob({
    jobId,
    onSuccess: () => {
      // Say it worked before leaving. It used to pop straight back to whatever
      // pushed this screen, so the request just quietly changed state behind
      // the customer with nothing to confirm an irreversible action had landed
      // — and where they ended up depended on how they got here.
      setCancelFeedbackVisible(false)
      setTimeout(() => setCancelledModalVisible(true), 400)
    },
    onError: () => {
      setCancelFeedbackVisible(false)
      setErrorModalVisible(true)
    },
  })

  const handleCancelledAcknowledged = useCallback(() => {
    setCancelledModalVisible(false)
    navigation.goBack()
  }, [navigation])

  // Fires from the food confirmation's onModalHide, so it runs only once the
  // modal has finished tearing itself down. Guarded on the modal actually
  // being closed: onModalHide also fires on unmount, and popping the stack
  // from an unmounting screen throws.
  const handleFoodCancelledAcknowledged = useCallback(() => {
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
        className="px-[14] py-[14]"
        onPress={isDeclined ? undefined : () => handleOpenChat(item)}
        style={isDeclined ? { opacity: 0.55 } : undefined}
      >
        <DmView className="flex-row items-start">
          <DmView>
            <DmView className="w-[85] h-[85] rounded-2 overflow-hidden bg-grey8">
              {!!photoUrl && (
                <FastImage
                  source={{ uri: photoUrl }}
                  style={styles.profilePhoto}
                  resizeMode={FastImage.resizeMode.cover}
                />
              )}
              {isDeclined && (
                <DmView
                  className="absolute top-0 left-0 right-0 bottom-0"
                  style={{ backgroundColor: "rgba(240,240,240,0.55)" }}
                />
              )}
            </DmView>
            {isFeatured && (
              <DmView className="absolute top-[-8] self-center">
                <DmView
                  className="h-[18] px-[6] rounded-5 bg-yellow items-center justify-center"
                  style={styles.featuredBadgeBorder}
                >
                  <DmText className="text-10 leading-[13px] font-custom700 uppercase">
                    {t("featured")}
                  </DmText>
                </DmView>
              </DmView>
            )}
          </DmView>
          <DmView className="flex-1 ml-[10]">
            <DmText className="text-14 leading-[16px] font-custom700 text-black" style={styles.nameMarginTop}>
              {displayName}
            </DmText>
            <DmView className={`${isAr ? "mt-[2]" : "mt-[6]"} flex-row items-center`}>
              {isCompany ? (
                <BusinessIcon width={14} height={14} />
              ) : (
                <IndividualIcon width={14} height={14} />
              )}
              <DmText className="ml-[4] text-12 leading-[15px] font-custom500">
                {t(isCompany ? "business" : "individual")}
              </DmText>
            </DmView>
            <DmView className={isAr ? "mt-[2]" : "mt-[8]"}>
              <RateComponent rate={overallScore} reviewsCount={reviewsCount} itemSize={11} />
            </DmView>
            {isDeclined ? (
              <DmText
                className={`${isAr ? "mt-[2]" : "mt-[8]"} text-12 leading-[16px] font-custom400 text-grey3`}
                style={{ fontStyle: "italic", textAlign: "left" }}
              >
                {t("pro_declined_this_job")}
              </DmText>
            ) : (
              <DmView className={`${isAr ? "mt-[2]" : "mt-[8]"} flex-row items-center justify-between`}>
                <DmView className="flex-row items-center">
                  <DmView className="px-[8] py-[3] mr-[6]" style={[styles.offerBadgeBorder, { borderColor: colors.red }]}>
                    <DmText className="text-12 font-custom500">{t("offer_amount")}</DmText>
                  </DmView>
                  <DmText className="text-14 font-custom700 text-black">
                    {offerAmount ? `${offerAmount} ${t("EGP")}` : t("no_offer_yet")}
                  </DmText>
                </DmView>
                {unreadCount > 0 && (
                  <DmView>
                    <MailIcon width={22} height={16} />
                    <DmView className="absolute top-[-8] right-[-8] w-[18] h-[18] rounded-full bg-red items-center justify-center">
                      <DmText className="text-9 font-custom700 text-white">{unreadCount}</DmText>
                    </DmView>
                  </DmView>
                )}
              </DmView>
            )}
          </DmView>
        </DmView>
        <DmView className="mt-[14] h-[0.5] bg-grey19" />
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
      <DmView className="px-[12] py-[12]">
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
      <SafeAreaView className="flex-1 bg-white">
        <DmView className="flex-row items-center px-[16] py-[12]">
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
            <SkeletonLoader width={130} height={16} borderRadius={4} />
            <SkeletonLoader width={90} height={11} borderRadius={4} className="mt-[6]" />
          </DmView>
          <DmView className="w-[32] h-[32]" />
        </DmView>
        <DmView className="items-center mt-[14]">
          <SkeletonLoader width="85%" height={42} borderRadius={8} />
        </DmView>
        <DmView className="mt-[12] h-[0.5] bg-grey19" />
        <DmView className="px-[16] pt-[18]">
          <SkeletonLoader width={140} height={18} borderRadius={4} />
          <SkeletonLoader width={230} height={13} borderRadius={4} className="mt-[8]" />
          {[0, 1].map((i) => (
            <DmView key={i} className="flex-row mt-[22]">
              <SkeletonLoader width={85} height={85} borderRadius={4} />
              <DmView className="flex-1 ml-[12]">
                <SkeletonLoader width="55%" height={15} borderRadius={4} />
                <SkeletonLoader width="35%" height={12} borderRadius={4} className="mt-[8]" />
                <SkeletonLoader width="45%" height={12} borderRadius={4} className="mt-[8]" />
                <SkeletonLoader width="30%" height={16} borderRadius={8} className="mt-[10]" />
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
      <SafeAreaView className="flex-1 bg-white">
        <Animated.View style={{ flex: 1, opacity: contentFade }}>
          <DmView className="flex-row items-center px-[16] py-[12]">
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
              <DmText className="text-16 font-custom600 text-black">
                {categoryName}
              </DmText>
              <DmText className="text-11 font-custom400 text-grey3">
                {t("order")}: {jobId}
              </DmText>
            </DmView>
            <DmView
              className="w-[32] h-[32] items-center justify-center"
              hitSlop={HIT_SLOP_DEFAULT}
              onPress={() => setFoodMenuVisible(true)}
            >
              <DmView className="flex-row">
                <DmView className="bg-black rounded-full w-[5] h-[5] mx-[1]" />
                <DmView className="bg-black rounded-full w-[5] h-[5] mx-[1]" />
                <DmView className="bg-black rounded-full w-[5] h-[5] mx-[1]" />
              </DmView>
            </DmView>
          </DmView>
          <DmView className="h-[0.5] bg-grey19" />
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
            isLoading={isCancellingFood}
            classNameTitle="mt-[17] text-14 leading-[22px] font-custom600"
            classNameBtns="h-[40]"
            classNameBtnsWrapper="mt-[20] mx-[15]"
            classNameModal="px-[17]"
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
              is how a failed cancel became invisible. They live here too now.

              Unlike the service confirmation, this one does NOT pop the screen:
              the order is still worth looking at once cancelled (what was in
              it, what the restaurant was) and FoodOrderView renders its own
              cancelled state in place. */}
          {/* Leaving is tied to acknowledging, and the navigation happens in
              onModalHide rather than in the button handler. react-native-modal
              tears its backdrop down on its own timeline; navigating from the
              press handler unmounted this screen mid-animation and left the
              backdrop behind — a screen showing the right data with nothing on
              it clickable. Waiting for the modal to actually be gone is what
              makes the transition safe.

              goBack, not a reset: the mutation already invalidated Jobs, so
              Talabati is showing the cancelled state by the time we land. */}
          <MainModal
            isVisible={isCancelledModalVisible}
            onClose={() => setCancelledModalVisible(false)}
            onPress={() => setCancelledModalVisible(false)}
            onModalHide={handleFoodCancelledAcknowledged}
            Icon={<TrashRedIcon width={40} height={40} />}
            title={t("order_cancelled")}
            descr={t("order_cancelled_descr")}
            titleBtn={t("done")}
            classNameTitle="mt-[17] text-14 leading-[22px] font-custom600"
            classNameBtn="h-[40]"
            classNameModal="px-[17]"
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
    <SafeAreaView className="flex-1 bg-white">
      <Animated.View style={{ flex: 1, opacity: contentFade }}>
      {/* Header */}
      <DmView className="flex-row items-center px-[16] py-[12]">
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
          <DmText className="text-16 font-custom600 text-black">
            {categoryName}
          </DmText>
          <DmText className="text-11 font-custom400 text-grey3">
            {t("request_id")}: {jobId}
          </DmText>
        </DmView>
        <DmView
          className="w-[32] h-[32] items-center justify-center"
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={() => {
            setMenuVisible(true)
            prefetchJobDetails(jobId, { ifOlderThan: 60 })
          }}
        >
          <DmView className="flex-row">
            <DmView className="bg-black rounded-full w-[5] h-[5] mx-[1]" />
            <DmView className="bg-black rounded-full w-[5] h-[5] mx-[1]" />
            <DmView className="bg-black rounded-full w-[5] h-[5] mx-[1]" />
          </DmView>
        </DmView>
      </DmView>

      {/* Tabs */}
      <DmView className="items-center mt-[14]">
        <DmView style={styles.tabsWrapper}>
          {/* OFFERS badge centered above Other Pros half */}
          <DmView
            className="absolute top-[-12] bg-red px-[8] py-[3] rounded-3 z-10"
            style={[styles.offersBadgeShadow, { left: 205 }]}
          >
            <DmText className="text-9 font-custom700 text-white">
              {t("offers").toUpperCase()}
            </DmText>
          </DmView>

          <DmView
            className="flex-row"
            style={styles.tabContainer}
          >
            <DmView
              className="flex-1 items-center justify-center"
              style={{
                backgroundColor: activeTab === "selected" ? "#4A4A4A" : "transparent",
                borderRadius: 5,
              }}
              onPress={() => setActiveTab("selected")}
            >
              <DmText className={`text-12 font-custom600 ${activeTab === "selected" ? "text-white" : "text-black"}`}>
                {t("selected_pros_tab")}
              </DmText>
            </DmView>
            <DmView
              className="flex-1 items-center justify-center"
              style={{
                backgroundColor: activeTab === "other" ? "#4A4A4A" : "transparent",
                borderRadius: 5,
              }}
              onPress={() => setActiveTab("other")}
            >
              <DmText className={`text-12 font-custom600 ${activeTab === "other" ? "text-white" : "text-black"}`}>
                {t("other_pros_tab")}
              </DmText>
            </DmView>
          </DmView>
        </DmView>
      </DmView>

      <DmView className="mt-[12] h-[0.5] bg-grey19" />

      {/* Rescue status card (Claude Design "Concept B"): sits between the
          tabs and the section header, in the screen's card language. Icon
          tile + title/subtitle explain the state; the red pill carries the
          action. Row auto-mirrors under forceRTL, chevron flips. */}
      {(isEnded || isStranded) && (
        <DmView
          className="mx-[16] mt-[12] flex-row items-center"
          style={styles.rescueCard}
        >
          <DmView className="items-center justify-center" style={styles.rescueIconTile}>
            {isEnded ? (
              <ClockRedIcon width={20} height={20} />
            ) : (
              <UsersRedIcon width={20} height={20} />
            )}
          </DmView>
          <DmView className="flex-1 mx-[12]">
            <DmText
              className="text-13 leading-[17px] font-custom700 text-black"
              style={{ textAlign: "left" }}
            >
              {isEnded ? t("request_ended") : t("pros_declined_banner")}
            </DmText>
            <DmText
              className="mt-[2] text-11 leading-[15px] font-custom400 text-grey2"
              style={{ textAlign: "left" }}
            >
              {isEnded ? t("request_ended_descr") : t("pros_declined_descr")}
            </DmText>
          </DmView>
          <DmView
            className="rounded-full px-[16] py-[9]"
            style={styles.rescuePill}
            onPress={
              isEnded
                ? () => repostFromJob(jobId)
                : () => setFindProsModalVisible(true)
            }
          >
            <DmText className="text-12 leading-[15px] font-custom600 text-white">
              {`${isEnded ? t("repost") : t("find_pros")} ${isAr ? "‹" : "›"}`}
            </DmText>
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
            className="px-[28] py-[14] rounded-10"
            style={{ backgroundColor: colors.red }}
          >
            <DmText className="text-12 font-custom600 text-white">
              {bannerType === "new_offers"
                ? t("you_received_new_offers")
                : t("pro_moved_to_selected")}
            </DmText>
          </DmView>
        </Animated.View>
      )}

      {/* Pro list */}
      <FlatList
        data={activePros}
        renderItem={activeTab === "other" ? renderOtherProCard : renderSelectedProCard}
        keyExtractor={(item) => String(item.proId)}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        ListHeaderComponent={
          <DmView className="px-[14] mt-[16] mb-[8]">
            <DmText className="text-16 font-custom600 text-black">
              {activeTab === "selected" ? t("selected_pros_tab") : t("other_pros_tab")}
            </DmText>
            <DmText className="mt-[2] text-12 font-custom400 text-grey3">
              {activeTab === "selected"
                ? t("the_pros_you_selected")
                : t("other_pros_who_sent_offers")}
            </DmText>
          </DmView>
        }
        ListEmptyComponent={
          <DmView className="items-center justify-center py-[40]">
            <DmText className="text-14 font-custom400 text-grey3">
              {activeTab === "selected" ? t("no_selected_pros") : t("no_offers_yet")}
            </DmText>
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
        Icon={<TrashRedIcon width={40} height={40} />}
        title={t("job_cancelled")}
        descr={t("job_cancelled_descr")}
        titleBtn={t("done")}
        classNameTitle="mt-[17] text-14 leading-[22px] font-custom600"
        classNameBtn="h-[40]"
        classNameModal="px-[17]"
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
          setCancelModalVisible(false)
          setTimeout(() => setCancelFeedbackVisible(true), 400)
        }}
        onPressSecond={() => setCancelModalVisible(false)}
        classNameTitle="mt-[17] text-14 leading-[22px] font-custom600"
        classNameBtns="h-[40]"
        classNameBtnsWrapper="mt-[20] mx-[15]"
        classNameModal="px-[17]"
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
        classNameTitle="mt-[17] text-14 leading-[22px] font-custom600"
        classNameBtns="h-[40]"
        classNameBtnsWrapper="mt-[20] mx-[15]"
        classNameModal="px-[17]"
      />

      {/* Cancel feedback modal — shared with the chat's ••• menu */}
      <CancelJobFeedbackModal
        isVisible={isCancelFeedbackVisible}
        onClose={() => setCancelFeedbackVisible(false)}
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
