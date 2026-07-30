import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, BackHandler, Dimensions, Easing, Platform, ScrollView, StyleSheet } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmChecbox, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackParamList, RootStackScreenProps } from "navigation/types"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import { ServiceQuestionType } from "types/cms"
import { QuestionAnswerType } from "types/job"
import QuestionComponent from "components/QuestionComponent/QuestionComponent"
import NativePushBackSheet, {
  useFullSheetHeight,
} from "components/NativePushBackSheet/NativePushBackSheet"
import { questionFlowEventBus } from "events/questionFlowEventBus"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import CloseIcon from "assets/icons/close.svg"

// Maps place-of-service values to their i18n label keys (same as AllQuestionsScreen)
const PLACE_OF_SERVICE_LABELS: Record<string, string> = {
  proToCustomer: "at_my_location",
  customerToPro: "at_pro_location",
  remoteOrOnline: "online_remote",
  delivery: "delivery_service",
  fixedLocations: "at_fixed_location",
}

type StepItem =
  | { type: "placeOfService" }
  | { type: "question"; question: ServiceQuestionType }

// ── Shared state context (avoids prop-drilling into the step view) ──
type SharedState = {
  steps: StepItem[]
  totalSteps: number
  categoryName: string
  placeOfServiceOptions: string[]
  answers: QuestionAnswerType[]
  selectedPlaceOfService?: string
  setAnswers: React.Dispatch<React.SetStateAction<QuestionAnswerType[]>>
  setSelectedPlaceOfService: (place: string) => void
  goNext: () => void
  goPrev: () => void
  onDone: () => void
  onClose: () => void
}

const SharedStateContext = React.createContext<SharedState | null>(null)

