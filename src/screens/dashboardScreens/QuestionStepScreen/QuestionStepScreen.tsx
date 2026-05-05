import React, { useCallback, useMemo, useState } from "react"
import { ScrollView, StyleSheet } from "react-native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmChecbox, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import { ServiceQuestionType } from "types/cms"
import { QuestionAnswerType } from "types/job"
import QuestionComponent from "components/QuestionComponent/QuestionComponent"
import { questionFlowEventBus } from "events/questionFlowEventBus"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import CloseIcon from "assets/icons/close.svg"

// ── Types for the nested stack ──
type StepItem =
  | { type: "placeOfService" }
  | { type: "question"; question: ServiceQuestionType }

type InnerStackParamList = {
  QuestionStep: {
    stepIndex: number
  }
}

const InnerStack = createNativeStackNavigator<InnerStackParamList>()

// ── Shared state context (avoids passing through nav params) ──
type SharedState = {
  steps: StepItem[]
  totalSteps: number
  categoryName: string
  placeOfServiceOptions: string[]
  answers: QuestionAnswerType[]
  selectedPlaceOfService?: string
  setAnswers: React.Dispatch<React.SetStateAction<QuestionAnswerType[]>>
  setSelectedPlaceOfService: (place: string) => void
  onDone: () => void
  onClose: () => void
}

const SharedStateContext = React.createContext<SharedState | null>(null)

// ── Inner question step screen (card transitions within the modal) ──
const QuestionStepInner: React.FC<{ route: any; navigation: any }> = ({ route, navigation }) => {
  const { stepIndex } = route.params
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
      navigation.push("QuestionStep", { stepIndex: stepIndex + 1 })
    } else {
      ctx.onDone()
    }
  }

  const handleBack = () => {
    if (stepIndex > 0) {
      navigation.goBack()
    } else {
      ctx.onClose()
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
        {t("where_do_you_need_service")}
      </DmText>
      {ctx.placeOfServiceOptions.map((place) => (
        <DmChecbox
          key={place}
          className="py-[14]"
          textClassName="flex-1 text-14 leading-[18px] font-custom400"
          variant="circle"
          title={t(place)}
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
          onPress={ctx.onClose}
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

// ── Outer modal screen (contains the nested navigator) ──
type Props = RootStackScreenProps<"QuestionStepScreen">

const QuestionStepScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    categoryName,
    placeOfServiceOptions,
    customerQuestions,
  } = route.params

  // Build steps
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

    return result
  }, [placeOfServiceOptions, customerQuestions])

  // Shared state
  const [answers, setAnswers] = useState<QuestionAnswerType[]>([])
  const [selectedPlaceOfService, setSelectedPlaceOfService] = useState<string | undefined>()

  const handleDone = useCallback(() => {
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

    navigation.goBack()
  }, [answers, steps, selectedPlaceOfService, navigation])

  const handleClose = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const sharedState: SharedState = useMemo(() => ({
    steps,
    totalSteps: steps.length,
    categoryName,
    placeOfServiceOptions,
    answers,
    selectedPlaceOfService,
    setAnswers,
    setSelectedPlaceOfService,
    onDone: handleDone,
    onClose: handleClose,
  }), [steps, categoryName, placeOfServiceOptions, answers, selectedPlaceOfService, handleDone, handleClose])

  return (
    <SharedStateContext.Provider value={sharedState}>
      <InnerStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: "default",
        }}
      >
        <InnerStack.Screen
          name="QuestionStep"
          component={QuestionStepInner}
          initialParams={{ stepIndex: 0 }}
        />
      </InnerStack.Navigator>
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
})

export default QuestionStepScreen
