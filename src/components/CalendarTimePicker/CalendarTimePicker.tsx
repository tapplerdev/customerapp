import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Calendar } from "react-native-calendars"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"

export type TimeSlot = { start: string; end: string }

export const TIME_SLOTS = [
  { start: "06:00", end: "09:00", label: "6:00 - 9:00 AM" },
  { start: "09:00", end: "12:00", label: "9:00 - 12:00 PM" },
  { start: "12:00", end: "15:00", label: "12:00 - 3:00 PM" },
  { start: "15:00", end: "18:00", label: "3:00 - 6:00 PM" },
  { start: "18:00", end: "21:00", label: "6:00 - 9:00 PM" },
  { start: "21:00", end: "00:00", label: "9:00 - 12:00 AM" },
]

// "Any time" means the whole service day, not "no time" — a date request
// MUST carry a slot (@JobDatesCorrect wants dates AND timeSlots together),
// so the open-ended answer gets the full span rather than nothing.
export const ANY_TIME_SLOT: TimeSlot = {
  start: TIME_SLOTS[0].start,
  end: TIME_SLOTS[TIME_SLOTS.length - 1].end,
}

export const isAnyTimeSlot = (slot?: Partial<TimeSlot>) =>
  slot?.start === ANY_TIME_SLOT.start && slot?.end === ANY_TIME_SLOT.end

export type CalendarSelection = { date: string; timeSlot: TimeSlot }

interface Props {
  /** Seed the picker when it mounts. Key the picker to seed it again. */
  initialDate?: string
  initialTimeSlot?: TimeSlot
  showAnyTime?: boolean
  // Nothing before this can be prepared in time (basket lead time). Advisory
  // by design: it greys out what the pro almost certainly cannot make, but the
  // pro's accept/decline remains the real gate, so this never hard-blocks.
  earliestAt?: Date | null
  /** Horizontal padding of the time and option rows (the calendar has its own). */
  inset?: number
  /** Every change the customer makes: the complete answer, or null while the
   *  picked day has no time yet. Never called on mount. */
  onSelectionChange: (selection: CalendarSelection | null) => void
}

// Local calendar day, not toISOString() — that converts to UTC and rolls
// the date backwards for anyone east of Greenwich, which is all of Egypt.
const toLocalDay = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate()
  ).padStart(2, "0")}`

// A slot survives if it ENDS after the floor — 12:00-15:00 is still usable
// at 12:30. Only the floor's own day is constrained; later days are open.
const isSlotTooEarlyOn = (floor: Date, day: string, slot: TimeSlot) => {
  if (day !== toLocalDay(floor)) return false
  const [h, m] = slot.end.split(":").map(Number)
  const endMinutes = h === 0 && m === 0 ? 24 * 60 : h * 60 + m
  return endMinutes <= floor.getHours() * 60 + floor.getMinutes()
}

/**
 * The calendar, the six time windows, and optionally "Any time".
 * No chrome of its own: CalendarTimeSheet puts it in a bottom sheet with a
 * Confirm button (checkout, the request's date step), and QuestionComponent
 * draws it inline in a date question's card, where an answer is saved as
 * soon as a day and a time are picked.
 */
const CalendarTimePicker: React.FC<Props> = ({
  initialDate,
  initialTimeSlot,
  showAnyTime,
  earliestAt,
  inset = 20,
  onSelectionChange,
}) => {
  const { t } = useTranslation()

  // NOW is always the floor. A lead time only pushes it later — it never made
  // sense to offer this morning's window at 6pm, and before this only baskets
  // with a pre-order item were bounded at all.
  const floor = useMemo(() => {
    const now = new Date()
    return earliestAt && earliestAt > now ? earliestAt : now
  }, [earliestAt])

  // The first day that still has a usable window, so the customer never lands
  // on a fully greyed-out list. (The 21:00-00:00 window outlasts any floor
  // time, so today that is always the floor's own day.)
  const firstOpenDay = useMemo(() => {
    for (let offset = 0; offset < 14; offset += 1) {
      const day = new Date(floor)
      day.setDate(day.getDate() + offset)
      const key = toLocalDay(day)
      if (TIME_SLOTS.some((slot) => !isSlotTooEarlyOn(floor, key, slot))) {
        return key
      }
    }
    return toLocalDay(floor)
  }, [floor])

  const minDay = toLocalDay(floor)

  // Open on the saved answer, or on a usable day already selected — the
  // customer's most likely answer is "today", and making them tap the date
  // first is a step for nothing.
  const [selectedDate, setSelectedDate] = useState(initialDate || firstOpenDay)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    () => {
      const index = TIME_SLOTS.findIndex(
        (slot) =>
          slot.start === initialTimeSlot?.start &&
          slot.end === initialTimeSlot?.end
      )
      return index === -1 ? null : index
    }
  )
  const [isAnyTime, setAnyTime] = useState(
    !!showAnyTime && isAnyTimeSlot(initialTimeSlot)
  )
  // The month on screen when it opens: the picked day's, not always today's.
  const [calendarStart] = useState(selectedDate)

  const report = (date: string, slotIndex: number | null, anyTime: boolean) => {
    if (anyTime) {
      onSelectionChange({ date, timeSlot: ANY_TIME_SLOT })
    } else if (slotIndex !== null) {
      const { start, end } = TIME_SLOTS[slotIndex]
      onSelectionChange({ date, timeSlot: { start, end } })
    } else {
      onSelectionChange(null)
    }
  }

  const handleDayPress = (day: { dateString: string }) => {
    // Keep the time when it still works on the new day ("Any time" always
    // does); a window that would be greyed out there is dropped instead.
    const keepSlot =
      selectedSlotIndex !== null &&
      !isSlotTooEarlyOn(floor, day.dateString, TIME_SLOTS[selectedSlotIndex])
    const slotIndex = keepSlot ? selectedSlotIndex : null
    setSelectedDate(day.dateString)
    setSelectedSlotIndex(slotIndex)
    report(day.dateString, slotIndex, isAnyTime)
  }

  const handleSlotPress = (index: number) => {
    const slotIndex = index === selectedSlotIndex ? null : index
    setSelectedSlotIndex(slotIndex)
    setAnyTime(false)
    report(selectedDate, slotIndex, false)
  }

  const handleAnyTimePress = () => {
    const anyTime = !isAnyTime
    setAnyTime(anyTime)
    setSelectedSlotIndex(null)
    report(selectedDate, null, anyTime)
  }

  const markedDates = selectedDate
    ? { [selectedDate]: { selected: true, selectedColor: colors.red } }
    : {}

  return (
    <DmView>
      <Calendar
        initialDate={calendarStart}
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
      <DmView className="mt-[16]" style={{ paddingHorizontal: inset }}>
        <DmText className="text-14 font-custom600 text-black mb-[10]">
          {t("select_time")}
        </DmText>
        <DmView className="flex-row flex-wrap gap-[8]">
          {TIME_SLOTS.map((slot, index) => {
            const isSelected = selectedSlotIndex === index
            const tooEarly = isSlotTooEarlyOn(floor, selectedDate, slot)
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

        {showAnyTime && (
          <DmView
            className={`mt-[16] px-[14] py-[12] rounded-8 border-1 ${
              isAnyTime ? "border-red bg-red/10" : "border-grey1"
            }`}
            onPress={handleAnyTimePress}
          >
            <DmText
              className={`text-13 font-custom500 ${
                isAnyTime ? "text-red" : "text-black"
              }`}
            >
              {t("any_time")}
            </DmText>
          </DmView>
        )}
      </DmView>
    </DmView>
  )
}

export default CalendarTimePicker
