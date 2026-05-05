import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, Dimensions, Platform, ScrollView, StyleSheet } from "react-native"
import {
  BottomSheetModal,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet"
import { FullWindowOverlay } from "react-native-screens"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmChecbox, DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import { ServiceQuestionType } from "types/cms"
import { QuestionAnswerType } from "types/job"
import QuestionComponent from "components/QuestionComponent/QuestionComponent"

import CloseIcon from "assets/icons/close.svg"
import ChevronLeftIcon from "assets/icons/chevron-left.svg"

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window")

const PLACE_OF_SERVICE_LABELS: Record<string, string> = {
  proToCustomer: "at_my_location",
  customerToPro: "at_pro_location",
  remoteOrOnline: "online_remote",
  delivery: "delivery_service",
  fixedLocations: "at_fixed_location",
}

interface QuestionBottomSheetProps {
  isVisible: boolean
  serviceName: string
  placeOfServiceOptions: string[]
  customerQuestions: ServiceQuestionType[]
  onDismiss: (result: {
    placeOfService?: string
    filterOptionIds: number[]
    dataAnswers: QuestionAnswerType[]
    allAnswers: QuestionAnswerType[]
    filtersChanged: boolean
  }) => void
}

type StepItem =
  | { type: "placeOfService" }
  | { type: "question"; question: ServiceQuestionType }

const QuestionBottomSheet: React.FC<QuestionBottomSheetProps> = ({
  isVisible,
  serviceName,
  placeOfServiceOptions,
  customerQuestions,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const modalRef = useRef<BottomSheetModal>(null)

  const snapPoints = useMemo(() => ["92%"], [])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedPlaceOfService, setSelectedPlaceOfService] = useState<string | undefined>()
  const [answers, setAnswers] = useState<QuestionAnswerType[]>([])
  const [filtersChanged, setFiltersChanged] = useState(false)

  // Page transition animation
  const slideAnim = useRef(new Animated.Value(0)).current
  const opacityAnim = useRef(new Animated.Value(1)).current

  const steps = useMemo<StepItem[]>(() => {
    const result: StepItem[] = []

    if (placeOfServiceOptions.length > 1) {
      result.push({ type: "placeOfService" })
    }

    const customerOnly = customerQuestions
      .filter((q) => q.assignee === "customer")
      .sort((a, b) => a.order - b.order)

    const filterQuestions = customerOnly.filter((q) => q.isFilter)
    const dataQuestions = customerOnly.filter((q) => !q.isFilter)

    filterQuestions.forEach((q) => result.push({ type: "question", question: q }))
    dataQuestions.forEach((q) => result.push({ type: "question", question: q }))

    console.log("[QuestionFlow] steps built:", {
      placeOfServiceOptions,
      filterQuestions: filterQuestions.map((q) => ({ id: q.id, text: q.text, isFilter: q.isFilter, type: q.type })),
      dataQuestions: dataQuestions.map((q) => ({ id: q.id, text: q.text, isFilter: q.isFilter, type: q.type })),
      totalSteps: result.length,
    })

    return result
  }, [placeOfServiceOptions, customerQuestions])

  const totalSteps = steps.length
  const currentStep = steps[currentIndex]
  const progress = totalSteps > 0 ? (currentIndex + 1) / totalSteps : 0

  useEffect(() => {
    if (isVisible && totalSteps > 0) {
      modalRef.current?.present()
    }
  }, [isVisible, totalSteps])

  const collectDismissResult = useCallback(() => {
    const filterOptionIds: number[] = []
    const dataAnswers: QuestionAnswerType[] = []

    answers.forEach((ans) => {
      const step = steps.find(
        (s) => s.type === "question" && s.question.id === ans.questionId
      )
      if (!step || step.type !== "question") return

      if (step.question.isFilter) {
        // Look up serviceCategoryFilterOptionId from the question options
        const options = step.question.options || []
        if (ans.optionId) {
          const opt = options.find((o) => o.id === ans.optionId)
          if (opt?.serviceCategoryFilterOptionId) filterOptionIds.push(opt.serviceCategoryFilterOptionId)
        }
        if (ans.optionsIds) {
          ans.optionsIds.forEach((oid) => {
            const opt = options.find((o) => o.id === oid)
            if (opt?.serviceCategoryFilterOptionId) filterOptionIds.push(opt.serviceCategoryFilterOptionId)
          })
        }
      } else {
        dataAnswers.push(ans)
      }
    })

    return {
      placeOfService: selectedPlaceOfService,
      filterOptionIds,
      dataAnswers,
      allAnswers: answers,
      filtersChanged,
    }
  }, [answers, steps, selectedPlaceOfService, filtersChanged])

  const handleDismiss = useCallback(() => {
    onDismiss(collectDismissResult())
  }, [onDismiss, collectDismissResult])

  // Page transition: fade out + slight slide, swap content, fade in + slight slide
  const slideDirection = isAr ? -1 : 1

  const animateTransition = (direction: "next" | "back", callback: () => void) => {
    const exitSlide = direction === "next" ? -30 * slideDirection : 30 * slideDirection
    const enterSlide = direction === "next" ? 30 * slideDirection : -30 * slideDirection

    // Phase 1: fade out + slide current content
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: exitSlide, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      // Swap content
      callback()
      // Position new content on the enter side
      slideAnim.setValue(enterSlide)
      // Phase 2: fade in + slide new content to center
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start()
    })
  }

  const handleNext = () => {
    if (currentIndex < totalSteps - 1) {
      animateTransition("next", () => setCurrentIndex((prev) => prev + 1))
    } else {
      modalRef.current?.dismiss()
    }
  }

  const handleBack = () => {
    if (currentIndex > 0) {
      animateTransition("back", () => setCurrentIndex((prev) => prev - 1))
    }
  }

  const handleClose = () => {
    modalRef.current?.dismiss()
  }

  const handleSelectPlaceOfService = (place: string) => {
    setSelectedPlaceOfService(place)
    setFiltersChanged(true)
  }

  const handleChangeAnswer = (answer: QuestionAnswerType) => {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === answer.questionId)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = answer
        return updated
      }
      return [...prev, answer]
    })

    if (currentStep?.type === "question" && currentStep.question.isFilter) {
      setFiltersChanged(true)
    }
  }

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    []
  )

  const renderContainerComponent = useCallback(
    (props: any) =>
      Platform.OS === "ios" ? (
        <FullWindowOverlay>{props.children}</FullWindowOverlay>
      ) : (
        props.children
      ),
    []
  )

  const scrollHeight = SCREEN_HEIGHT * 0.92 - 80 - 20 - 120 - insets.bottom

  const renderCurrentStep = () => {
    if (!currentStep) return null

    if (currentStep.type === "placeOfService") {
      return (
        <DmView className="px-[24]">
          <DmText className="text-18 leading-[23px] font-custom700 text-black mb-[6]">
            {t("how_do_you_want_service")}
          </DmText>
          <DmText className="text-13 leading-[17px] font-custom400 text-grey3 mb-[24]">
            {t("select_one")}
          </DmText>
          {placeOfServiceOptions.map((option, index) => {
            const isSelected = selectedPlaceOfService === option
            const labelKey = PLACE_OF_SERVICE_LABELS[option] || option
            return (
              <DmChecbox
                key={option}
                className={index > 0 ? "mt-[16]" : ""}
                textClassName="flex-1 text-14 font-custom400"
                variant="circle"
                title={t(labelKey)}
                onPress={() => handleSelectPlaceOfService(option)}
                isChecked={isSelected}
              />
            )
          })}
        </DmView>
      )
    }

    if (currentStep.type === "question") {
      return (
        <DmView className="px-[10]">
          <QuestionComponent
            item={currentStep.question}
            onChangeAnswer={handleChangeAnswer}
            answers={answers}
            hideBorders
          />
        </DmView>
      )
    }

    return null
  }

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      containerComponent={renderContainerComponent}
      onDismiss={handleDismiss}
      handleIndicatorStyle={{ backgroundColor: colors.grey5, width: 40 }}
      backgroundStyle={{ borderTopLeftRadius: 10, borderTopRightRadius: 10 }}
    >
      {/* Header — fixed */}
      <DmView className="items-center pt-[4] pb-[12] px-[20]">
        <DmView className="flex-row items-center justify-center w-full">
          <DmView className="flex-1 items-start">
            {currentIndex > 0 && (
              <DmView
                onPress={handleBack}
                className="w-[32] h-[32] items-center justify-center"
                hitSlop={HIT_SLOP_DEFAULT}
              >
                <ChevronLeftIcon
                  color={colors.red}
                  style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
                />
              </DmView>
            )}
          </DmView>
          <DmText className="text-14 leading-[18px] font-custom600 text-black">
            {serviceName}
          </DmText>
          <DmView className="flex-1 items-end">
            <DmView
              onPress={handleClose}
              className="w-[32] h-[32] items-center justify-center"
              hitSlop={HIT_SLOP_DEFAULT}
            >
              <CloseIcon width={16} height={16} color={colors.red} />
            </DmView>
          </DmView>
        </DmView>
      </DmView>

      {/* Progress bar — fixed */}
      <DmView className="h-[3] bg-grey5">
        <DmView
          className="h-[3] bg-red"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </DmView>

      {/* Scrollable question content — animated */}
      <Animated.View style={{ flex: 1, opacity: opacityAnim, transform: [{ translateX: slideAnim }] }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 28, paddingBottom: 20 }}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderCurrentStep()}
        </ScrollView>
      </Animated.View>

      {/* Bottom button area — fixed */}
      <DmView
        className="px-[16] pt-[17] bg-white"
        style={[sheetStyles.buttonShadow, { paddingBottom: insets.bottom + 16 }]}
      >
        <ActionBtn
          title={currentIndex === totalSteps - 1 ? t("done") : t("next")}
          onPress={handleNext}
          className="h-[52] rounded-10"
          textClassName="text-16 font-custom600"
        />
      </DmView>
    </BottomSheetModal>
  )
}

const sheetStyles = StyleSheet.create({
  buttonShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 5,
  },
})

export default QuestionBottomSheet
