import React, { useState } from "react"
import { ScrollView } from "react-native"
import { useTranslation } from "react-i18next"
import Modal from "react-native-modal"
import { Calendar } from "react-native-calendars"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"

const TIME_SLOTS = [
  { start: "06:00", end: "09:00", label: "6:00 - 9:00 AM" },
  { start: "09:00", end: "12:00", label: "9:00 - 12:00 PM" },
  { start: "12:00", end: "15:00", label: "12:00 - 3:00 PM" },
  { start: "15:00", end: "18:00", label: "3:00 - 6:00 PM" },
  { start: "18:00", end: "21:00", label: "6:00 - 9:00 PM" },
  { start: "21:00", end: "00:00", label: "9:00 - 12:00 AM" },
]

interface Props {
  isVisible: boolean
  onClose: () => void
  onConfirm: (date: string, timeSlot?: { start: string; end: string }, dateType?: string) => void
}

const CalendarTimeModal: React.FC<Props> = ({ isVisible, onClose, onConfirm }) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [selectedDate, setSelectedDate] = useState("")
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null)
  const [specialOption, setSpecialOption] = useState<"any_time" | "asap" | null>(null)

  const today = new Date().toISOString().split("T")[0]

  const handleDayPress = (day: { dateString: string }) => {
    setSelectedDate(day.dateString)
    setSpecialOption(null)
  }

  const handleSlotPress = (index: number) => {
    setSelectedSlotIndex(index === selectedSlotIndex ? null : index)
    setSpecialOption(null)
  }

  const handleSpecialOption = (option: "any_time" | "asap") => {
    setSpecialOption(option === specialOption ? null : option)
    setSelectedSlotIndex(null)
    if (option === "asap") {
      setSelectedDate("")
    }
  }

  const handleConfirm = () => {
    if (specialOption === "asap") {
      onConfirm("", undefined, "asap")
    } else if (specialOption === "any_time" && selectedDate) {
      onConfirm(selectedDate, undefined, "date")
    } else if (selectedDate && selectedSlotIndex !== null) {
      onConfirm(selectedDate, TIME_SLOTS[selectedSlotIndex], "date")
    } else if (selectedDate) {
      onConfirm(selectedDate, undefined, "date")
    }
  }

  const canConfirm = specialOption === "asap" || !!selectedDate

  const markedDates = selectedDate
    ? { [selectedDate]: { selected: true, selectedColor: colors.red } }
    : {}

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      className="m-0 justify-end"
      animationIn="slideInUp"
      animationOut="slideOutDown"
      hardwareAccelerated
      statusBarTranslucent
      backdropTransitionOutTiming={0}
      hideModalContentWhileAnimating
    >
      <DmView
        className="bg-white rounded-t-16 max-h-[85%]"
        style={{ paddingBottom: insets.bottom + 10 }}
      >
        {/* Header */}
        <DmView className="px-[20] pt-[20] pb-[10]">
          <DmText className="text-18 font-custom600 text-black">
            {t("select_date_time")}
          </DmText>
        </DmView>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Calendar */}
          <Calendar
            minDate={today}
            onDayPress={handleDayPress}
            markedDates={markedDates}
            theme={{
              todayTextColor: colors.red,
              selectedDayBackgroundColor: colors.red,
              arrowColor: colors.red,
              textDayFontFamily: "Montserrat-Medium",
              textMonthFontFamily: "Montserrat-SemiBold",
              textDayHeaderFontFamily: "Montserrat-Medium",
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 12,
            }}
          />

          {/* Time slots */}
          <DmView className="px-[20] mt-[16]">
            <DmText className="text-14 font-custom600 text-black mb-[10]">
              {t("select_time")}
            </DmText>
            <DmView className="flex-row flex-wrap gap-[8]">
              {TIME_SLOTS.map((slot, index) => {
                const isSelected = selectedSlotIndex === index
                return (
                  <DmView
                    key={index}
                    className={`px-[14] py-[10] rounded-8 border-1 ${
                      isSelected ? "border-red bg-red/10" : "border-grey1"
                    }`}
                    onPress={() => handleSlotPress(index)}
                  >
                    <DmText
                      className={`text-12 font-custom500 ${
                        isSelected ? "text-red" : "text-black"
                      }`}
                    >
                      {slot.label}
                    </DmText>
                  </DmView>
                )
              })}
            </DmView>

            {/* Special options */}
            <DmView className="mt-[16] gap-[8]">
              <DmView
                className={`px-[14] py-[12] rounded-8 border-1 ${
                  specialOption === "any_time" ? "border-red bg-red/10" : "border-grey1"
                }`}
                onPress={() => handleSpecialOption("any_time")}
              >
                <DmText
                  className={`text-13 font-custom500 ${
                    specialOption === "any_time" ? "text-red" : "text-black"
                  }`}
                >
                  {t("any_time")}
                </DmText>
              </DmView>
              <DmView
                className={`px-[14] py-[12] rounded-8 border-1 ${
                  specialOption === "asap" ? "border-red bg-red/10" : "border-grey1"
                }`}
                onPress={() => handleSpecialOption("asap")}
              >
                <DmText
                  className={`text-13 font-custom500 ${
                    specialOption === "asap" ? "text-red" : "text-black"
                  }`}
                >
                  {t("as_soon_as_possible")}
                </DmText>
              </DmView>
            </DmView>
          </DmView>

          {/* Confirm button */}
          <DmView className="px-[20] mt-[20] mb-[10]">
            <ActionBtn
              title={t("confirm")}
              onPress={handleConfirm}
              disable={!canConfirm}
              className={`h-[48] rounded-10 ${canConfirm ? "bg-red" : ""}`}
              textClassName="text-14 font-custom600"
            />
          </DmView>
        </ScrollView>
      </DmView>
    </Modal>
  )
}

export default CalendarTimeModal
