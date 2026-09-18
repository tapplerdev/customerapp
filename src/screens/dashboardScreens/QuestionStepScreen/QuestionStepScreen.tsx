import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, Dimensions, Easing, Keyboard, StyleSheet } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmChecbox, DmText, DmView } from "@tappler/shared/src/components/UI"
import { QuestionFlowParams } from "navigation/types"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import { ServiceQuestionType } from "types/cms"
import { QuestionAnswerType } from "types/job"
import QuestionComponent from "components/QuestionComponent/QuestionComponent"
import NativeSheet from "@tappler/shared/src/components/NativeSheet/NativeSheet"
import {
  useFullSheetHeight,
} from "@tappler/shared/src/components/NativePushBackSheet/NativePushBackSheet"
import { useKeyboardInset } from "@tappler/shared/src/hooks/useKeyboardInset"
import { questionFlowEventBus } from "events/questionFlowEventBus"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import CloseIcon from "assets/icons/close.svg"
import { AppScrollView } from "components/scroll"

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
      }).start(() => {
        /*
         * Unconditionally, NOT gated on `finished`.
         *
         * `poppingStep` is cleared only from here, and goPrev refuses to start a
         * second pop while one is in flight (`current ?? top`). So an animation
         * that gets interrupted — a re-render, an unmount mid-flight — reported
         * finished:false, this never ran, and the flag stuck forever: every
         * later back press was then silently dropped while handleDone kept
         * working, which is the same "dead button" symptom from a different
         * cause. The card is being removed either way; whether its slide-out
         * ran to completion has no bearing on that.
         */
        onPopped()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popping])

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
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
        style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: dim }]}
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
  const keyboardInset = useKeyboardInset()

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
    /*
      iOS-only keyboard inset on the OUTER container — the footer button is a
      sibling AFTER the ScrollView, so nothing in the scroll content can lift it.
      Padding here shrinks the scroller and raises the footer together.
      See useKeyboardInset for why Android gets 0.
    */
    <SafeAreaView
      className="flex-1 bg-white"
      edges={[]}
      style={{ paddingBottom: keyboardInset }}
    >
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
      <AppScrollView
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
      </AppScrollView>

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
type ContentProps = QuestionFlowParams & {
  onClose: () => void
  // Set by the sheet wrapper so a swipe-down dismiss commits the partial
  // answers (handleDone) instead of silently closing.
  commitRef?: React.MutableRefObject<(() => void) | null>
  // Publishes "what back means here" to whoever mounted this content, which
  // wires it to Android's back key — see the note on the effect that calls it.
  registerBackAction?: (action: () => void) => void
}

