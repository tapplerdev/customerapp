import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Platform, ScrollView, StyleSheet } from "react-native"
import {
  BottomSheetModal,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet"
import { FullWindowOverlay } from "react-native-screens"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import { ServiceQuestionType } from "types/cms"
import { QuestionAnswerType } from "types/job"
import QuestionComponent from "components/QuestionComponent/QuestionComponent"

import CloseIcon from "assets/icons/close.svg"
import CheckMarkIcon from "assets/icons/check-mark.svg"
import FiltersIcon from "assets/icons/filters.svg"

interface AllQuestionsModalProps {
  isVisible: boolean
  categoryName: string
  placeOfServiceOptions: string[]
  customerQuestions: ServiceQuestionType[]
  initialAnswers: QuestionAnswerType[]
  initialPlaceOfService?: string
  onDismiss: (result: {
    placeOfService?: string
    filterOptionIds: number[]
    dataAnswers: QuestionAnswerType[]
    allAnswers: QuestionAnswerType[]
    filtersChanged: boolean
  }) => void
}

const PLACE_OF_SERVICE_LABELS: Record<string, string> = {
  proToCustomer: "at_my_location",
  customerToPro: "at_pro_location",
  remoteOrOnline: "online_remote",
  delivery: "delivery_service",
  fixedLocations: "at_fixed_location",
}

const AllQuestionsModal: React.FC<AllQuestionsModalProps> = ({
  isVisible,
  categoryName,
  placeOfServiceOptions,
  customerQuestions,
  initialAnswers,
  initialPlaceOfService,
  onDismiss,
}) => {
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const modalRef = useRef<BottomSheetModal>(null)

  const snapPoints = useMemo(() => ["92%"], [])

  const [answers, setAnswers] = useState<QuestionAnswerType[]>(initialAnswers)
  const [selectedPlaceOfService, setSelectedPlaceOfService] = useState<string | undefined>(initialPlaceOfService)
  const [filtersChanged, setFiltersChanged] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  // Sync when initialAnswers change (e.g. from step-by-step modal)
  useEffect(() => {
    setAnswers(initialAnswers)
    setSelectedPlaceOfService(initialPlaceOfService)
  }, [initialAnswers, initialPlaceOfService])

  useEffect(() => {
    if (isVisible) {
      modalRef.current?.present()
    }
  }, [isVisible])

  const allQuestions = useMemo(() => {
    return customerQuestions
      .filter((q) => q.assignee === "customer")
      .sort((a, b) => a.order - b.order)
  }, [customerQuestions])

  const totalQuestions = allQuestions.length + (placeOfServiceOptions.length > 1 ? 1 : 0)
  const answeredCount = useMemo(() => {
    let count = selectedPlaceOfService ? 1 : 0
    allQuestions.forEach((q) => {
      const ans = answers.find((a) => a.questionId === q.id)
      if (!ans) return
      if (q.type === "shortAnswer" || q.type === "paragraph") {
        if (ans.answer) count++
      } else if (q.type === "oneChoice") {
        if (ans.optionId) count++
      } else if (q.type === "multipleChoice") {
        if (ans.optionsIds?.length) count++
      } else if (q.type === "dateTime") {
        if (ans.date || ans.startDate) count++
      }
    })
    return count
  }, [answers, allQuestions, selectedPlaceOfService])

  const isQuestionAnswered = (q: ServiceQuestionType) => {
    const ans = answers.find((a) => a.questionId === q.id)
    if (!ans) return false
    if (q.type === "shortAnswer" || q.type === "paragraph") return !!ans.answer
    if (q.type === "oneChoice") return !!ans.optionId
    if (q.type === "multipleChoice") return !!ans.optionsIds?.length
    if (q.type === "dateTime") return !!ans.date || !!ans.startDate
    return false
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

  const collectResult = useCallback(() => {
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

    return {
      placeOfService: selectedPlaceOfService,
      filterOptionIds,
      dataAnswers,
      allAnswers: answers,
      filtersChanged,
    }
  }, [answers, allQuestions, selectedPlaceOfService, filtersChanged])

  const handleSeeMatches = () => {
    onDismiss(collectResult())
    modalRef.current?.dismiss()
  }

  const handleDismiss = useCallback(() => {
    onDismiss(collectResult())
  }, [onDismiss, collectResult])

  const handleClose = () => {
    modalRef.current?.dismiss()
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

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      containerComponent={renderContainerComponent}
      onDismiss={handleDismiss}
      handleComponent={null}
      backgroundStyle={{ borderTopLeftRadius: 10, borderTopRightRadius: 10 }}
    >
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
        {allQuestions.map((question) => {
          return (
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
          )
        })}

        {/* Reset at bottom of scroll content */}
        <DmView className="mx-[24] h-[1] bg-grey5 mt-[8]" />
        <DmView onPress={handleResetAll} className="px-[24] py-[16]">
          <DmText className="text-14 leading-[18px] font-custom600 text-red">
            {t("reset_all")}
          </DmText>
        </DmView>
      </ScrollView>

      {/* Bottom button area */}
      <DmView
        className="px-[16] pt-[17] bg-white"
        style={[modalStyles.buttonShadow, { paddingBottom: insets.bottom + 16 }]}
      >
        <ActionBtn
          title={t("see_matches")}
          onPress={handleSeeMatches}
          className="h-[52] rounded-10"
          textClassName="text-16 font-custom600"
        />
      </DmView>
    </BottomSheetModal>
  )
}

const modalStyles = StyleSheet.create({
  buttonShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 5,
  },
})

export default AllQuestionsModal
