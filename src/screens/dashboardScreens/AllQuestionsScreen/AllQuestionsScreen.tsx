import React, { useCallback, useMemo, useState } from "react"
import { ScrollView, StyleSheet } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import { ServiceQuestionType } from "types/cms"
import { QuestionAnswerType } from "types/job"
import QuestionComponent from "components/QuestionComponent/QuestionComponent"

import CloseIcon from "assets/icons/close.svg"

const PLACE_OF_SERVICE_LABELS: Record<string, string> = {
  proToCustomer: "at_my_location",
  customerToPro: "at_pro_location",
  remoteOrOnline: "online_remote",
  delivery: "delivery_service",
  fixedLocations: "at_fixed_location",
}

type Props = RootStackScreenProps<"AllQuestionsScreen">

const AllQuestionsScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    categoryName,
    placeOfServiceOptions,
    customerQuestions,
    initialAnswers,
    initialPlaceOfService,
    onApply,
  } = route.params

  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [answers, setAnswers] = useState<QuestionAnswerType[]>(initialAnswers || [])
  const [selectedPlaceOfService, setSelectedPlaceOfService] = useState<string | undefined>(initialPlaceOfService)
  const [filtersChanged, setFiltersChanged] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  const allQuestions = useMemo(() => {
    return customerQuestions
      .filter((q) => q.assignee === "customer")
      .sort((a, b) => a.order - b.order)
  }, [customerQuestions])

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

    const question = allQuestions.find((q) => q.id === answer.questionId)
    if (question?.isFilter) {
      setFiltersChanged(true)
    }
  }

  const handleSelectPlaceOfService = (place: string) => {
    setSelectedPlaceOfService(place)
    setFiltersChanged(true)
  }

  const handleResetAll = () => {
    setAnswers([])
    setSelectedPlaceOfService(undefined)
    setFiltersChanged(true)
    setResetKey((prev) => prev + 1)
  }

  const handleSeeMatches = () => {
    const filterOptionIds: number[] = []
    const dataAnswers: QuestionAnswerType[] = []

    answers.forEach((ans) => {
      const question = allQuestions.find((q) => q.id === ans.questionId)
      if (!question) return

      if (question.isFilter) {
        const options = question.options || []
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

    onApply({
      placeOfService: selectedPlaceOfService,
      filterOptionIds,
      dataAnswers,
      allAnswers: answers,
      filtersChanged,
    })
    navigation.goBack()
  }

  const handleClose = () => {
    navigation.goBack()
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={[]}>
      {/* Header */}
      <DmView className="items-center pt-[16] pb-[12] px-[20]">
        <DmView className="flex-row items-center justify-center w-full">
          <DmView className="flex-1" />
          <DmText className="text-16 leading-[20px] font-custom700 text-black">
            {t("job_details")}
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

      {/* Scrollable content */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Category name + subtitle */}
        <DmView className="px-[24] pt-[20] pb-[16]">
          <DmText className="text-20 leading-[24px] font-custom700 text-black">
            {categoryName}
          </DmText>
          <DmText className="text-13 leading-[18px] font-custom400 text-grey3 mt-[4]">
            {t("answer_questions_for_better_matches")}
          </DmText>
        </DmView>

        {/* Place of service question */}
        {placeOfServiceOptions.length > 1 && (
          <>
            <DmView className="mx-[24] h-[1] bg-grey5" />
            <DmView className="px-[24] pt-[20] pb-[8]">
              <DmText className="text-15 leading-[19px] font-custom700 text-black mb-[14]">
                {t("how_do_you_want_service")}
              </DmText>
              {placeOfServiceOptions.map((option) => {
                const isSelected = selectedPlaceOfService === option
                const labelKey = PLACE_OF_SERVICE_LABELS[option] || option
                return (
                  <DmView
                    key={option}
                    onPress={() => handleSelectPlaceOfService(option)}
                    className="flex-row items-center justify-between py-[12]"
                  >
                    <DmText className="text-13 leading-[16px] font-custom400 text-black flex-1">
                      {t(labelKey)}
                    </DmText>
                    <DmView
                      className={`w-[20] h-[20] rounded-full border-2 items-center justify-center ${
                        isSelected ? "border-red" : "border-grey5"
                      }`}
                    >
                      {isSelected && <DmView className="w-[12] h-[12] rounded-full bg-red" />}
                    </DmView>
                  </DmView>
                )
              })}
            </DmView>
          </>
        )}

        {/* All customer questions */}
        {allQuestions.map((question) => (
          <React.Fragment key={`${question.id}-${resetKey}`}>
            <DmView className="mx-[24] h-[1] bg-grey5" />
            <DmView className="pt-[20] pb-[4]">
              <DmView className="px-[10]">
                <QuestionComponent
                  item={question}
                  onChangeAnswer={handleChangeAnswer}
                  answers={answers}
                  hideBorders
                />
              </DmView>
            </DmView>
          </React.Fragment>
        ))}

        {/* Reset at bottom */}
        <DmView className="mx-[24] h-[1] bg-grey5 mt-[8]" />
        <DmView onPress={handleResetAll} className="px-[24] py-[16]">
          <DmText className="text-14 leading-[18px] font-custom600 text-red">
            {t("reset_all")}
          </DmText>
        </DmView>
      </ScrollView>

      {/* Bottom button */}
      <DmView
        className="px-[16] pt-[17] bg-white"
        style={[styles.buttonShadow, { paddingBottom: insets.bottom + 16 }]}
      >
        <ActionBtn
          title={t("see_matches")}
          onPress={handleSeeMatches}
          className="h-[52] rounded-10"
          textClassName="text-16 font-custom600"
        />
      </DmView>
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

export default AllQuestionsScreen
