import React, { useCallback, useEffect, useRef, useState } from "react"
import { Animated, FlatList, LayoutAnimation, Platform, TextInput, UIManager } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import FastImage from "react-native-fast-image"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { api, useGetChatsQuery, useGetCustomerJobByIdQuery, useLazyOpenChatQuery, useRespondToOpportunityMutation } from "services/api"
import useJobPros from "hooks/useJobPros"
import useCancelJob from "hooks/useCancelJob"
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
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"
import Modal from "react-native-modal"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import DetailsIcon from "assets/icons/details-icon.svg"
import TrashRedIcon from "assets/icons/trash-red.svg"
import CancelFeedbackIcon from "assets/icons/cancel-feedback.svg"
import styles from "./styles"

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

type Props = RootStackScreenProps<"JobDetailScreen">

const JobDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { jobId } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const { data: job, isLoading: isJobLoading } = useGetCustomerJobByIdQuery(jobId)
  const insets = useSafeAreaInsets()
  const [isMenuVisible, setMenuVisible] = useState(false)
  const [isCancelModalVisible, setCancelModalVisible] = useState(false)
  const [isCancelFeedbackVisible, setCancelFeedbackVisible] = useState(false)
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

  // Sync local state when RTK cache updates (e.g. after mutation invalidation)
  useEffect(() => {
    if (job) setLocalJob(job)
  }, [job])
  const [bannerType, setBannerType] = useState<"new_offers" | "pro_moved" | null>(null)

  // Banner animation
  const bannerOpacity = useRef(new Animated.Value(0)).current
  const bannerTranslateY = useRef(new Animated.Value(-20)).current

  const { selectedPros, otherPros, offersCount } = useJobPros(localJob?.pros)

  const cancel = useCancelJob({
    jobId,
    onSuccess: () => {
      setCancelFeedbackVisible(false)
      navigation.goBack()
    },
    onError: () => {
      setCancelFeedbackVisible(false)
      setErrorModalVisible(true)
    },
  })

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

  const handleRejectOpportunity = useCallback(async (jobPro: JobProType) => {
    try {
      await respondToOpportunity({
        jobId: localJob?.id,
        proId: jobPro.proId,
        selectionStatus: "customerRejected",
      }).unwrap()
      // Update local state
      setLocalJob((prev) => ({
        ...prev,
        pros: prev.pros?.map((p) =>
          p.proId === jobPro.proId
            ? { ...p, selectionStatus: "customerRejected" as const }
            : p
        ),
      }))
    } catch (error) {
      setErrorModalVisible(true)
    }
  }, [localJob?.id, respondToOpportunity, t])

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

    return (
      <DmView className="px-[14] py-[14]" onPress={() => handleOpenChat(item)}>
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
            <DmView className={`${isAr ? "mt-[2]" : "mt-[8]"} flex-row items-center justify-between`}>
              <DmView className="flex-row items-center">
                <DmView className="px-[8] py-[3] mr-[6]" style={[styles.offerBadgeBorder, { borderColor: colors.red }]}>
                  <DmText className="text-12 font-custom500">{t("offer_amount")}</DmText>
                </DmView>
                <DmText className="text-14 font-custom700 text-black">
                  {offerAmount ? `${offerAmount} EGP` : t("no_offer_yet")}
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
    return <LoadingOverlay />
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
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
        onClose={() => setErrorModalVisible(false)}
        descr={t("an_error_occurred")}
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

      {/* Cancel feedback modal */}
      <Modal
        isVisible={isCancelFeedbackVisible}
        onBackdropPress={() => setCancelFeedbackVisible(false)}
        className="m-0 items-center justify-center"
        animationIn="fadeIn"
        animationOut="fadeOut"
        backdropTransitionOutTiming={0}
      >
        <DmView className="mx-[24] self-stretch">
          {/* Close X — outside modal card */}
          <DmView
            className="self-end mb-[10]"
            onPress={() => setCancelFeedbackVisible(false)}
          >
            <DmText className="text-22 text-white">✕</DmText>
          </DmView>

          <DmView className="bg-white rounded-12 px-[20] pt-[24] pb-[20]">
          {/* Icon */}
          <DmView className="items-center">
            <CancelFeedbackIcon width={60} height={60} />
          </DmView>

          <DmText className="mt-[12] text-16 font-custom700 text-black text-center">
            {t("your_opinion_matters")}
          </DmText>

          <DmText className="mt-[12] text-13 font-custom600 text-black">
            {t("what_is_reason_cancellation")}
          </DmText>

          {/* Reason options */}
          {cancel.cancelReasons.map((reason) => (
            <DmView
              key={reason}
              className="flex-row items-center mt-[12]"
              onPress={() => cancel.toggleReason(reason)}
            >
              <DmView
                className={`w-[22] h-[22] rounded-full border-1 items-center justify-center ${
                  cancel.selectedReasons.includes(reason) ? "border-red" : "border-grey1"
                }`}
              >
                {cancel.selectedReasons.includes(reason) && (
                  <DmView className="w-[12] h-[12] rounded-full bg-red" />
                )}
              </DmView>
              <DmText className="ml-[10] text-13 font-custom400 text-black flex-1">
                {t(reason)}
              </DmText>
            </DmView>
          ))}

          {/* Other reason text input */}
          {cancel.hasOtherSelected && (
            <TextInput
              value={cancel.otherReasonText}
              onChangeText={cancel.setOtherReasonText}
              placeholder={t("write_other_reason")}
              placeholderTextColor="#999"
              multiline
              className="mt-[12] border-1 border-grey5 rounded-4 px-[12] py-[10] text-13 min-h-[70]"
              style={{ textAlignVertical: "top" }}
            />
          )}

          {/* Submit */}
          <DmView className="mt-[16]">
            <ActionBtn
              title={t("submit")}
              onPress={cancel.handleSubmitCancel}
              disable={!cancel.canSubmit}
              isLoading={cancel.isSubmitting}
              className="h-[42]"
              textClassName="text-13 font-custom600"
            />
          </DmView>
          </DmView>
        </DmView>
      </Modal>

      {/* Three dots bottom sheet menu */}
      <Modal
        isVisible={isMenuVisible}
        onBackdropPress={() => setMenuVisible(false)}
        className="m-0 justify-end"
        animationIn="slideInUp"
        animationOut="slideOutDown"
        hardwareAccelerated
        statusBarTranslucent
        backdropTransitionOutTiming={0}
        hideModalContentWhileAnimating
      >
        <DmView className="bg-white rounded-t-12" style={{ paddingBottom: insets.bottom + 2 }}>
          <DmView className="self-center w-[40] h-[4] rounded-full bg-grey19 mt-[10] mb-[14]" />

          <DmView
            className="flex-row items-center px-[18] py-[14]"
            onPress={() => {
              setMenuVisible(false)
              setTimeout(() => navigation.navigate("RequestDetailsScreen", { jobId }), 400)
            }}
          >
            <DetailsIcon width={20} height={24} />
            <DmText className="ml-[14] text-14 leading-[18px] font-custom500 text-black">
              {t("my_request_details")}
            </DmText>
          </DmView>

          {localJob?.status === "active" && (
            <>
              <DmView className="h-[0.7] bg-grey19" style={{ marginStart: 18 }} />
              <DmView
                className="flex-row items-center px-[18] py-[14]"
                onPress={() => {
                  setMenuVisible(false)
                  setTimeout(() => setCancelModalVisible(true), 400)
                }}
              >
                <TrashRedIcon width={20} height={24} />
                <DmText className="ml-[14] text-14 leading-[18px] font-custom500 text-black">
                  {t("cancel_service_request")}
                </DmText>
              </DmView>
            </>
          )}
        </DmView>
      </Modal>
    </SafeAreaView>
  )
}

export default JobDetailScreen
