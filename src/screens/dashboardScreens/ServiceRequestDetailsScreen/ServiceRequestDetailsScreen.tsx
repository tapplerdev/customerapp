import React, { useState } from "react"
import { Pressable, StyleSheet } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmChecbox, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import { useGetServiceByIdQuery, useLazyGetProsForCategoryQuery } from "services/api"
import { QuestionAnswerType } from "types/job"
import { MainModal } from "@tappler/shared/src/components"
import { questionFlowEventBus } from "events/questionFlowEventBus"
import QuestionComponent from "components/QuestionComponent/QuestionComponent"
import CalendarTimeSheet from "components/CalendarTimeSheet/CalendarTimeSheet"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import CloseIcon from "assets/icons/close.svg"
import { AppScrollView } from "components/scroll"
import { Text, Button, a as atoms, px } from "@tappler/shared/src/ds"
import dsStyles from "./styles"

type DateTypeOption = "notDecided" | "hours48" | "week" | "furtherOut" | "specificDates"

// Whether a row really answers a question of that type. A bare row
// ({questionId}: an un-ticked choice, a cleared date) does not, and a job sent
// with one fails the backend's answer validation.
const ANSWER_CHECKS: Partial<Record<string, (answer: QuestionAnswerType) => boolean>> = {
  shortAnswer: (a) => !!a.answer,
  paragraph: (a) => !!a.answer,
  oneChoice: (a) => !!a.optionId,
  multipleChoice: (a) => !!a.optionsIds?.length,
  dateTime: (a) => !!a.date || !!a.startDate,
  files: (a) => !!a.files?.length,
}

type Props = RootStackScreenProps<"ServiceRequestDetailsScreen">

const ServiceRequestDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    categoryId, categoryName, serviceId, selectedProIds,
    selectedProNames, selectedProsInfo, address, placeOfService,
    answeredQuestions, initialAnsweredIds, stepIndex = 0,
  } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()

  // Fetch service to get questions
  const { data: service, isLoading } = useGetServiceByIdQuery(serviceId)
  const category = service?.categories?.find((c) => c.id === categoryId)
  const customerQuestions = category?.customerQuestions || []

  // The questions answered before this flow started (carried over from
  // ProsListingScreen) are skipped. Only rows that really answer their
  // question count, so a bare row is asked here instead of reaching the job.
  const answeredIds = (answeredQuestions || [])
    .filter((answer) => {
      const question = customerQuestions.find((q) => q.id === answer.questionId)
      const check = question && ANSWER_CHECKS[question.type]
      return !check || check(answer)
    })
    .map((answer) => answer.questionId)
  // Stays stable across pushes — we don't re-filter as new answers accumulate
  const fixedAnsweredIds = new Set(initialAnsweredIds || answeredIds)
  const unansweredQuestions = customerQuestions.filter((q) => !fixedAnsweredIds.has(q.id))

  // Only show date step if category has dateTypes configured
  const hasDateTypes = (category?.dateTypes?.length || 0) > 0
  const totalSteps = unansweredQuestions.length + (hasDateTypes ? 1 : 0)
  const isDateStep = hasDateTypes && stepIndex >= unansweredQuestions.length
  const currentQuestion = !isDateStep ? unansweredQuestions[stepIndex] : undefined
  const progress = totalSteps > 0 ? (stepIndex + 1) / totalSteps : 1

  // Local answer for this step
  const [questionsAnswers, setQuestionsAnswers] = useState<QuestionAnswerType[]>(
    () => answeredQuestions || []
  )

  // Date/time state
  const [selectedDateOption, setSelectedDateOption] = useState<DateTypeOption | undefined>()
  const [selectedDate, setSelectedDate] = useState<string | undefined>()
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ start: string; end: string } | undefined>()
  const [isCalendarVisible, setCalendarVisible] = useState(false)

  const handleChangeAnswer = (newAnswer: QuestionAnswerType) => {
    setQuestionsAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === newAnswer.questionId)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = newAnswer
        return updated
      }
      return [...prev, newAnswer]
    })
  }

  const getBackendDateType = () => {
    if (!selectedDateOption) return undefined
    if (selectedDateOption === "notDecided") return "notDecided"
    if (selectedDateOption === "hours48") return "hours48"
    if (selectedDateOption === "week") return "week"
    if (selectedDateOption === "furtherOut" || selectedDateOption === "specificDates") return "date"
    return undefined
  }

  // Shared nav params for pushing next step
  const sharedParams = {
    categoryId, categoryName, serviceId, selectedProIds,
    selectedProNames, selectedProsInfo, address, placeOfService,
  }

  // Compute once on first mount: the IDs that were answered before we started
  const stableInitialIds = initialAnsweredIds || answeredIds

  // ── Mismatch guard ───────────────────────────────────────────────────────
  // The only filter questions asked here are ones the customer SKIPPED before
  // selecting pros (answered ones are carried over and never re-asked). A
  // late filter answer can therefore exclude a selected pro — and a pro who
  // doesn't match the answers cannot be submitted to. Check before advancing;
  // on mismatch, block, explain, and pop back to the (still-mounted) listing,
  // which merges the answers and prunes the selection.
  const [checkPros] = useLazyGetProsForCategoryQuery()
  const [isMismatchVisible, setMismatchVisible] = useState(false)
  const [isCheckingMatch, setCheckingMatch] = useState(false)

  const collectFilterOptionIds = (answers: QuestionAnswerType[]): number[] => {
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
    return ids
  }

  const proceedNext = () => {
    if (stepIndex < totalSteps - 1) {
      // Push the same screen with next stepIndex — native stack transition
      navigation.push("ServiceRequestDetailsScreen", {
        ...sharedParams,
        answeredQuestions: questionsAnswers,
        initialAnsweredIds: stableInitialIds,
        stepIndex: stepIndex + 1,
      })
    } else {
      // Last step (date) — navigate to summary
      navigation.navigate("RequestSummaryScreen", {
        ...sharedParams,
        questionsAnswers,
        dateType: getBackendDateType(),
        selectedDate,
        selectedTimeSlot,
      })
    }
  }

  const handleNext = async () => {
    if (currentQuestion?.isFilter && selectedProIds.length) {
      const filterIds = collectFilterOptionIds(questionsAnswers)
      if (filterIds.length) {
        setCheckingMatch(true)
        try {
          const skipAddress =
            placeOfService === "remoteOrOnline" || placeOfService === "fixedLocations"
          const customerAddress =
            skipAddress || !address?.coords
              ? undefined
              : { latitude: address.coords.lat, longitude: address.coords.lon }
          const res = await checkPros(
            { categoryId, placeOfService, customerAddress, filterOptionsIds: filterIds },
            true
          ).unwrap()
          const stillMatching = new Set((res?.data ?? []).map((p) => p.id))
          const excluded = selectedProIds.filter((id) => !stillMatching.has(id))
          if (excluded.length) {
            // Deliberately vague — no names: "certain pros" keeps it neutral
            setMismatchVisible(true)
            return
          }
        } catch {
          // Fail-open here — the backend performs the same check at submission
        } finally {
          setCheckingMatch(false)
        }
      }
    }
    proceedNext()
  }

  const handleMismatchConfirm = () => {
    setMismatchVisible(false)
    // The listing is still mounted below this stack — hand it the final
    // answers (it refetches + prunes the selection), then pop back to it.
    questionFlowEventBus.emit("details:answersChanged", { answers: questionsAnswers })
    navigation.popTo("ProsListingScreen", {
      categoryId,
      categoryName,
      serviceId,
      address,
      placeOfService,
    })
  }

  const handleBack = () => {
    navigation.goBack()
  }

  const handleClose = () => {
    // Pop all the way back to ProsListingScreen
    navigation.popToTop()
  }

  const handleSelectDateOption = (option: DateTypeOption) => {
    setSelectedDateOption(option)
    if (option !== "furtherOut" && option !== "specificDates") {
      setSelectedDate(undefined)
      setSelectedTimeSlot(undefined)
    }
    if (option === "furtherOut" || option === "specificDates") {
      setCalendarVisible(true)
    }
  }

  const handleCalendarConfirm = (date: string, timeSlot?: { start: string; end: string }) => {
    setCalendarVisible(false)
    if (date) {
      setSelectedDate(date)
      setSelectedTimeSlot(timeSlot)
    }
  }

  // Check if current step is answered
  const isCurrentAnswered = (() => {
    if (isDateStep) {
      // These two are answered by the calendar, not by ticking the option:
      // closing the calendar without a date leaves the step open.
      if (selectedDateOption === "furtherOut" || selectedDateOption === "specificDates") {
        return !!selectedDate
      }
      return !!selectedDateOption
    }
    if (!currentQuestion) return true
    const answer = questionsAnswers.find((a) => a.questionId === currentQuestion.id)
    const check = ANSWER_CHECKS[currentQuestion.type]
    return !!answer && !!check && check(answer)
  })()

  // Filter date options based on what the category supports
  const allowedBackendTypes = new Set(category?.dateTypes || [])

  const allDateOptions: { key: DateTypeOption; label: string; backendType: string }[] = [
    { key: "notDecided", label: t("havent_decided_yet"), backendType: "notDecided" },
    { key: "hours48", label: t("within_48_hours"), backendType: "hours48" },
    { key: "week", label: t("within_a_week"), backendType: "week" },
    { key: "furtherOut", label: t("further_out"), backendType: "date" },
    { key: "specificDates", label: t("specific_dates"), backendType: "date" },
  ]

  const dateOptions = allDateOptions.filter((opt) => allowedBackendTypes.has(opt.backendType))

  const renderDateStep = () => (
    <DmView style={atoms.px_14}>
      <Text size={22} weight="bold" leading={px(28)} style={atoms.mb_24}>
        {t("when_do_you_need_job")}
      </Text>
      {dateOptions.map((option) => (
        <DmView key={option.key}>
          <DmChecbox
            style={atoms.py_14}
            textType={{ size: 14, leading: "normal", weight: "regular" }}
            textStyle={atoms.flex_1}
            variant="circle"
            title={option.label}
            onPress={() => handleSelectDateOption(option.key)}
            isChecked={selectedDateOption === option.key}
          />
          {selectedDateOption === option.key && selectedDate && (
            <DmView style={[dsStyles.textWrap, atoms.mb_8]}>
              {/* DmText's own wrapper for a pressable text: a Pressable that gets
                  only the handler, around a Text that gets none. */}
              <Pressable onPress={() => setCalendarVisible(true)}>
                <Text size={13} weight="medium" leading="tight" color="brand">
                  {selectedDate}{selectedTimeSlot ? `  •  ${selectedTimeSlot.start} - ${selectedTimeSlot.end}` : ""}
                </Text>
              </Pressable>
            </DmView>
          )}
        </DmView>
      ))}
    </DmView>
  )

  if (isLoading) {
    return <LoadingOverlay />
  }

  // Edge case: no steps at all (no unanswered questions + no dateTypes)
  if (totalSteps === 0) {
    navigation.navigate("RequestSummaryScreen", {
      ...sharedParams,
      questionsAnswers,
    })
    return null
  }

  return (
    <SafeAreaView style={[atoms.flex_1, dsStyles.safeArea]} edges={["top"]}>
      {/* Header */}
      <DmView style={[atoms.flex_row, atoms.items_center, atoms.px_16, atoms.py_12]}>
        <DmView
          style={[dsStyles.iconWrap, atoms.items_center, atoms.justify_center]}
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={handleBack}
        >
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView style={[atoms.flex_1, atoms.items_center]}>
          <Text size={16} weight="semibold" leading="legacy">
            {t("details")}
          </Text>
        </DmView>
        <DmView
          style={[dsStyles.iconWrap, atoms.items_center, atoms.justify_center]}
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={handleClose}
        >
          <CloseIcon width={16} height={16} color={colors.black} />
        </DmView>
      </DmView>

      {/* Progress bar */}
      <DmView style={dsStyles.boxWrap}>
        <DmView
          style={[dsStyles.box, { width: `${Math.round(progress * 100)}%` }]}
        />
      </DmView>

      {/* Question or date step content */}
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 28, paddingBottom: 20, flexGrow: 1 }}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {isDateStep ? renderDateStep() : (
          currentQuestion && (
            <QuestionComponent
              key={currentQuestion.id}
              item={currentQuestion}
              onChangeAnswer={handleChangeAnswer}
              answers={questionsAnswers}
            />
          )
        )}
      </AppScrollView>

      {/* Bottom button */}
      <DmView
        style={[atoms.px_16, dsStyles.buttonWrap, styles.buttonShadow, { paddingBottom: insets.bottom + 16 }]}
      >
        <Button
          title={stepIndex === totalSteps - 1 ? t("continue") : t("next")}
          onPress={handleNext}
          isLoading={isCheckingMatch}
          disabled={!isCurrentAnswered}
          size={px(52)}
          shape="r10"
          labelWeight="semibold"
        />
      </DmView>

      {/* Calendar sheet */}
      <CalendarTimeSheet
        isVisible={isCalendarVisible}
        onClose={() => setCalendarVisible(false)}
        onConfirm={handleCalendarConfirm}
        hideSpecialOptions
      />

      {/* A pro who doesn't match the answers cannot be submitted to — no
          "keep anyway". One button: back to the (pruned) shortlist. */}
      <MainModal
        isVisible={isMismatchVisible}
        onClose={handleMismatchConfirm}
        title={t("shortlist_updated")}
        descr={t("pros_cannot_do_job")}
        titleBtn={t("see_matching_pros")}
        onPress={handleMismatchConfirm}
        titleType={{ size: 14, leading: px(22) }}
        titleStyle={dsStyles.mainModalTitle}
        btnsStyle={dsStyles.mainModalBtns}
        btnsWrapperStyle={[atoms.mt_20, dsStyles.mainModalBtnsWrapper]}
        modalStyle={dsStyles.mainModalModal}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  buttonShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 5,
  },
})

export default ServiceRequestDetailsScreen
