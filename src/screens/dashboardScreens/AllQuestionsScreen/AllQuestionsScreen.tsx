import React, { useEffect, useMemo, useState, useRef } from "react"
import { StyleSheet } from "react-native"
import type { ScrollView } from "react-native"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { DmView } from "@tappler/shared/src/components/UI"
import { AllQuestionsParams } from "navigation/types"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import colors from "@tappler/shared/src/styles/colors"
import { QuestionAnswerType } from "types/job"
import QuestionComponent from "components/QuestionComponent/QuestionComponent"
import NativeSheet from "@tappler/shared/src/components/NativeSheet/NativeSheet"
import { useFullSheetHeight } from "@tappler/shared/src/components/NativeSheet/useFullSheetHeight"
import { useKeyboardInset } from "@tappler/shared/src/hooks/useKeyboardInset"

import CloseIcon from "assets/icons/close.svg"
import { AppScrollView } from "components/scroll"
import { Text, Button, a as atoms, px } from "@tappler/shared/src/ds"
import dsStyles from "./styles"

const PLACE_OF_SERVICE_LABELS: Record<string, string> = {
  proToCustomer: "at_my_location",
  customerToPro: "at_pro_location",
  remoteOrOnline: "online_remote",
  delivery: "delivery_service",
  fixedLocations: "at_fixed_location",
}

type ContentProps = AllQuestionsParams & {
  scrollRef: React.RefObject<ScrollView | null>
  onClose: () => void
  /** Lets the presenter commit answers when the sheet is dismissed natively
      (swipe/dim-tap) — every exit path commits, matching X / See matches. */
  registerCommit?: (commit: () => void) => void
}