const QuestionFlowContent: React.FC<ContentProps> = ({
  categoryName,
  placeOfServiceOptions,
  customerQuestions,
  initialAnswers,
  initialPlaceOfService,
  onClose,
  commitRef,
  registerBackAction,
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
  // Read inside goNext, which is useCallback([]) and must not go stale on it.
  const stepCountRef = useRef(steps.length)
  stepCountRef.current = steps.length

  const goNext = useCallback(() => {
    /*
     * Put the keyboard away before advancing, because nothing else ever does.
     *
     * Every visited card stays MOUNTED — stepStack.map keeps them, the covered
     * one only dims — so a text answer leaves its TextInput focused and the IME
     * up for every card after it. Android hands the first BACK press to the
     * keyboard, not to the app, which is why hardware back read as completely
     * dead on later cards while the on-screen chevron kept working: the chevron
     * is a touch, the back button is a key the IME consumed first.
     */
    Keyboard.dismiss()
    setStepStack((s) => {
      const next = s[s.length - 1] + 1
      /*
       * Bounded, because handleNext's `if (!isLastStep)` is not enough on its own.
       *
       * The card being covered stays hittable for most of the 320ms slide-in — the
       * incoming card is absolutely positioned and eased in from off-screen, and the
       * only thing over the outgoing one is a dim View with pointerEvents="none" — so
       * a double-tap on Next runs the SAME card's handleNext twice. On card 0 of 2,
       * isLastStep is false both times, so the stack became [0, 1, 2] and StepView
       * rendered steps[2]: a blank white card, a disabled Next (nothing to answer),
       * and a 150%-wide progress bar, escapable only by back or X. Tapping Next on the
       * card revealed underneath during a pop reaches the same place, since stepStack
       * is not trimmed until handlePopped runs.
       */
      return next < stepCountRef.current ? [...s, next] : s
    })
  }, [])

  const goPrev = useCallback(() => {
    const s = stackRef.current
    if (s.length <= 1) return // never pop the root step
    const top = s[s.length - 1]
    // One pop in flight at a time, and note what that costs: stepStack is not
    // trimmed until handlePopped runs after the 280ms slide-out, so a SECOND back
    // press inside that window re-targets the card already leaving and does
    // nothing. Back-back to skip two cards quickly drops the second press. That is
    // the deliberate trade against the alternative — a cascading pop that once ran
    // all the way to a blank sheet.
    setPoppingStep((current) => current ?? top)
  }, [])

  const handlePopped = useCallback((poppedStep: number) => {
    setStepStack((s) => s.filter((idx) => idx !== poppedStep))
    setPoppingStep((current) => (current === poppedStep ? null : current))
  }, [])

  // Guards against a double EMIT if a programmatic close also fires the sheet's
  // onDismissed. Resets per open because the content remounts (contentKey).
  //
  // The guard still closes. Only the emit is once-only.
  //
  // It briefly did not, back when this content also mounted as a route and
  // onClose was navigation.goBack() — where a second call pops the screen
  // underneath as well. That route is gone; the only presentation left is the
  // sheet, where onClose just re-sets visible={false} and is idempotent. And
  // dropping the close was not free: between the first handleDone and the sheet
  // actually being gone there is a ~250ms window in which native swallows the
  // back key and routes it here, so a back press in that window did nothing at
  // all — a dead back button, which is the exact bug this whole change set
  // exists to fix.
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

  // The sheet wrapper calls this on swipe-down dismiss so partial answers are
  // saved (via handleDone) instead of dropped.
  useEffect(() => {
    if (!commitRef) return
    commitRef.current = handleDone
    return () => {
      if (commitRef.current === handleDone) commitRef.current = null
    }
  }, [commitRef, handleDone])

  // What "back" means in this flow: step back if we're past the first card,
  // otherwise exit AND commit the partial answers (same as X / swipe-down).
  // Reassigned every render, and read through the ref so the published wrapper
  // below always calls the current one without re-binding anything.
  const backActionRef = useRef<() => void>(() => {})
  backActionRef.current = () => {
    if (stackRef.current.length > 1) goPrev()
    else handleDone()
  }

  // Published UPWARD instead of bound to BackHandler here, matching the
  // registerCommit shape in AllQuestionsScreen.
  //
  // A BackHandler in here would be wrong twice over. It would be GLOBAL — the
  // closed, invisible sheet that ProsListingScreen always mounts once registered
  // one, and since BackHandler runs the newest listener first it beat React
  // Navigation: hardware back on the pro listing was swallowed and fired a
  // spurious refetch through questions:done. And it would never fire when it was
  // actually wanted, because Material's BottomSheetDialog owns its own window and
  // the key never reaches React at all.
  //
  // So the key comes in natively instead, through interceptBackPress /
  // onBackPress on the sheet, and lands here. No cleanup, matching
  // registerCommit in AllQuestionsScreen. Publishing a no-op on unmount would be
  // new surface with a clobber risk of its own — an unmount that overlaps a
  // remount would land AFTER the new registration and leave a dead back button.
  // The content only ever unmounts with the sheet that holds the reference, so
  // there is nothing left to point at anyway.
  useEffect(() => {
    registerBackAction?.(() => backActionRef.current())
  }, [registerBackAction])

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

/**
 * The question flow inside the native push-back sheet — both platforms.
 * `contentKey` should change on every open so answers/step reset.
 *
 * There used to be an Android-only `QuestionStepScreen` route beside this, which
 * bound a JS BackHandler to walk the cards. The sheet does that natively now
 * (interceptBackPress), so the route is gone and the file keeps its name out of
 * habit; nothing here is a screen.
 */
export const QuestionFlowSheet: React.FC<
  QuestionFlowParams & { visible: boolean; contentKey: number; onClose: () => void }
> = ({ visible, contentKey, onClose, ...contentProps }) => {
  // Swipe-down dismiss should commit partial answers (handleDone), not just
  // close. The content sets this ref to its handleDone; fall back to onClose
  // until the content has mounted.
  const commitRef = useRef<(() => void) | null>(null)
  // Android's back key, handed over natively because the dialog's window means
  // a JS BackHandler inside the sheet would never see it. The content publishes
  // "what back means here" — previous card, or commit-and-close on the first
  // one — and that is the whole feature: back walks the flow backwards instead
  // of throwing it away in one press.
  const backRef = useRef<(() => void) | null>(null)
  const fullSheetHeight = useFullSheetHeight()
  return (
    <NativeSheet
      visible={visible}
      height={fullSheetHeight}
      onDismissed={() => (commitRef.current ?? onClose)()}
      interceptBackPress
      // Same fallback as onDismissed: until the content has published, back
      // behaves like a dismissal rather than doing nothing.
      onBackPress={() => (backRef.current ?? commitRef.current ?? onClose)()}
    >
      <QuestionFlowContent
        key={contentKey}
        {...contentProps}
        onClose={onClose}
        commitRef={commitRef}
        registerBackAction={(action) => {
          backRef.current = action
        }}
      />
    </NativeSheet>
  )
}
