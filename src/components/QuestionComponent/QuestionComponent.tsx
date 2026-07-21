import React, { useLayoutEffect, useMemo, useState } from "react"
import { I18nManager, ScrollView, TextInput } from "react-native"

import { DmChecbox, DmInput, DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import { ServiceQuestionType, QuestionOptionType } from "types/cms"
import { useTranslation } from "react-i18next"
import { QuestionAnswerType } from "types/job"
import ChipButton from "components/ChipButton/ChipButton"
import ImageWithTextButton from "components/ImageWithTextButton/ImageWithTextButton"
import ImageWithCheckmarkButton from "components/ImageWithCheckmarkButton/ImageWithCheckmarkButton"
import TextWithCheckmarkButton from "components/TextWithCheckmarkButton/TextWithCheckmarkButton"
import CalendarTimeModal from "components/CalendarTimeModal/CalendarTimeModal"

import CheckmarkIcon from "assets/icons/check-mark.svg"
import styles from "./styles"

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
  const { i18n } = useTranslation()
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
  const [isCalendarVisible, setCalendarVisible] = useState(false)
  const [dateDisplayText, setDateDisplayText] = useState(() => {
    if (currentAnswer?.startTime && currentAnswer?.endTime) {
      return `${currentAnswer.startTime} - ${currentAnswer.endTime}`
    }
    if (currentAnswer?.date) return currentAnswer.date
    return ""
  })

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

  const handleCalendarConfirm = (
    date: string,
    timeSlot?: { start: string; end: string },
    type?: string
  ) => {
    setCalendarVisible(false)
    const newAnswer: QuestionAnswerType = { questionId: item.id }

    if (item.dateType === "dateRange") {
      newAnswer.startDate = date
      newAnswer.endDate = date
    } else {
      newAnswer.date = date
    }

    if (timeSlot) {
      newAnswer.startTime = timeSlot.start
      newAnswer.endTime = timeSlot.end
    }

    if (date && timeSlot) {
      setDateDisplayText(`${date}  •  ${timeSlot.start} - ${timeSlot.end}`)
    } else if (date) {
      setDateDisplayText(date)
    }

    setAnswer(newAnswer)
    onChangeAnswer(newAnswer)
  }

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-[16]">
          <DmView className="flex-row" style={{ gap }}>{chips}</DmView>
        </ScrollView>
      )
    }
    if (layout === "wrap") {
      return <DmView className="flex-row flex-wrap mt-[16]" style={{ gap }}>{chips}</DmView>
    }
    return <DmView className="mt-[16]" style={{ gap }}>{chips}</DmView>
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
        className={
          layout === "onePerRow" ? "mb-[16]" :
          layout === "wrap" ? "mr-[16] mb-[16]" :
          "mr-[16]"
        }
      />
    ))

    if (layout === "horizontal") {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-[16]">
          <DmView className="flex-row items-center">{elements}</DmView>
        </ScrollView>
      )
    }
    if (layout === "wrap") {
      return <DmView className="flex-row flex-wrap items-center mt-[16]">{elements}</DmView>
    }
    return <DmView className="mt-[16] items-start">{elements}</DmView>
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
        className={
          layout === "onePerRow" ? "mb-[16]" :
          layout === "wrap" ? "mr-[16] mb-[16]" :
          "mr-[16]"
        }
      />
    ))

    if (layout === "horizontal") {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-[16]">
          <DmView className="flex-row items-center">{elements}</DmView>
        </ScrollView>
      )
    }
    if (layout === "wrap") {
      return <DmView className="flex-row flex-wrap items-center mt-[16]">{elements}</DmView>
    }
    return <DmView className="mt-[16] items-start">{elements}</DmView>
  }

  const renderTextWithCheckmark = () => {
    const layout = item.layoutQuestionStyle || "onePerRow"
    const elements = visibleOptions?.map((opt, idx) => (
      <TextWithCheckmarkButton
        key={idx}
        label={getOptionLabel(opt)}
        isSelected={isOptionSelected(opt)}
        onPress={() => handleSelectOption(opt)}
        className={
          layout === "onePerRow" ? "mb-[12]" :
          layout === "wrap" ? "mr-[12] mb-[12]" :
          "mr-[12]"
        }
      />
    ))

    if (layout === "horizontal") {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-[16]">
          <DmView className="flex-row">{elements}</DmView>
        </ScrollView>
      )
    }
    if (layout === "wrap") {
      return <DmView className="flex-row flex-wrap mt-[16]">{elements}</DmView>
    }
    return <DmView className="mt-[16]">{elements}</DmView>
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
          <DmView className="mt-[16]">
            {visibleOptions?.map((opt, idx) => (
              <DmView
                key={idx}
                onPress={() => handleSelectOption(opt)}
                className={`flex-row items-center justify-between ${idx === 0 ? 'pb-[16]' : 'py-[16]'} ${hideBorders ? '' : 'border-b border-grey29'}`}
              >
                <DmText className="text-13 font-custom400 flex-1">
                  {getOptionLabel(opt)}
                </DmText>
                {isOptionSelected(opt) && (
                  <CheckmarkIcon width={20} height={20} fill="#CC0000" />
                )}
              </DmView>
            ))}
          </DmView>
        )
      case "checkbox":
        return (
          <DmView className="mt-[16]">
            {visibleOptions?.map((opt, idx) => (
              <DmChecbox
                className={idx > 0 ? "mt-[16]" : ""}
                textClassName="flex-1"
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
          <DmView className="mt-[16]">
            {visibleOptions?.map((opt, idx) => (
              <DmChecbox
                className={idx > 0 ? "mt-[16]" : ""}
                textClassName="flex-1"
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
          <DmView className="mt-[16]">
            {visibleOptions?.map((opt, idx) => (
              <DmChecbox
                className={idx > 0 ? "mt-[16]" : ""}
                textClassName="flex-1"
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
    <DmView className="mb-[25] px-[14]">
      {(item.type === "oneChoice" || item.type === "multipleChoice") && (
        <>
          <DmText className={compact ? "text-15 leading-[19px] font-custom700" : "text-15 leading-[19px] font-custom600"}>
            {getQuestionText()}
          </DmText>
          {renderQuestionOptions()}
        </>
      )}
      {(item.type === "shortAnswer" || item.type === "paragraph") && (
        <>
          <DmText className={compact ? "text-15 leading-[19px] font-custom700 mb-[12]" : "text-15 leading-[19px] font-custom600 mb-[12]"}>
            {getQuestionText()}
          </DmText>
          <DmView
            className="bg-white"
            style={[styles.inputBorder, { borderColor: colors.grey5 }]}
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
          <DmView onPress={() => setCalendarVisible(true)}>
            <DmInput
              placeholder="Write something here..."
              value={dateDisplayText}
              editable={false}
            />
          </DmView>
          <CalendarTimeModal
            isVisible={isCalendarVisible}
            onClose={() => setCalendarVisible(false)}
            onConfirm={handleCalendarConfirm}
          />
        </>
      )}
    </DmView>
  )
}

export default QuestionComponent