const AllQuestionsContent: React.FC<ContentProps> = ({
  scrollRef,
  categoryName,
  placeOfServiceOptions,
  customerQuestions,
  initialAnswers,
  initialPlaceOfService,
  onApply,
  onClose,
  registerCommit,
}) => {
  const insets = useSafeAreaInsets()
  const keyboardInset = useKeyboardInset()
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

  const [resetAllPressed, setResetAllPressed] = useState(false)

  const handleResetAll = () => {
    setAnswers([])
    setSelectedPlaceOfService(undefined)
    setFiltersChanged(true)
    setResetAllPressed(true) // signals the results screen to also clear slider filters
    setResetKey((prev) => prev + 1)
  }

  // Both exits commit the latest state — ✕ and "See matches" behave the same.
  const commitAnswers = () => {
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
      resetAll: resetAllPressed,
    })
  }

  // Keep the presenter's dismiss-commit pointing at the LATEST state
  useEffect(() => {
    registerCommit?.(commitAnswers)
  })

  const handleSeeMatches = () => {
    commitAnswers()
    onClose()
  }

  const handleClose = () => {
    handleSeeMatches()
  }

  return (
    /*
      iOS-only keyboard inset on the OUTER container — the footer button is a
      sibling AFTER the ScrollView, so nothing in the scroll content can lift it.
      Padding here shrinks the scroller and raises the footer together.
      See useKeyboardInset for why Android gets 0.
    */
    <SafeAreaView
      edges={[]}
      style={[atoms.flex_1, dsStyles.safeArea, { paddingBottom: keyboardInset }]}
    >
      {/* Header */}
      <DmView style={[atoms.items_center, atoms.pt_16, atoms.pb_12, atoms.px_20]}>
        <DmView style={[atoms.flex_row, atoms.items_center, atoms.justify_center, atoms.w_full]}>
          <DmView style={atoms.flex_1} />
          <Text size={16} weight="bold">
            {t("job_details")}
          </Text>
          <DmView style={[atoms.flex_1, atoms.items_end]}>
            <DmView
              onPress={handleClose}
              style={[
                dsStyles.iconWrap,
                atoms.items_center,
                atoms.justify_center,
              ]}
              hitSlop={HIT_SLOP_DEFAULT}
            >
              <CloseIcon width={16} height={16} color={colors.red} />
            </DmView>
          </DmView>
        </DmView>
      </DmView>

      {/* Scrollable content */}
      <AppScrollView
        ref={scrollRef}
        style={atoms.flex_1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Category name + subtitle */}
        <DmView style={[atoms.px_24, atoms.pt_20, atoms.pb_16]}>
          <Text size={20} weight="bold" leading="tight">
            {categoryName}
          </Text>
          <Text size={13} color="tertiary" style={atoms.mt_4}>
            {t("answer_questions_for_better_matches")}
          </Text>
        </DmView>

        {/* Place of service question */}
        {placeOfServiceOptions.length > 1 && (
          <>
            <DmView style={[atoms.mx_24, dsStyles.box]} />
            <DmView style={[atoms.px_24, atoms.pt_20, atoms.pb_8]}>
              <Text size={15} weight="bold" leading="tight" style={atoms.mb_14}>
                {t("how_do_you_want_service")}
              </Text>
              {placeOfServiceOptions.map((option) => {
                const isSelected = selectedPlaceOfService === option
                const labelKey = PLACE_OF_SERVICE_LABELS[option] || option
                return (
                  <DmView
                    key={option}
                    onPress={() => handleSelectPlaceOfService(option)}
                    style={[
                      atoms.flex_row,
                      atoms.items_center,
                      atoms.justify_between,
                      atoms.py_12,
                    ]}
                  >
                    <Text size={13} leading="tight" style={atoms.flex_1}>
                      {t(labelKey)}
                    </Text>
                    <DmView
                      style={[
                        dsStyles.box2,
                        atoms.items_center,
                        atoms.justify_center,
                        isSelected ? dsStyles.boxSelected : dsStyles.boxNotSelected,
                      ]}
                    >
                      {isSelected && <DmView style={dsStyles.box3} />}
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
            <DmView style={[atoms.mx_24, dsStyles.box]} />
            <DmView style={[atoms.pt_20, atoms.pb_4]}>
              <DmView style={atoms.px_10}>
                <QuestionComponent
                  item={question}
                  onChangeAnswer={handleChangeAnswer}
                  answers={answers}
                  hideBorders
                  compact
                  allQuestions={allQuestions}
                />
              </DmView>
            </DmView>
          </React.Fragment>
        ))}

        {/* Reset at bottom */}
        <DmView style={[atoms.mx_24, dsStyles.box, atoms.mt_8]} />
        <DmView onPress={handleResetAll} style={[atoms.px_24, atoms.py_16]}>
          <Text size={14} weight="semibold" color="brand">
            {t("reset_all")}
          </Text>
        </DmView>
      </AppScrollView>

      {/* Bottom button */}
      <DmView
        style={[atoms.px_16, dsStyles.buttonWrap, styles.buttonShadow, { paddingBottom: insets.bottom + 16 }]}
      >
        <Button
          title={t("see_matches")}
          onPress={handleSeeMatches}
          size={px(52)}
          shape="r10"
          labelWeight="semibold"
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

/**
 * The job-details editor, inside the native push-back sheet — both platforms.
 * A native dismiss (swipe/dim-tap, or Android's back button, which Material
 * routes to the same dismissal) commits answers first — same contract as
 * X / "See matches". `contentKey` re-seeds state on every open.
 *
 * There used to be an Android-only `AllQuestionsScreen` route beside this,
 * with its own BackHandler doing by hand what the dialog does for free. See
 * the note in FiltersScreen.tsx for why both are gone. The file keeps its
 * name; nothing here is a screen.
 */
export const AllQuestionsSheet: React.FC<
  AllQuestionsParams & { visible: boolean; contentKey: number; onClose: () => void }
> = ({ visible, contentKey, onClose, ...contentProps }) => {
  const scrollRef = useRef<ScrollView>(null)
  const commitRef = React.useRef<() => void>(() => {})
  const fullSheetHeight = useFullSheetHeight()
  return (
    <NativeSheet
      visible={visible}
      height={fullSheetHeight}
      scrollableRef={scrollRef}
      onDismissed={() => {
        commitRef.current()
        onClose()
      }}
    >
      <AllQuestionsContent
        key={contentKey}
        {...contentProps}
        onClose={onClose}
        registerCommit={(fn) => {
          commitRef.current = fn
        }}
        scrollRef={scrollRef}
      />
    </NativeSheet>
  )
}
