import React, { useLayoutEffect, useMemo, useState } from "react"
import { I18nManager, Keyboard, TextInput } from "react-native"

import { DmChecbox, DmInput, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import { ServiceQuestionType, QuestionOptionType } from "types/cms"
import { useTranslation } from "react-i18next"
import { QuestionAnswerType } from "types/job"
import ChipButton from "components/ChipButton/ChipButton"
import ImageWithTextButton from "components/ImageWithTextButton/ImageWithTextButton"
import ImageWithCheckmarkButton from "components/ImageWithCheckmarkButton/ImageWithCheckmarkButton"
import TextWithCheckmarkButton from "components/TextWithCheckmarkButton/TextWithCheckmarkButton"
import CalendarTimePicker, {
  type CalendarSelection,
  isAnyTimeSlot,
} from "components/CalendarTimePicker/CalendarTimePicker"

import CheckmarkIcon from "assets/icons/check-mark.svg"
import styles from "./styles"
import { AppScrollView } from "components/scroll"
import { Text, a as atoms } from "@tappler/shared/src/ds"

interface Props {
  item: ServiceQuestionType
  onChangeAnswer: (answer: QuestionAnswerType) => void
  answers?: QuestionAnswerType[]
  hideBorders?: boolean
  /** Tightens title weight, checkbox size, and chip size to match the compact
      place-of-service block (used in the all-questions "Job Details" list). */
  compact?: boolean
  /** Enables cascade coherence for parented filter questions (Make → Model):
      narrows child options to selected parents, auto-selects a child's parent,
      and prunes orphaned child picks when a parent is deselected. Cascade
      emits extra onChangeAnswer calls for OTHER questions — only pass this
      where the handler upserts by answer.questionId. */
  allQuestions?: ServiceQuestionType[]
}

const QuestionComponent: React.FC<Props> = ({
  item,
  onChangeAnswer,
  answers,
  hideBorders,
  compact,
  allQuestions,
}) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  // Fall back to the En columns when Ar is missing — CMS content often has
  // empty textAr/valueAr (same pattern as FiltersScreen/RequestSummaryScreen).
  const getOptionLabel = (opt: QuestionOptionType) =>
    isAr && opt.valueAr ? opt.valueAr : opt.value

  const getQuestionText = () =>
    isAr && item.textAr ? item.textAr : item.text

  const currentAnswer = answers?.find((a) => a.questionId === item.id)
  const [answer, setAnswer] = useState<QuestionAnswerType | undefined>(currentAnswer)
  const [inputValue, setInputValue] = useState(currentAnswer?.answer || "")
  // Compact list only: the date picker opens in place under the answer.
  const [isDatePickerOpen, setDatePickerOpen] = useState(false)

  useLayoutEffect(() => {
    if (answers?.length) {
      const match = answers.find((a) => a.questionId === item.id)
      if (match && JSON.stringify(match) !== JSON.stringify(answer)) {
        setAnswer(match)
        if (match.answer) setInputValue(match.answer)
      }
    }
  }, [answers, item.id])

  const handleChangeInput = (val: string) => {
    setInputValue(val)
    const newAnswer: QuestionAnswerType = { questionId: item.id, answer: val }
    setAnswer(newAnswer)
    onChangeAnswer(newAnswer)
  }

  // ── Cascade coherence (parented filters, e.g. Make → Model) ─────────────
  // Selecting a child with no parent chosen auto-selects the parent option
  // (a child answer without its parent barely filters server-side);
  // deselecting a parent prunes its now-orphaned child picks. Inert unless
  // allQuestions is provided.
  const emitCascade = (selecting: boolean, option: QuestionOptionType) => {
    if (!allQuestions?.length) return

    if (selecting && option.parentFilterOptionKey) {
      const pk = option.parentFilterOptionKey
      const parentQ = allQuestions.find(
        (q) => q.id !== item.id && q.options?.some((o) => o.filterOptionKey === pk)
      )
      const pOpt = parentQ?.options?.find((o) => o.filterOptionKey === pk)
      if (!parentQ || !pOpt) return
      const pAns = answers?.find((a) => a.questionId === parentQ.id)
      if (parentQ.type === "multipleChoice") {
        if (pAns?.optionsIds?.includes(pOpt.id)) return
        const ids = [...(pAns?.optionsIds || []), pOpt.id]
        const existing = pAns?.answer?.split(", ").filter(Boolean) || []
        onChangeAnswer({
          questionId: parentQ.id,
          optionsIds: ids,
          answer: [...new Set([...existing, pOpt.value])].join(", "),
        })
      } else {
        if (pAns?.optionId === pOpt.id) return
        onChangeAnswer({ questionId: parentQ.id, optionId: pOpt.id, answer: pOpt.value })
      }
    }

    if (!selecting && option.filterOptionKey) {
      const rk = option.filterOptionKey
      allQuestions.forEach((q) => {
        if (q.id === item.id) return
        if (!q.options?.some((o) => o.parentFilterOptionKey === rk)) return
        const cAns = answers?.find((a) => a.questionId === q.id)
        if (!cAns) return
        if (q.type === "multipleChoice" && cAns.optionsIds?.length) {
          const keep = cAns.optionsIds.filter(
            (id) => q.options?.find((o) => o.id === id)?.parentFilterOptionKey !== rk
          )
          if (keep.length !== cAns.optionsIds.length) {
            const keepVals = keep
              .map((id) => q.options?.find((o) => o.id === id)?.value)
              .filter(Boolean)
            onChangeAnswer({ questionId: q.id, optionsIds: keep, answer: keepVals.join(", ") })
          }
        } else if (cAns.optionId) {
          const cOpt = q.options?.find((o) => o.id === cAns.optionId)
          if (cOpt?.parentFilterOptionKey === rk) {
            onChangeAnswer({ questionId: q.id })
          }
        }
      })
    }
  }

  const handleSelectOption = (option: QuestionOptionType) => {
    if (item.type === "multipleChoice") {
      const prevIds = answer?.optionsIds || []
      let newIds: number[]
      let newAnswerText: string
      const isDeselecting = prevIds.includes(option.id)

      if (isDeselecting) {
        newIds = prevIds.filter((id) => id !== option.id)
        newAnswerText = (answer?.answer || "")
          .split(", ")
          .filter((v) => v !== option.value)
          .join(", ")
      } else {
        newIds = [...prevIds, option.id]
        const existing = answer?.answer?.split(", ").filter(Boolean) || []
        newAnswerText = [...new Set([...existing, option.value])].join(", ")
      }

      const newAnswer: QuestionAnswerType = {
        questionId: item.id,
        optionsIds: newIds,
        answer: newAnswerText,
      }
      setAnswer(newAnswer)
      onChangeAnswer(newAnswer)
      emitCascade(!isDeselecting, option)
    } else {
      // oneChoice — toggle
      const isDeselecting = answer?.optionId === option.id
      const newAnswer: QuestionAnswerType = isDeselecting
        ? { questionId: item.id }
        : { questionId: item.id, optionId: option.id, answer: option.value }
      setAnswer(newAnswer)
      onChangeAnswer(newAnswer)
      if (isDeselecting) {
        emitCascade(false, option)
      } else {
        // Switching away from a previous pick releases ITS children first
        const prevOpt = item.options?.find((o) => o.id === answer?.optionId)
        if (prevOpt) emitCascade(false, prevOpt)
        emitCascade(true, option)
      }
    }
  }

  // Narrow parented options to the selected parents' children (Thumbtack
  // behavior: BMW picked → only BMW models). With NO parent picked yet, all
  // children stay visible — partial answering is allowed, and tapping a child
  // then auto-selects its parent via emitCascade.
  const visibleOptions = useMemo(() => {
    const opts = item.options
    if (!opts?.length || !allQuestions?.length) return opts
    const myParentKeys = new Set(
      opts.map((o) => o.parentFilterOptionKey).filter(Boolean) as string[]
    )
    if (!myParentKeys.size) return opts
    const selectedKeys = new Set<string>()
    answers?.forEach((a) => {
      if (a.questionId === item.id) return
      const q = allQuestions.find((qq) => qq.id === a.questionId)
      if (!q) return
      const ids =
        q.type === "multipleChoice" ? a.optionsIds || [] : a.optionId ? [a.optionId] : []
      ids.forEach((id) => {
        const k = q.options?.find((o) => o.id === id)?.filterOptionKey
        if (k) selectedKeys.add(k)
      })
    })
    const anyParentSelected = [...myParentKeys].some((k) => selectedKeys.has(k))
    if (!anyParentSelected) return opts
    return opts.filter(
      (o) => !o.parentFilterOptionKey || selectedKeys.has(o.parentFilterOptionKey)
    )
  }, [item, allQuestions, answers])

  const isOptionSelected = (option: QuestionOptionType) => {
    if (item.type === "multipleChoice" && answer?.optionsIds?.length) {
      return answer.optionsIds.includes(option.id)
    }
    if (item.type === "oneChoice") {
      return answer?.optionId === option.id || answer?.answer === option.value
    }
    return false
  }

  // The picker is inline, so an answer is saved the moment a day and a time
  // are picked. Taking the time away (tapping it again, or a day where it is
  // over) clears a saved answer, so the old day and time never stand behind
  // what the picker shows; with nothing saved yet, nothing is written.
  // Questions offer no ASAP: an answer has no field for it.
  const handleDateSelection = (selection: CalendarSelection | null) => {
    if (!selection) {
      if (answer?.date || answer?.startDate) {
        const cleared: QuestionAnswerType = { questionId: item.id }
        setAnswer(cleared)
        onChangeAnswer(cleared)
      }
      return
    }
    const newAnswer: QuestionAnswerType = { questionId: item.id }
    if (item.dateType === "dateRange") {
      newAnswer.startDate = selection.date
      newAnswer.endDate = selection.date
    } else {
      newAnswer.date = selection.date
    }
    newAnswer.startTime = selection.timeSlot.start
    newAnswer.endTime = selection.timeSlot.end
    if (compact) setDatePickerOpen(false)
    setAnswer(newAnswer)
    onChangeAnswer(newAnswer)
  }

  const answeredDay = answer?.date || answer?.startDate
  const answeredSlot =
    answer?.startTime && answer?.endTime
      ? { start: answer.startTime, end: answer.endTime }
      : undefined
  const dateAnswerText = !answeredDay
    ? ""
    : answeredSlot
      ? `${answeredDay}  •  ${
          isAnyTimeSlot(answeredSlot)
            ? t("any_time")
            : `${answeredSlot.start} - ${answeredSlot.end}`
        }`
      : answeredDay

  // --- Render helpers for choice styles ---

  const renderChips = () => {
    const layout = item.layoutQuestionStyle || "onePerRow"
    // Space chips via the container's flex `gap` (an inline style) so it applies
    // reliably — the per-chip className margin wasn't separating them.
    const gap = compact ? 10 : 14
    const chips = visibleOptions?.map((opt, idx) => (
      <ChipButton
        key={idx}
        label={getOptionLabel(opt)}
        isSelected={isOptionSelected(opt)}
        onPress={() => handleSelectOption(opt)}
        compact={compact}
      />
    ))

    if (layout === "horizontal") {
      return (
        <AppScrollView horizontal showsHorizontalScrollIndicator={false} style={atoms.mt_16}>
          <DmView style={[atoms.flex_row, { gap }]}>{chips}</DmView>
        </AppScrollView>
      )
    }
    if (layout === "wrap") {
      return <DmView style={[atoms.flex_row, atoms.flex_wrap, atoms.mt_16, { gap }]}>{chips}</DmView>
    }
    return <DmView style={[atoms.mt_16, { gap }]}>{chips}</DmView>
  }

  const renderImageWithText = () => {
    const layout = item.layoutQuestionStyle || "onePerRow"
    const elements = visibleOptions?.map((opt, idx) => (
      <ImageWithTextButton
        key={idx}
        label={getOptionLabel(opt)}
        imageUrl={opt.icon || ""}
        isSelected={isOptionSelected(opt)}
        onPress={() => handleSelectOption(opt)}
      />
    ))

    if (layout === "horizontal") {
      return (
        <AppScrollView horizontal showsHorizontalScrollIndicator={false} style={atoms.mt_16}>
          <DmView style={[atoms.flex_row, atoms.items_center]}>{elements}</DmView>
        </AppScrollView>
      )
    }
    if (layout === "wrap") {
      return <DmView style={[atoms.flex_row, atoms.flex_wrap, atoms.items_center, atoms.mt_16]}>{elements}</DmView>
    }
    return <DmView style={[atoms.mt_16, atoms.items_start]}>{elements}</DmView>
  }

  const renderImageWithCheckmark = () => {
    const layout = item.layoutQuestionStyle || "onePerRow"
    const elements = visibleOptions?.map((opt, idx) => (
      <ImageWithCheckmarkButton
        key={idx}
        label={getOptionLabel(opt)}
        imageUrl={opt.icon || ""}
        isSelected={isOptionSelected(opt)}
        onPress={() => handleSelectOption(opt)}
      />
    ))

    if (layout === "horizontal") {
      return (
        <AppScrollView horizontal showsHorizontalScrollIndicator={false} style={atoms.mt_16}>
          <DmView style={[atoms.flex_row, atoms.items_center]}>{elements}</DmView>
        </AppScrollView>
      )
    }
    if (layout === "wrap") {
      return <DmView style={[atoms.flex_row, atoms.flex_wrap, atoms.items_center, atoms.mt_16]}>{elements}</DmView>
    }
    return <DmView style={[atoms.mt_16, atoms.items_start]}>{elements}</DmView>
  }

  const renderTextWithCheckmark = () => {
    const layout = item.layoutQuestionStyle || "onePerRow"
    const elements = visibleOptions?.map((opt, idx) => (
      <TextWithCheckmarkButton
        key={idx}
        label={getOptionLabel(opt)}
        isSelected={isOptionSelected(opt)}
        onPress={() => handleSelectOption(opt)}
      />
    ))

    if (layout === "horizontal") {
      return (
        <AppScrollView horizontal showsHorizontalScrollIndicator={false} style={atoms.mt_16}>
          <DmView style={atoms.flex_row}>{elements}</DmView>
        </AppScrollView>
      )
    }
    if (layout === "wrap") {
      return <DmView style={[atoms.flex_row, atoms.flex_wrap, atoms.mt_16]}>{elements}</DmView>
    }
    return <DmView style={atoms.mt_16}>{elements}</DmView>
  }

  const renderQuestionOptions = () => {
    switch (item.style) {
      case "chips":
        return renderChips()
      case "imageWithText":
        return renderImageWithText()
      case "imageWithCheckmark":
        return renderImageWithCheckmark()
      case "textWithCheckmark":
        return renderTextWithCheckmark()
      case "checkmark":
        return (
          <DmView style={atoms.mt_16}>
            {visibleOptions?.map((opt, idx) => (
              <DmView
                key={idx}
                onPress={() => handleSelectOption(opt)}
                style={[
                  atoms.flex_row,
                  atoms.items_center,
                  atoms.justify_between,
                  idx === 0 ? atoms.pb_16 : atoms.py_16,
                  !hideBorders && styles.containerNotHideBorders,
                ]}
              >
                <Text size={13} leading="legacy" style={atoms.flex_1}>
                  {getOptionLabel(opt)}
                </Text>
                {isOptionSelected(opt) && (
                  <CheckmarkIcon width={20} height={20} fill="#CC0000" />
                )}
              </DmView>
            ))}
          </DmView>
        )
      case "checkbox":
        return (
          <DmView style={atoms.mt_16}>
            {visibleOptions?.map((opt, idx) => (
              <DmChecbox
                style={idx > 0 && atoms.mt_16}
                textStyle={atoms.flex_1}
                variant="square"
                size={compact ? 20 : undefined}
                key={idx}
                title={getOptionLabel(opt)}
                onPress={() => handleSelectOption(opt)}
                isChecked={isOptionSelected(opt)}
              />
            ))}
          </DmView>
        )
      case "radio":
        return (
          <DmView style={atoms.mt_16}>
            {visibleOptions?.map((opt, idx) => (
              <DmChecbox
                style={idx > 0 && atoms.mt_16}
                textStyle={atoms.flex_1}
                variant="circle"
                size={compact ? 20 : undefined}
                key={idx}
                title={getOptionLabel(opt)}
                onPress={() => handleSelectOption(opt)}
                isChecked={isOptionSelected(opt)}
              />
            ))}
          </DmView>
        )
      default:
        return (
          <DmView style={atoms.mt_16}>
            {visibleOptions?.map((opt, idx) => (
              <DmChecbox
                style={idx > 0 && atoms.mt_16}
                textStyle={atoms.flex_1}
                variant={item.type === "multipleChoice" ? "square" : "circle"}
                size={compact ? 20 : undefined}
                key={idx}
                title={getOptionLabel(opt)}
                onPress={() => handleSelectOption(opt)}
                isChecked={isOptionSelected(opt)}
              />
            ))}
          </DmView>
        )
    }
  }

  return (
    <DmView style={[styles.container, atoms.px_14]}>
      {(item.type === "oneChoice" || item.type === "multipleChoice") && (
        <>
          <Text size={15} weight={compact ? "bold" : "semibold"} leading="tight">
            {getQuestionText()}
          </Text>
          {renderQuestionOptions()}
        </>
      )}
      {(item.type === "shortAnswer" || item.type === "paragraph") && (
        <>
          <Text size={15} weight={compact ? "bold" : "semibold"} leading="tight" style={compact ? atoms.mb_12 : atoms.mb_12}>
            {getQuestionText()}
          </Text>
          <DmView
            style={[styles.inputWrap, styles.inputBorder, { borderColor: colors.grey5 }]}
          >
            <TextInput
              value={inputValue}
              onChangeText={handleChangeInput}
              multiline={item.type === "paragraph"}
              placeholder="Write something here..."
              placeholderTextColor={colors.grey5}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 15,
                color: colors.black,
                textAlign: I18nManager.isRTL ? "right" : "left",
                minHeight: item.type === "paragraph" ? 140 : 50,
                textAlignVertical: item.type === "paragraph" ? "top" : "center",
              }}
            />
          </DmView>
        </>
      )}
      {item.type === "dateTime" && (
        <>
          <Text size={15} weight={compact ? "bold" : "semibold"} leading="tight" style={compact ? atoms.mb_12 : atoms.mb_12}>
            {getQuestionText()}
          </Text>
          {/* A question's own card always shows the picker. The compact Job
              Details list shows the answer and opens the picker in place on
              a tap, rather than stacking a sheet on top of its sheet. */}
          {compact && (
            // DmInput's tap mode (no TextInput inside to swallow the touch).
            // A focused text answer above would leave the keyboard over the
            // calendar, so it goes first.
            <DmInput
              placeholder={t("select_date_time")}
              value={dateAnswerText}
              onPress={() => {
                Keyboard.dismiss()
                setDatePickerOpen((open) => !open)
              }}
            />
          )}
          {(!compact || isDatePickerOpen) && (
            <DmView style={compact ? atoms.mt_8 : undefined}>
              <CalendarTimePicker
                initialDate={answeredDay}
                initialTimeSlot={answeredSlot}
                showAnyTime
                inset={0}
                onSelectionChange={handleDateSelection}
              />
            </DmView>
          )}
        </>
      )}
    </DmView>
  )
}

export default QuestionComponent
