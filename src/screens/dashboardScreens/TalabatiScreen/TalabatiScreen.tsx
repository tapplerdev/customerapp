import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  Animated as RNAnimated,
  Easing,
  Image,
  RefreshControl,
  ViewToken,
} from "react-native"
import Animated, { FadeIn } from "react-native-reanimated"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { format } from "date-fns"

import { DmView } from "@tappler/shared/src/components/UI"
import { api, useGetCustomerJobsQuery } from "services/api"
import { useTypedSelector } from "store"
import { JobType } from "types/job"
import { RootStackParamList } from "navigation/types"
import colors from "@tappler/shared/src/styles/colors"

import LottieView from "lottie-react-native"

// lottie-react-native 7 does NOT wrap its own view in Animated — there is no
// createAnimatedComponent anywhere in the package — so handing `progress` an
// Animated.Value directly passes the object straight through to a native
// Float prop and the animation sits on frame 0. Wrapping it here is what makes
// the shared clock below actually drive it.
const AnimatedLottieView = RNAnimated.createAnimatedComponent(LottieView)
import leaveReviewAnimation from "assets/animations/leave-review.json"
import LeaveReviewModal from "components/LeaveReviewModal/LeaveReviewModal"
import { foodOrderEnd, isReviewableJobPro } from "utils/foodOrderState"
import TalabatiSkeleton from "./TalabatiSkeleton"
import styles from "./styles"
import { AppFlatList } from "components/scroll"
import { Text, Button, a } from "@tappler/shared/src/ds"

