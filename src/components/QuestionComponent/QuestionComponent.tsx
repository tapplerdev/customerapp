import React, { useLayoutEffect, useState } from "react"
import { I18nManager, ScrollView, TextInput } from "react-native"

import { DmChecbox, DmText, DmView } from "@tappler/shared/src/components/UI"
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
}

const QuestionComponent: React.FC<Props> = ({
  item,
  onChangeAnswer,
  answers,
  hideBorders,
}) => {
  const { i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const getOptionLabel = (opt: QuestionOptionType) =>
    isAr ? opt.valueAr : opt.value

  const getQuestionText = () =>
    isAr ? item.textAr : item.text

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

  const handleSelectOption = (option: QuestionOptionType) => {
    if (item.type === "multipleChoice") {
      const prevIds = answer?.optionsIds || []
      let newIds: number[]
      let newAnswerText: string

      if (prevIds.includes(option.id)) {
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
    } else {
      // oneChoice — toggle
      const isDeselecting = answer?.optionId === option.id
      const newAnswer: QuestionAnswerType = isDeselecting
        ? { questionId: item.id }
        : { questionId: item.id, optionId: option.id, answer: option.value }
      setAnswer(newAnswer)
      onChangeAnswer(newAnswer)
    }
  }

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
    const chips = item.options?.map((opt, idx) => (
      <ChipButton
        key={idx}
        label={getOptionLabel(opt)}
        isSelected={isOptionSelected(opt)}
        onPress={() => handleSelectOption(opt)}
        className={
          layout === "onePerRow" ? "mb-[10]" :
          layout === "wrap" ? "mr-[8] mb-[8]" :
          "mr-[8]"
        }
      />
    ))

    if (layout === "horizontal") {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-[16]">
          <DmView className="flex-row">{chips}</DmView>
        </ScrollView>
      )
    }
    if (layout === "wrap") {
      return <DmView className="flex-row flex-wrap mt-[16]">{chips}</DmView>
    }
    return <DmView className="mt-[16]">{chips}</DmView>
  }

  const renderImageWithText = () => {
    const layout = item.layoutQuestionStyle || "onePerRow"
    const elements = item.options?.map((opt, idx) => (
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
    const elements = item.options?.map((opt, idx) => (
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
    const elements = item.options?.map((opt, idx) => (
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
            {item.options?.map((opt, idx) => (
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
            {item.options?.map((opt, idx) => (
              <DmChecbox
                className={idx > 0 ? "mt-[16]" : ""}
                textClassName="flex-1"
                variant="square"
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
            {item.options?.map((opt, idx) => (
              <DmChecbox
                className={idx > 0 ? "mt-[16]" : ""}
                textClassName="flex-1"
                variant="circle"
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
            {item.options?.map((opt, idx) => (
              <DmChecbox
                className={idx > 0 ? "mt-[16]" : ""}
                textClassName="flex-1"
                variant={item.type === "multipleChoice" ? "square" : "circle"}
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
          <DmText className="text-15 leading-[19px] font-custom600">
            {getQuestionText()}
          </DmText>
          {renderQuestionOptions()}
        </>
      )}
      {(item.type === "shortAnswer" || item.type === "paragraph") && (
        <>
          <DmText className="text-15 leading-[19px] font-custom600 mb-[12]">
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