// One stacked step card. Next slides the new step in over the current one —
// from the right in LTR, from the left in Arabic — and Back slides the top
// card out the same way, revealing the previous step (the card-over-card feel
// the original nested-stack flow had; a navigator can't nest inside the
// natively presented sheet, so the stack is re-created here).
const StepCard: React.FC<{
  animateIn: boolean
  covered: boolean
  popping: boolean
  onPopped: () => void
  children: React.ReactNode
}> = ({ animateIn, covered, popping, onPopped, children }) => {
  const { i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  // Where "off-screen" is for an incoming card: right edge in LTR, left in RTL
  const offscreenX = (isAr ? -1 : 1) * Dimensions.get("window").width
  const translateX = useRef(new Animated.Value(animateIn ? offscreenX : 0)).current
  const dim = useRef(new Animated.Value(0)).current

  // Entry: the new page slides in over the previous one
  useEffect(() => {
    if (animateIn) {
      Animated.timing(translateX, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Native-push parallax: while covered, the page drifts back ~30% and dims;
  // it returns as the page above pops. Skipped on mount so it can't fight
  // the entry animation on the same Animated.Value.
  const hasMounted = useRef(false)
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: covered ? -0.3 * offscreenX : 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dim, {
        toValue: covered ? 0.08 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [covered])

  useEffect(() => {
    if (popping) {
      Animated.timing(translateX, {
        toValue: offscreenX,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onPopped()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popping])

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        styles.stepCard,
        // Edge shadow on the leading side, like a pushed UIKit page
        { shadowOffset: { width: isAr ? 6 : -6, height: 0 } },
        { transform: [{ translateX }] },
      ]}
    >
      {children}
      {/* Dims while a newer page covers this one (pointer-transparent) */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#000", opacity: dim }]}
      />
    </Animated.View>
  )
}

// ── One question step (header + progress + content + button) ──
const StepView: React.FC<{ stepIndex: number }> = ({ stepIndex }) => {
  const ctx = React.useContext(SharedStateContext)!
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()

  const currentStep = ctx.steps[stepIndex]
  const progress = ctx.totalSteps > 0 ? (stepIndex + 1) / ctx.totalSteps : 1
  const isLastStep = stepIndex === ctx.totalSteps - 1

  const handleChangeAnswer = (newAnswer: QuestionAnswerType) => {
    ctx.setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === newAnswer.questionId)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = newAnswer
        return updated
      }
      return [...prev, newAnswer]
    })
  }

  const handleNext = () => {
    if (!isLastStep) {
      ctx.goNext()
    } else {
      ctx.onDone()
    }
  }

  const handleBack = () => {
    if (stepIndex > 0) {
      ctx.goPrev()
    } else {
      // Exiting from the first step still saves whatever's answered (same as X /
      // swipe), so partial answers are never dropped.
      ctx.onDone()
    }
  }

  // Check if current step is answered
  const isCurrentAnswered = (() => {
    if (!currentStep) return false

    if (currentStep.type === "placeOfService") {
      return !!ctx.selectedPlaceOfService
    }

    const question = currentStep.question
    const answer = ctx.answers.find((a) => a.questionId === question.id)
    if (!answer) return false
    if (question.type === "shortAnswer" || question.type === "paragraph") return !!answer.answer
    if (question.type === "oneChoice") return !!answer.optionId
    if (question.type === "multipleChoice") return !!answer.optionsIds?.length
    if (question.type === "dateTime") return !!answer.date || !!answer.startDate
    if (question.type === "files") return !!answer.files?.length
    return false
  })()

  const renderPlaceOfServiceStep = () => (
    <DmView className="px-[14]">
      <DmText className="text-22 leading-[28px] font-custom700 mb-[24]">
        {t("how_do_you_want_service")}
      </DmText>
      {ctx.placeOfServiceOptions.map((place) => (
        <DmChecbox
          key={place}
          className="py-[14]"
          textClassName="flex-1 text-14 leading-[18px] font-custom400"
          variant="circle"
          title={t(PLACE_OF_SERVICE_LABELS[place] || place)}
          onPress={() => ctx.setSelectedPlaceOfService(place)}
          isChecked={ctx.selectedPlaceOfService === place}
        />
      ))}
    </DmView>
  )

  return (
    <SafeAreaView className="flex-1 bg-white" edges={[]}>
      {/* Header */}
      <DmView className="flex-row items-center px-[16] pt-[12] pb-[8]">
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
            {ctx.categoryName}
          </DmText>
        </DmView>
        <DmView
          className="w-[32] h-[32] items-center justify-center"
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={ctx.onDone}
        >
          <CloseIcon width={16} height={16} color={colors.red} />
        </DmView>
      </DmView>

      {/* Progress bar */}
      <DmView className="h-[3] bg-grey5">
        <DmView
          className="h-[3] bg-red"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </DmView>

      {/* Question content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 28, paddingBottom: 20, flexGrow: 1 }}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep?.type === "placeOfService" && renderPlaceOfServiceStep()}
        {currentStep?.type === "question" && (
          <QuestionComponent
            key={currentStep.question.id}
            item={currentStep.question}
            onChangeAnswer={handleChangeAnswer}
            answers={ctx.answers}
            allQuestions={ctx.steps.flatMap((s) =>
              s.type === "question" ? [s.question] : []
            )}
          />
        )}
      </ScrollView>

      {/* Bottom button */}
      <DmView
        className="px-[16] pt-[17] bg-white"
        style={[styles.buttonShadow, { paddingBottom: insets.bottom + 16 }]}
      >
        <ActionBtn
          title={isLastStep ? t("done") : t("next")}
          onPress={handleNext}
          disable={!isCurrentAnswered}
          className="h-[52] rounded-10"
          textClassName="text-16 font-custom600"
        />
      </DmView>
    </SafeAreaView>
  )
}

// ── The whole flow: state-driven steps, presentation-agnostic ──
type QuestionFlowParams = RootStackParamList["QuestionStepScreen"]
type ContentProps = QuestionFlowParams & {
  onClose: () => void
  // Set by the iOS sheet wrapper so a swipe-down dismiss commits the partial
  // answers (handleDone) instead of silently closing.
  commitRef?: React.MutableRefObject<(() => void) | null>
}

const QuestionFlowContent: React.FC<ContentProps> = ({
  categoryName,
  placeOfServiceOptions,
  customerQuestions,
  initialAnswers,
  initialPlaceOfService,
  onClose,
  commitRef,
}) => {
  // Build steps
  const steps = useMemo<StepItem[]>(() => {
    const result: StepItem[] = []

    if (placeOfServiceOptions.length > 1) {
      result.push({ type: "placeOfService" })
    }

    const customerOnly = customerQuestions
      .filter((q) => q.assignee === "customer")
      .sort((a, b) => a.order - b.order)

    const filterQuestions = customerOnly.filter((q) => q.isFilter && q.tier !== "refinement")
    const dataQuestions = customerOnly.filter((q) => !q.isFilter)

    filterQuestions.forEach((q) => result.push({ type: "question", question: q }))
    dataQuestions.forEach((q) => result.push({ type: "question", question: q }))

    return result
  }, [placeOfServiceOptions, customerQuestions])

  // Shared state — seeded on repost so the flow opens pre-filled; empty on a
  // normal first arrival (the seeds are undefined then).
  const [answers, setAnswers] = useState<QuestionAnswerType[]>(
    initialAnswers ?? []
  )
  const [selectedPlaceOfService, setSelectedPlaceOfService] = useState<
    string | undefined
  >(initialPlaceOfService)
  // Stack of step indices; Next pushes a card, Back pops the top card after
  // its slide-out animation finishes. The pop targets a SPECIFIC card (not a
  // global flag) so an in-between render can never start popping the next
  // card down — a global flag cascaded all the way to a blank sheet.
  const [stepStack, setStepStack] = useState<number[]>([0])
  const [poppingStep, setPoppingStep] = useState<number | null>(null)
  const stackRef = useRef(stepStack)
  stackRef.current = stepStack

  const goNext = useCallback(() => {
    setStepStack((s) => [...s, s[s.length - 1] + 1])
  }, [])

  const goPrev = useCallback(() => {
    const s = stackRef.current
    if (s.length <= 1) return // never pop the root step
    const top = s[s.length - 1]
    setPoppingStep((current) => current ?? top) // one pop in flight at a time
  }, [])

  const handlePopped = useCallback((poppedStep: number) => {
    setStepStack((s) => s.filter((idx) => idx !== poppedStep))
    setPoppingStep((current) => (current === poppedStep ? null : current))
  }, [])

  // Guards against a double emit if a programmatic close also fires the sheet's
  // onDismissed. Resets per open because the content remounts (contentKey).
  const committedRef = useRef(false)

  const handleDone = useCallback(() => {
    if (committedRef.current) {
      onClose()
      return
    }
    committedRef.current = true

    const filterOptionIds: number[] = []
    const dataAnswers: QuestionAnswerType[] = []

    answers.forEach((ans) => {
      const step = steps.find(
        (s) => s.type === "question" && s.question.id === ans.questionId
      )
      if (!step || step.type !== "question") return

      if (step.question.isFilter) {
        if (ans.optionId) {
          const opt = step.question.options?.find((o) => o.id === ans.optionId)
          if (opt?.serviceCategoryFilterOptionId) {
            filterOptionIds.push(opt.serviceCategoryFilterOptionId)
          }
        }
        if (ans.optionsIds) {
          ans.optionsIds.forEach((optId) => {
            const opt = step.question.options?.find((o) => o.id === optId)
            if (opt?.serviceCategoryFilterOptionId) {
              filterOptionIds.push(opt.serviceCategoryFilterOptionId)
            }
          })
        }
      } else {
        dataAnswers.push(ans)
      }
    })

    questionFlowEventBus.emit("questions:done", {
      placeOfService: selectedPlaceOfService,
      filterOptionIds,
      dataAnswers,
      allAnswers: answers,
      filtersChanged: true,
    })

    onClose()
  }, [answers, steps, selectedPlaceOfService, onClose])

  // The iOS sheet wrapper calls this on swipe-down dismiss so partial answers
  // are saved (via handleDone) instead of dropped.
  useEffect(() => {
    if (!commitRef) return
    commitRef.current = handleDone
    return () => {
      if (commitRef.current === handleDone) commitRef.current = null
    }
  }, [commitRef, handleDone])

  // Android hardware back (the nav-route presentation): mirror the in-app back —
  // step back if we're past the first card, otherwise exit AND commit the
  // partial answers (same as X / swipe). Subscribe once; a ref keeps the latest
  // step/answers without re-binding the listener on every keystroke.
  const backActionRef = useRef<() => void>(() => {})
  backActionRef.current = () => {
    if (stackRef.current.length > 1) goPrev()
    else handleDone()
  }
  useEffect(() => {
    if (Platform.OS !== "android") return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      backActionRef.current()
      return true
    })
    return () => sub.remove()
  }, [])

  const sharedState: SharedState = useMemo(() => ({
    steps,
    totalSteps: steps.length,
    categoryName,
    placeOfServiceOptions,
    answers,
    selectedPlaceOfService,
    setAnswers,
    setSelectedPlaceOfService,
    goNext,
    goPrev,
    onDone: handleDone,
    onClose,
  }), [steps, categoryName, placeOfServiceOptions, answers, selectedPlaceOfService, goNext, goPrev, handleDone, onClose])

  return (
    <SharedStateContext.Provider value={sharedState}>
      <DmView className="flex-1 bg-white">
        {stepStack.map((stepIdx, i) => {
          // During a pop the card below is already "returning" — treat it as
          // uncovered so its parallax-return runs alongside the pop.
          const effectiveTop = stepStack.length - (poppingStep != null ? 2 : 1)
          return (
            <StepCard
              key={stepIdx}
              animateIn={i > 0}
              covered={i < effectiveTop}
              popping={poppingStep === stepIdx}
              onPopped={() => handlePopped(stepIdx)}
            >
              <StepView stepIndex={stepIdx} />
            </StepCard>
          )
        })}
      </DmView>
    </SharedStateContext.Provider>
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
  // Each stacked step is an opaque card floating over the previous one
  // (even shadow glow — works for both slide directions)
  stepCard: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
})