const TalabatiScreen: React.FC = () => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { isAuth } = useTypedSelector((store) => store.auth)

  const { data, isLoading, refetch, isFetching, isError } = useGetCustomerJobsQuery(undefined, {
    skip: !isAuth,
    pollingInterval: 30000, // Poll every 30s for new pro responses
  })

  const jobs = data?.data || []

  // The pull-down spinner tracks ONLY a user's pull. Binding it to isFetching
  // animated the RefreshControl down on every background refresh — the 30s
  // poll and every socket-driven Jobs invalidation read as a phantom pull.
  const [isPullRefreshing, setPullRefreshing] = useState(false)
  // One clock for every star on screen.
  //
  // Each LottieView was autoPlay+loop, which starts playback when that view
  // MOUNTS — and FlatList mounts rows in separate batches, so every row began
  // its 2.94s loop at a different moment and sat at a different frame. The
  // result was a column of stars visibly out of step: the top one still an
  // outline while the ones below it were filled.
  //
  // Driving them all from a single Animated.Value via `progress` means they
  // render the same frame no matter when their row mounted, was recycled, or
  // scrolled into view. useNativeDriver keeps it off the JS thread, so the
  // stars do not stutter while the list is scrolling.
  const starProgress = useRef(new RNAnimated.Value(0)).current
  useEffect(() => {
    const animation = RNAnimated.loop(
      RNAnimated.timing(starProgress, {
        toValue: 1,
        // The animation's own length: 88 frames at 29.97fps.
        duration: 2940,
        easing: Easing.linear,
        // JS-driven on purpose. `progress` is a codegen'd Float prop rather
        // than a style, and the native driver refuses props it does not know,
        // at runtime rather than at build time. Animated still updates it via
        // setNativeProps, so this does not re-render the list — it is a prop
        // write per frame on a 2.94s decorative loop.
        useNativeDriver: false,
      })
    )
    animation.start()
    return () => animation.stop()
  }, [starProgress])

  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true)
    try {
      await refetch()
    } finally {
      setPullRefreshing(false)
    }
  }, [refetch])

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

  // A food order's real state lives on jobPro, not on job.status, and this
  // list has to say the same thing the order screen says about the same order.
  // Both ask foodOrderEnd (utils/foodOrderState), which reads the job and the
  // restaurant's row, because a restaurant refusing leaves job.status `active`
  // (right for a service request, where other pros can still take it; a food
  // order has one restaurant and nothing further can happen) and a restaurant
  // that cancels AFTER accepting used to fall through to "Active" in green
  // while the order screen said "Cancelled" in red.
  //
  // Three ways an order dies read as "Cancelled" here and on the order screen:
  // the customer's cancel, the restaurant's, and moderation (which used to read
  // "Expired" in this list). The clock's end reads "Expired" or "Closed", as it
  // does on the order screen.
  const foodOrderState = (job: JobType) =>
    job.serviceCategory?.hasMenu && job.pros?.length ? foodOrderEnd(job) : null

  const getStatusColor = (job: JobType) => {
    const foodState = foodOrderState(job)
    if (foodState === "expired" || foodState === "closed") return "#707070"
    if (foodState) return colors.red
    switch (job.status) {
      case "declined":
      case "cancelledByPro":
        return colors.red
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
    const foodState = foodOrderState(job)
    if (foodState === "declined") return t("order_declined_by_restaurant")
    if (foodState === "expired") return t("expired")
    if (foodState === "closed") return t("closed")
    if (foodState) return t("cancelled")
    switch (job.status) {
      // Reuses the food label rather than a bare t("declined"), which does not
      // exist in either locale file here — i18next has no missing-key handler,
      // so it would print the literal string "declined", untranslated, inside
      // an Arabic sentence. Reached only when the pro rows are not loaded or
      // are empty, since the predicate above answers every case that has them.
      case "declined":
        return t("order_declined_by_restaurant")
      // The restaurant pulled an order it had accepted. The predicate above
      // normally answers this first (it sees jobPro.status === "cancelled"),
      // so this is the belt-and-braces path for a job whose pro rows are not
      // loaded — without it, `default` would print the raw "cancelledByPro"
      // straight into the list, in English, inside an Arabic sentence.
      case "cancelledByPro":
        return t("cancelled")
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

  // A service request is reviewable once an offer is accepted; a food order
  // only once it is delivered (isReviewableJobPro). "Leave review" used to show
  // from Accepted on, and on a cancelled order.
  const hasPendingReview = (job: JobType) => {
    return job.pros?.some((p) => isReviewableJobPro(job, p)) || false
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
      isReviewableJobPro(reviewModalJob, p)
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
          style={[a.px_16, a.py_14]}
          onPress={() => handleJobPress(item)}
        >
          {/* Service name */}
          <Text size={15} weight="bold" leading="legacy">
            {getCategoryName(item)}
          </Text>

          {/* Status */}
          <DmView style={styles.rowContainer}>
            <Text size={12} leading="legacy">
              {t("status")}:{" "}
              <Text size={12} weight="medium" leading="legacy" style={{ color: getStatusColor(item) }}>
                {getStatusLabel(item)}
              </Text>
            </Text>
          </DmView>

          {/* Area */}
          {!!area && (
            <DmView style={styles.rowContainer}>
              <Text size={12} leading="legacy">
                {t("area")}: {area}
              </Text>
            </DmView>
          )}

          {/* Posted date + Offers badge */}
          <DmView style={styles.postedRow}>
            <Text size={12} leading="legacy">
              {t("posted")}: {format(new Date(item.requestedOn), "dd MMMM yyyy h:mma")}
            </Text>
            {offersCount > 0 && (
              <DmView
                style={[a.flex_row, a.items_center, styles.row, styles.offersBadge]}
              >
                <Text size={11} weight="semibold" leading="legacy" style={styles.offers}>
                  {t("offers")}
                </Text>
                <DmView style={[styles.textWrap, a.items_center, a.justify_center]}>
                  <Text size={10} weight="bold" leading="legacy" color="inverse">
                    {offersCount}
                  </Text>
                </DmView>
              </DmView>
            )}
          </DmView>

          {/* Leave Review button */}
          {pendingReview && (
            <DmView style={[a.mt_10, a.flex_row, a.items_center]}>
              <DmView
                style={[a.flex_row, a.items_center, styles.row2, a.overflow_hidden, { borderWidth: 0.75, borderColor: "#000" }]}
                onPress={() => handleLeaveReview(item)}
              >
                <DmView style={[a.px_10, styles.leaveReviewWrap, { backgroundColor: "#FFEBEBB2" }]}>
                  <Text size={11} weight="semibold" leading="legacy">
                    {t("leave_review")}
                  </Text>
                </DmView>
                <DmView style={[a.px_8, styles.leaveReviewWrap, a.overflow_hidden, a.items_center, a.justify_center, { width: 32, height: 26 }]}>
                  <AnimatedLottieView
                    source={leaveReviewAnimation}
                    progress={starProgress}
                    style={{ width: 60, height: 60 }}
                  />
                </DmView>
              </DmView>
            </DmView>
          )}

          {/* Inset separator */}
          <DmView style={[a.mt_14, styles.box]} />
        </DmView>
      )
    },
    [isAr, starProgress]
  )

  return (
    <SafeAreaView style={[a.flex_1, styles.safeArea]}>
      {/* Header */}
      <DmView style={[a.px_16, a.py_14]}>
        <Text size={18} weight="semibold" leading="legacy" align="center">
          {t("talabati")}
        </Text>
      </DmView>
      <DmView style={styles.box2} />

      {!isAuth ? (
        <DmView style={[a.flex_1, a.items_center, a.justify_center, a.px_40]}>
          <Text size={16} weight="semibold" leading="legacy" color="tertiary" align="center">
            {t("login_to_view_requests")}
          </Text>
          <Text size={12} leading="legacy" color="tertiary" align="center" style={a.mt_8}>
            {t("login_to_view_requests_descr")}
          </Text>
          <DmView style={[a.mt_20, a.px_20, a.w_full]}>
            <Button
              title={t("log_In")}
              onPress={() => navigation.navigate("SignInEmailScreen")}
              label={14}
              labelWeight="semibold"
              labelLeading="legacy"
            />
          </DmView>
        </DmView>
      ) : isLoading ? (
        <TalabatiSkeleton />
      ) : isError && !data ? (
        // Fetch failed with nothing cached — a timeout is not "no requests"
        <DmView style={[a.flex_1, a.items_center, a.justify_center, a.px_40]}>
          <Text size={16} weight="semibold" leading="legacy" color="tertiary" align="center">
            {t("requests_load_error")}
          </Text>
          <Text size={12} leading="legacy" color="tertiary" align="center" style={a.mt_8}>
            {t("requests_load_error_descr")}
          </Text>
          <DmView style={[a.mt_20, a.px_20, a.w_full]}>
            <Button
              title={t("try_again")}
              onPress={refetch}
              isLoading={isFetching}
              label={14}
              labelWeight="semibold"
              labelLeading="legacy"
            />
          </DmView>
        </DmView>
      ) : jobs.length === 0 ? (
        <DmView style={[a.flex_1, a.items_center, a.justify_center, a.px_40]}>
          <Text size={16} weight="semibold" leading="legacy" color="tertiary" align="center">
            {t("no_requests_yet")}
          </Text>
          <Text size={12} leading="legacy" color="tertiary" align="center" style={a.mt_8}>
            {t("no_requests_yet_descr")}
          </Text>
        </DmView>
      ) : (
        <Animated.View entering={FadeIn.duration(400)} style={a.flex_1}>
        <AppFlatList
          data={jobs}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          // Opts back OUT of the app-wide alwaysBounceVertical:false default
          // (components/scroll). Pull-to-refresh works by pulling PAST the
          // top, so with the bounce suppressed a customer with only one or two orders —
          // a list short enough to fit the screen — would have nothing to pull
          // and no way to refresh at all.
          alwaysBounceVertical
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          refreshControl={
            <RefreshControl
              refreshing={isPullRefreshing}
              onRefresh={handlePullRefresh}
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
