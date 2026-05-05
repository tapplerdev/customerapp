import React, { useCallback, useRef, useState } from "react"
import { FlatList, Image, RefreshControl, ViewToken } from "react-native"
import Animated, { FadeIn } from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { format } from "date-fns"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { api, useGetCustomerJobsQuery } from "services/api"
import { useTypedSelector } from "store"
import { JobType } from "types/job"
import { RootStackParamList } from "navigation/types"
import colors from "@tappler/shared/src/styles/colors"

import LottieView from "lottie-react-native"
import leaveReviewAnimation from "assets/animations/leave-review.json"
import LeaveReviewModal from "components/LeaveReviewModal/LeaveReviewModal"
import TalabatiSkeleton from "./TalabatiSkeleton"
import styles from "./styles"

const TalabatiScreen: React.FC = () => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { isAuth } = useTypedSelector((store) => store.auth)

  const { data, isLoading, refetch, isFetching } = useGetCustomerJobsQuery(undefined, { skip: !isAuth })

  const jobs = data?.data || []

  // Prefetch job details as items become visible on screen
  const prefetchJobById = api.usePrefetch("getCustomerJobById")
  const prefetchedIds = useRef(new Set<number>())

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    viewableItems.forEach((token) => {
      const job = token.item as JobType
      if (job?.id && !prefetchedIds.current.has(job.id)) {
        prefetchedIds.current.add(job.id)
        prefetchJobById(job.id, { ifOlderThan: 60 })
      }
    })
  }, [prefetchJobById])

  const getStatusColor = (job: JobType) => {
    switch (job.status) {
      case "active":
        return "#00BC3A"
      case "completed":
        return "#00BC3A"
      case "cancelled":
        return colors.red
      case "cancelledByTappler":
      case "ended":
        return "#707070"
      default:
        return "#707070"
    }
  }

  const getStatusLabel = (job: JobType) => {
    switch (job.status) {
      case "active":
        return t("active")
      case "completed":
        return t("completed")
      case "cancelled":
        return t("cancelled")
      case "cancelledByTappler":
      case "ended":
        return t("expired")
      default:
        return job.status
    }
  }

  const getCategoryName = (job: JobType) => {
    if (!job.serviceCategory) return ""
    return isAr ? job.serviceCategory.nameAr : job.serviceCategory.nameEn
  }

  const getArea = (job: JobType) => {
    return job.address?.address?.city || ""
  }

  const getOffersCount = (job: JobType) => {
    return job.pros?.filter((p) =>
      p.selectionStatus === "opportunity" ||
      (p.selectionStatus === "offer" && !!p.proOpportunityOfferSentAt && !p.opportunityAcceptedAt)
    ).length || 0
  }

  const hasPendingReview = (job: JobType) => {
    return job.pros?.some((p) =>
      p.selectionStatus === "offer" && !p.review
    ) || false
  }

  const [reviewModalJob, setReviewModalJob] = useState<JobType | null>(null)

  const handleJobPress = (job: JobType) => {
    navigation.navigate("JobDetailScreen", { jobId: job.id })
  }

  const handleLeaveReview = (job: JobType) => {
    setReviewModalJob(job)
  }

  const handleReviewModalConfirm = () => {
    if (!reviewModalJob) return
    setReviewModalJob(null)

    const reviewablePros = reviewModalJob.pros?.filter((p) =>
      p.selectionStatus === "offer" && !p.review
    ) || []

    if (reviewablePros.length === 1) {
      // Single pro — skip selection, go to form
      navigation.navigate("ReviewFormScreen", { jobId: reviewModalJob.id, proId: reviewablePros[0].proId })
    } else {
      // Multiple pros — show selection screen
      navigation.navigate("ReviewProSelectionScreen", { jobId: reviewModalJob.id })
    }
  }

  const renderItem = useCallback(
    ({ item, index }: { item: JobType; index: number }) => {
      const offersCount = getOffersCount(item)
      const area = getArea(item)
      const pendingReview = hasPendingReview(item)

      return (
        <DmView
          className="px-[16] py-[14]"
          onPress={() => handleJobPress(item)}
        >
          {/* Service name */}
          <DmText className="text-15 font-custom700 text-black">
            {getCategoryName(item)}
          </DmText>

          {/* Status */}
          <DmView style={styles.rowContainer}>
            <DmText className="text-12 font-custom400 text-black">
              {t("status")}:{" "}
              <DmText className="text-12 font-custom500" style={{ color: getStatusColor(item) }}>
                {getStatusLabel(item)}
              </DmText>
            </DmText>
          </DmView>

          {/* Area */}
          {!!area && (
            <DmView style={styles.rowContainer}>
              <DmText className="text-12 font-custom400 text-black">
                {t("area")}: {area}
              </DmText>
            </DmView>
          )}

          {/* Posted date + Offers badge */}
          <DmView style={styles.postedRow}>
            <DmText className="text-12 font-custom400 text-black">
              {t("posted")}: {format(new Date(item.requestedOn), "dd MMMM yyyy h:mma")}
            </DmText>
            {offersCount > 0 && (
              <DmView
                className="flex-row items-center rounded-full"
                style={styles.offersBadge}
              >
                <DmText className="text-11 font-custom600 text-black mr-[5]">
                  {t("offers")}
                </DmText>
                <DmView className="w-[20] h-[20] rounded-full bg-red items-center justify-center">
                  <DmText className="text-10 font-custom700 text-white">
                    {offersCount}
                  </DmText>
                </DmView>
              </DmView>
            )}
          </DmView>

          {/* Leave Review button */}
          {pendingReview && (
            <DmView className="mt-[10] flex-row items-center">
              <DmView
                className="flex-row items-center rounded-4 overflow-hidden"
                style={{ borderWidth: 0.75, borderColor: "#000" }}
                onPress={() => handleLeaveReview(item)}
              >
                <DmView className="px-[10] py-[5]" style={{ backgroundColor: "#FFEBEBB2" }}>
                  <DmText className="text-11 font-custom600 text-black">
                    {t("leave_review")}
                  </DmText>
                </DmView>
                <DmView className="px-[8] py-[5] overflow-hidden items-center justify-center" style={{ width: 32, height: 26 }}>
                  <LottieView
                    source={leaveReviewAnimation}
                    autoPlay
                    loop
                    style={{ width: 60, height: 60 }}
                  />
                </DmView>
              </DmView>
            </DmView>
          )}

          {/* Inset separator */}
          <DmView className="mt-[14] h-[0.5] bg-grey19" />
        </DmView>
      )
    },
    [isAr]
  )

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <DmView className="px-[16] py-[14]">
        <DmText className="text-18 font-custom600 text-black text-center">
          {t("talabati")}
        </DmText>
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      {!isAuth ? (
        <DmView className="flex-1 items-center justify-center px-[40]">
          <DmText className="text-16 font-custom600 text-grey3 text-center">
            {t("login_to_view_requests")}
          </DmText>
          <DmText className="mt-[8] text-12 font-custom400 text-grey3 text-center">
            {t("login_to_view_requests_descr")}
          </DmText>
          <DmView className="mt-[20] px-[20] w-full">
            <ActionBtn
              title={t("log_In")}
              onPress={() => navigation.navigate("SignInEmailScreen")}
              textClassName="text-14 font-custom600"
            />
          </DmView>
        </DmView>
      ) : isLoading ? (
        <TalabatiSkeleton />
      ) : jobs.length === 0 ? (
        <DmView className="flex-1 items-center justify-center px-[40]">
          <DmText className="text-16 font-custom600 text-grey3 text-center">
            {t("no_requests_yet")}
          </DmText>
          <DmText className="mt-[8] text-12 font-custom400 text-grey3 text-center">
            {t("no_requests_yet_descr")}
          </DmText>
        </DmView>
      ) : (
        <Animated.View entering={FadeIn.duration(400)} className="flex-1">
        <FlatList
          data={jobs}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={colors.red}
            />
          }
        />
        </Animated.View>
      )}

      {/* Leave Review Modal */}
      <LeaveReviewModal
        isVisible={!!reviewModalJob}
        onClose={() => setReviewModalJob(null)}
        onLeaveReview={handleReviewModalConfirm}
        categoryName={
          reviewModalJob?.serviceCategory
            ? isAr ? reviewModalJob.serviceCategory.nameAr : reviewModalJob.serviceCategory.nameEn
            : ""
        }
      />
    </SafeAreaView>
  )
}

export default TalabatiScreen
