import React, { useRef, useState } from "react"
import { Animated, I18nManager, ScrollView, StyleSheet, Switch } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmChecbox, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import { useGetServiceByIdQuery } from "services/api"
import { QuestionAnswerType } from "types/job"
import QuestionComponent from "components/QuestionComponent/QuestionComponent"
import CalendarTimeModal from "components/CalendarTimeModal/CalendarTimeModal"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import CloseIcon from "assets/icons/close.svg"

type DateTypeOption = "notDecided" | "hours48" | "week" | "furtherOut" | "specificDates"

type Props = RootStackScreenProps<"ServiceRequestDetailsScreen">

const ServiceRequestDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { categoryId, categoryName, serviceId, selectedProIds, selectedProNames, address, placeOfService, answeredQuestions } = route.params
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()

  // Fetch service to get questions
  const { data: service, isLoading } = useGetServiceByIdQuery(serviceId)

  // Find the category's customer questions
  const category = service?.categories?.find((c) => c.id === categoryId)
  const customerQuestions = category?.customerQuestions || []

  // Filter out questions already answered in the bottom sheet
  const answeredIds = new Set((answeredQuestions || []).map((a) => a.questionId))
  const unansweredQuestions = customerQuestions.filter((q) => !answeredIds.has(q.id))

  // Steps: unanswered questions + 1 date step at the end
  const [currentIndex, setCurrentIndex] = useState(0)
  const totalSteps = unansweredQuestions.length + 1 // +1 for date step
  const isDateStep = currentIndex === unansweredQuestions.length

  // Question answers state
  const [questionsAnswers, setQuestionsAnswers] = useState<QuestionAnswerType[]>(
    () => answeredQuestions || []
  )

  // Date/time state
  const [selectedDateOption, setSelectedDateOption] = useState<DateTypeOption | undefined>()
  const [selectedDate, setSelectedDate] = useState<string | undefined>()
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ start: string; end: string } | undefined>()
  const [flexibleSchedule, setFlexibleSchedule] = useState(true)
  const [isCalendarVisible, setCalendarVisible] = useState(false)

  // Animation refs
  const opacityAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current
  const slideDirection = isAr ? -1 : 1

  const currentQuestion = !isDateStep ? unansweredQuestions[currentIndex] : undefined
  const progress = totalSteps > 0 ? (currentIndex + 1) / totalSteps : 1

  const animateTransition = (direction: "next" | "back", callback: () => void) => {
    const exitSlide = direction === "next" ? -30 * slideDirection : 30 * slideDirection
    const enterSlide = direction === "next" ? 30 * slideDirection : -30 * slideDirection

    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: exitSlide, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      callback()
      slideAnim.setValue(enterSlide)
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start()
    })
  }

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

  // Map UI option to backend dateType
  const getBackendDateType = () => {
    if (!selectedDateOption) return undefined
    if (selectedDateOption === "notDecided") return "notDecided"
    if (selectedDateOption === "hours48") return "hours48"
    if (selectedDateOption === "week") return "week"
    if (selectedDateOption === "furtherOut" || selectedDateOption === "specificDates") return "date"
    return undefined
  }

  const handleNext = () => {
    if (currentIndex < totalSteps - 1) {
      animateTransition("next", () => setCurrentIndex((prev) => prev + 1))
    } else {
      // Last step (date) — navigate to summary
      navigation.navigate("RequestSummaryScreen", {
        categoryId,
        categoryName,
        serviceId,
        selectedProIds,
        selectedProNames,
        address,
        placeOfService,
        questionsAnswers,
        dateType: getBackendDateType(),
        selectedDate,
        selectedTimeSlot,
        flexibleSchedule,
      })
    }
  }

  const handleBack = () => {
    if (currentIndex > 0) {
      animateTransition("back", () => setCurrentIndex((prev) => prev - 1))
    } else {
      navigation.goBack()
    }
  }

  const handleClose = () => {
    navigation.goBack()
  }

  const handleSelectDateOption = (option: DateTypeOption) => {
    setSelectedDateOption(option)

    // Reset date/time when switching options
    if (option !== "furtherOut" && option !== "specificDates") {
      setSelectedDate(undefined)
      setSelectedTimeSlot(undefined)
    }

    // Open calendar for date-specific options
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
      return !!selectedDateOption
    }
    if (!currentQuestion) return true
    const answer = questionsAnswers.find((a) => a.questionId === currentQuestion.id)
    if (!answer) return false
    if (currentQuestion.type === "shortAnswer" || currentQuestion.type === "paragraph") return !!answer.answer
    if (currentQuestion.type === "oneChoice") return !!answer.optionId
    if (currentQuestion.type === "multipleChoice") return !!answer.optionsIds?.length
    if (currentQuestion.type === "dateTime") return !!answer.date || !!answer.startDate
    if (currentQuestion.type === "files") return !!answer.files?.length
    return false
  })()

  const dateOptions: { key: DateTypeOption; label: string }[] = [
    { key: "notDecided", label: t("havent_decided_yet") },
    { key: "hours48", label: t("within_48_hours") },
    { key: "week", label: t("within_a_week") },
    { key: "furtherOut", label: t("further_out") },
    { key: "specificDates", label: t("specific_dates") },
  ]

  const renderDateStep = () => (
    <DmView className="px-[14]">
      <DmText className="text-22 leading-[28px] font-custom700 mb-[24]">
        {t("when_do_you_need_job")}
      </DmText>

      {dateOptions.map((option) => (
        <DmView key={option.key}>
          <DmChecbox
            className="py-[14]"
            textClassName="flex-1 text-14 leading-[18px] font-custom400"
            variant="circle"
            title={option.label}
            onPress={() => handleSelectDateOption(option.key)}
            isChecked={selectedDateOption === option.key}
          />
          {/* Show selected date below the option */}
          {selectedDateOption === option.key && selectedDate && (
            <DmView className="ml-[36] mb-[8]">
              <DmText
                className="text-13 leading-[16px] font-custom500 text-red"
                onPress={() => setCalendarVisible(true)}
              >
                {selectedDate}{selectedTimeSlot ? `  •  ${selectedTimeSlot.start} - ${selectedTimeSlot.end}` : ""}
              </DmText>
            </DmView>
          )}
        </DmView>
      ))}

      {/* Flexible schedule toggle */}
      <DmView className="flex-row items-center mt-[24] pt-[16] border-t-0.5 border-t-grey5">
        <DmText className="flex-1 text-13 leading-[18px] font-custom400 mr-[12]">
          {t("flexible_schedule_toggle")}
        </DmText>
        <Switch
          value={flexibleSchedule}
          onValueChange={setFlexibleSchedule}
          trackColor={{ false: colors.grey5, true: colors.blue }}
          thumbColor="white"
        />
      </DmView>
    </DmView>
  )

  if (isLoading) {
    return <LoadingOverlay />
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <DmView className="flex-row items-center px-[16] py-[12]">
        <DmView
          className="w-[32] h-[32] items-center justify-center"
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={handleBack}
        >
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView className="flex-1 items-center">
          <DmText className="text-16 font-custom600 text-black">
            {t("details")}
          </DmText>
        </DmView>
        <DmView
          className="w-[32] h-[32] items-center justify-center"
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={handleClose}
        >
          <CloseIcon width={16} height={16} color={colors.black} />
        </DmView>
      </DmView>

      {/* Progress bar */}
      <DmView className="h-[3] bg-grey5">
        <DmView
          className="h-[3] bg-red"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </DmView>

      {/* Animated content — one step at a time */}
      <Animated.View style={{ flex: 1, opacity: opacityAnim, transform: [{ translateX: slideAnim }] }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 28, paddingBottom: 20 }}
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
        </ScrollView>
      </Animated.View>

      {/* Bottom button */}
      <DmView
        className="px-[16] pt-[17] bg-white"
        style={[styles.buttonShadow, { paddingBottom: insets.bottom + 16 }]}
      >
        <ActionBtn
          title={currentIndex === totalSteps - 1 ? t("continue") : t("next")}
          onPress={handleNext}
          disable={!isCurrentAnswered}
          className="h-[52] rounded-10"
          textClassName="text-16 font-custom600"
        />
      </DmView>

      {/* Calendar modal for date selection */}
      <CalendarTimeModal
        isVisible={isCalendarVisible}
        onClose={() => setCalendarVisible(false)}
        onConfirm={handleCalendarConfirm}
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