// Matches the native clamp (sheet height caps at 90% of the container).

/**
 * iOS presentation: the question flow inside the native push-back sheet.
 * `contentKey` should change on every open so answers/step reset.
 */
export const QuestionFlowSheet: React.FC<
  QuestionFlowParams & { visible: boolean; contentKey: number; onClose: () => void }
> = ({ visible, contentKey, onClose, ...contentProps }) => {
  // Swipe-down dismiss should commit partial answers (handleDone), not just
  // close. The content sets this ref to its handleDone; fall back to onClose
  // until the content has mounted.
  const commitRef = useRef<(() => void) | null>(null)
  const fullSheetHeight = useFullSheetHeight()
  return (
    <NativePushBackSheet
      visible={visible}
      height={fullSheetHeight}
      onDismissed={() => (commitRef.current ?? onClose)()}
    >
      <QuestionFlowContent
        key={contentKey}
        {...contentProps}
        onClose={onClose}
        commitRef={commitRef}
      />
    </NativePushBackSheet>
  )
}

// Android (and fallback) presentation: plain navigation route.
type Props = RootStackScreenProps<"QuestionStepScreen">

const QuestionStepScreen: React.FC<Props> = ({ route, navigation }) => (
  <QuestionFlowContent {...route.params} onClose={() => navigation.goBack()} />
)

export default QuestionStepScreen
