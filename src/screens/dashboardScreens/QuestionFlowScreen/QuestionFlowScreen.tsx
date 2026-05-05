import React, { useCallback, useMemo, useState } from "react"
import { ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmChecbox, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { useGetServiceByIdQuery } from "services/api"
import { ServiceQuestionType } from "types/cms"
import { QuestionAnswerType } from "types/job"
import QuestionComponent from "components/QuestionComponent/QuestionComponent"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"
import { questionFlowEventBus } from "events/questionFlowEventBus"

import CloseIcon from "assets/icons/close.svg"
import colors from "@tappler/shared/src/styles/colors"

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

type Props = RootStackScreenProps<"QuestionFlowScreen">

const QuestionFlowScreen: React.FC<Props> = ({ route, navigation }) => {
  const { categoryId, categoryName, serviceId, placeOfServiceOptions } = route.params
  const { t } = useTranslation()

  const { data: serviceData, isLoading } = useGetServiceByIdQuery(serviceId)
  const category = serviceData?.categories?.find((c) => c.id === categoryId)
  const customerQuestions = category?.customerQuestions || []

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedPlaceOfService, setSelectedPlaceOfService] = useState<string | undefined>()
  const [answers, setAnswers] = useState<QuestionAnswerType[]>([])
  const [filtersChanged, setFiltersChanged] = useState(false)

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

  const totalSteps = steps.length
  const currentStep = steps[currentIndex]
  const progress = totalSteps > 0 ? (currentIndex + 1) / totalSteps : 0

  const emitAndClose = useCallback(() => {
    const filterOptionIds: number[] = []
    const dataAnswers: QuestionAnswerType[] = []

    answers.forEach((ans) => {
      const step = steps.find(
        (s) => s.type === "question" && s.question.id === ans.questionId
      )
      if (!step || step.type !== "question") return

      if (step.question.isFilter) {
        if (ans.optionId) filterOptionIds.push(ans.optionId)
        if (ans.optionsIds) filterOptionIds.push(...ans.optionsIds)
      } else {
        dataAnswers.push(ans)
      }
    })

    questionFlowEventBus.emit("questions:done", {
      placeOfService: selectedPlaceOfService,
      filterOptionIds,
      dataAnswers,
      filtersChanged,
    })

    navigation.goBack()
  }, [answers, steps, selectedPlaceOfService, filtersChanged, navigation])

  const handleNext = () => {
    if (currentIndex < totalSteps - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      emitAndClose()
    }
  }

  const handleSkip = () => {
    if (currentIndex < totalSteps - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      emitAndClose()
    }
  }

  const handleClose = () => {
    emitAndClose()
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

  if (isLoading || totalSteps === 0) {
    return isLoading ? <LoadingOverlay /> : null
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      {/* Header */}
      <DmView className="items-center pt-[8] pb-[14] px-[20]">
        <DmView className="flex-row items-center w-full">
          <DmView className="flex-1" />
          <DmText className="text-14 leading-[18px] font-custom600 text-black">
            {categoryName}
          </DmText>
          <DmView className="flex-1 items-end">
            <DmView onPress={handleClose} className="w-[32] h-[32] items-center justify-center">
              <CloseIcon width={16} height={16} color={colors.black} />
            </DmView>
          </DmView>
        </DmView>
      </DmView>

      {/* Progress bar */}
      <DmView className="h-[3] bg-grey5">
        <DmView
          className="h-[3] bg-red"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </DmView>

      {/* Scrollable content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 28, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {currentStep?.type === "placeOfService" && (
          <DmView className="px-[24]">
            <DmText className="text-22 leading-[28px] font-custom700 text-black mb-[6]">
              {t("how_do_you_want_service")}
            </DmText>
            <DmText className="text-14 leading-[18px] font-custom400 text-grey3 mb-[28]">
              {t("select_one")}
            </DmText>
            {placeOfServiceOptions.map((option, index) => {
              const isSelected = selectedPlaceOfService === option
              const labelKey = PLACE_OF_SERVICE_LABELS[option] || option
              return (
                <DmChecbox
                  key={option}
                  className={index > 0 ? "mt-[20]" : ""}
                  textClassName="flex-1 text-16 font-custom400"
                  variant="circle"
                  title={t(labelKey)}
                  onPress={() => handleSelectPlaceOfService(option)}
                  isChecked={isSelected}
                />
              )
            })}
          </DmView>
        )}

        {currentStep?.type === "question" && (
          <DmView className="px-[24]">
            <DmText className="text-22 leading-[28px] font-custom700 text-black mb-[6]">
              {currentStep.question.text}
            </DmText>
            {currentStep.question.type === "multipleChoice" && (
              <DmText className="text-14 leading-[18px] font-custom400 text-grey3 mb-[20]">
                {t("select_all_that_apply")}
              </DmText>
            )}
            {currentStep.question.type !== "multipleChoice" && <DmView className="mb-[20]" />}
            <QuestionComponent
              item={currentStep.question}
              onChangeAnswer={handleChangeAnswer}
              answers={answers}
            />
          </DmView>
        )}
      </ScrollView>

      {/* Bottom button area */}
      <DmView className="px-[20] pt-[12] pb-[8] border-t border-grey5">
        <ActionBtn
          title={currentIndex === totalSteps - 1 ? t("done") : t("next")}
          onPress={handleNext}
          className="h-[52] rounded-10"
          textClassName="text-16 font-custom600"
        />
        <DmView onPress={handleSkip} className="items-center mt-[14] mb-[4]">
          <DmText className="text-14 leading-[18px] font-custom500 text-grey3">
            {t("skip")}
          </DmText>
        </DmView>
      </DmView>
    </SafeAreaView>
  )
}

export default QuestionFlowScreen
