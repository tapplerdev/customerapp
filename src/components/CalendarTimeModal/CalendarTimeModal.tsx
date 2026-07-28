import React, { useMemo, useState } from "react"
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
  hideSpecialOptions?: boolean
  // Nothing before this can be prepared in time (basket lead time). Advisory
  // by design: it greys out what the pro almost certainly cannot make, but the
  // pro's accept/decline remains the real gate, so this never hard-blocks.
  earliestAt?: Date | null
}

const CalendarTimeModal: React.FC<Props> = ({
  isVisible,
  onClose,
  onConfirm,
  hideSpecialOptions,
  earliestAt,
}) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const [selectedDate, setSelectedDate] = useState("")
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null)
  const [specialOption, setSpecialOption] = useState<"any_time" | "asap" | null>(null)

  // Local calendar day, not toISOString() — that converts to UTC and rolls
  // the date backwards for anyone east of Greenwich, which is all of Egypt.
  const toLocalDay = (value: Date) =>
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
      value.getDate()
    ).padStart(2, "0")}`

  // NOW is always the floor. A lead time only pushes it later — it never made
  // sense to offer this morning's window at 6pm, and before this only baskets
  // with a pre-order item were bounded at all.
  const floor = useMemo(() => {
    const now = new Date()
    return earliestAt && earliestAt > now ? earliestAt : now
  }, [earliestAt, isVisible])

  const minutesOnFloorDay = floor.getHours() * 60 + floor.getMinutes()

  // A slot survives if it ENDS after the floor — 12:00-15:00 is still usable
  // at 12:30. Only the floor's own day is constrained; later days are open.
  const isSlotTooEarlyOn = (day: string, slot: { start: string; end: string }) => {
    if (day !== toLocalDay(floor)) return false
    const [h, m] = slot.end.split(":").map(Number)
    const endMinutes = h === 0 && m === 0 ? 24 * 60 : h * 60 + m
    return endMinutes <= minutesOnFloorDay
  }

  const isSlotTooEarly = (slot: { start: string; end: string }) =>
    isSlotTooEarlyOn(selectedDate, slot)

  // The first day that still has a usable window. Late enough in the evening
  // every slot on the floor's day is gone, and landing the customer on a fully
  // greyed-out list is worse than opening on tomorrow.
  const firstOpenDay = useMemo(() => {
    for (let offset = 0; offset < 14; offset += 1) {
      const day = new Date(floor)
      day.setDate(day.getDate() + offset)
      const key = toLocalDay(day)
      if (TIME_SLOTS.some((slot) => !isSlotTooEarlyOn(key, slot))) return key
    }
    return toLocalDay(floor)
  }, [floor])

  const minDay = toLocalDay(floor)

  // Open on a usable day already selected — the customer's most likely answer
  // is "today", and making them tap the date first is a step for nothing.
  React.useEffect(() => {
    if (isVisible) {
      setSelectedDate(firstOpenDay)
      setSelectedSlotIndex(null)
      setSpecialOption(null)
    }
  }, [isVisible])

  const handleDayPress = (day: { dateString: string }) => {
    setSelectedDate(day.dateString)
    setSpecialOption(null)
    // Switching days can make the held slot too early — drop it rather than
    // let Confirm submit a window that is greyed out on screen.
    setSelectedSlotIndex(null)
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

  // "Any time" means the whole service day, not "no time" — a date request
  // MUST carry a slot (@JobDatesCorrect wants dates AND timeSlots together),
  // so the open-ended answer gets the full span rather than nothing.
  const ANY_TIME_SLOT = {
    start: TIME_SLOTS[0].start,
    end: TIME_SLOTS[TIME_SLOTS.length - 1].end,
  }

  const handleConfirm = () => {
    if (specialOption === "asap") {
      onConfirm("", undefined, "asap")
    } else if (specialOption === "any_time" && selectedDate) {
      onConfirm(selectedDate, ANY_TIME_SLOT, "date")
    } else if (selectedDate && selectedSlotIndex !== null) {
      onConfirm(selectedDate, TIME_SLOTS[selectedSlotIndex], "date")
    }
  }

  // A day with no slot at all was a request the server was guaranteed to
  // refuse, so it can no longer be confirmed.
  const canConfirm =
    specialOption === "asap" ||
    (!!selectedDate &&
      (specialOption === "any_time" || selectedSlotIndex !== null))

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
            minDate={minDay}
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
                const tooEarly = isSlotTooEarly(slot)
                return (
                  <DmView
                    key={index}
                    className={`px-[14] py-[10] rounded-8 border-1 ${
                      isSelected ? "border-red bg-red/10" : "border-grey1"
                    }`}
                    style={tooEarly ? { opacity: 0.35 } : undefined}
                    onPress={tooEarly ? undefined : () => handleSlotPress(index)}
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
            {!hideSpecialOptions && (
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
            )}
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
