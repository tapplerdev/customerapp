import React, { useLayoutEffect, useState } from "react"
import { Keyboard, StyleSheet } from "react-native"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import { useFullSheetHeight } from "@tappler/shared/src/components/NativeSheet/useFullSheetHeight"
import NativeActionSheet from "components/NativeActionSheet/NativeActionSheet"
import CalendarTimePicker, {
  type CalendarSelection,
  type TimeSlot,
} from "components/CalendarTimePicker/CalendarTimePicker"
import { AppScrollView } from "components/scroll"

import CloseIcon from "assets/icons/close.svg"

interface Props {
  isVisible: boolean
  onClose: () => void
  onConfirm: (date: string, timeSlot?: TimeSlot, dateType?: string) => void
  hideSpecialOptions?: boolean
  // Nothing before this can be prepared in time (basket lead time). Passed
  // through to the picker, which only greys out; it never hard-blocks.
  earliestAt?: Date | null
}

/**
 * "When?" as a bottom sheet with a Confirm button: food checkout's schedule
 * row and the request's date step. Date QUESTIONS draw the same picker inline
 * in their card instead (QuestionComponent), so this never opens on top of
 * another sheet.
 *
 * Near-full height rather than self-sizing: a month with six weeks is taller
 * than one with five, and Confirm sits below the scroll, where an auto-sized
 * sheet would push it off a small phone.
 */
const CalendarTimeSheet: React.FC<Props> = ({
  isVisible,
  onClose,
  onConfirm,
  hideSpecialOptions,
  earliestAt,
}) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const sheetHeight = useFullSheetHeight()

  const [selection, setSelection] = useState<CalendarSelection | null>(null)
  // A fresh picker for every open (the sheet itself stays mounted), so it
  // opens on the first usable day with nothing picked.
  const [openCount, setOpenCount] = useState(0)
  const [wasVisible, setWasVisible] = useState(isVisible)
  if (isVisible !== wasVisible) {
    setWasVisible(isVisible)
    if (isVisible) {
      setOpenCount((count) => count + 1)
      setSelection(null)
    }
  }

  // Before the sheet presents (its own effect runs after this one): a field
  // focused on the screen behind would leave the keyboard over the sheet.
  useLayoutEffect(() => {
    if (isVisible) Keyboard.dismiss()
  }, [isVisible])

  const handleConfirm = () => {
    if (selection) onConfirm(selection.date, selection.timeSlot, "date")
  }

  return (
    <NativeActionSheet
      isVisible={isVisible}
      onClose={onClose}
      height={sheetHeight}
    >
      <DmView className="flex-1 bg-white" style={styles.round}>
        {/* Header. The ✕ matters: a near-full sheet leaves only the status
            bar's strip of dim to tap. */}
        <DmView className="flex-row items-center px-[20] pt-[20] pb-[10]">
          <DmText className="flex-1 text-18 font-custom600 text-black">
            {t("select_date_time")}
          </DmText>
          <DmView
            className="w-[32] h-[32] items-center justify-center"
            onPress={onClose}
            hitSlop={HIT_SLOP_DEFAULT}
          >
            <CloseIcon width={13} height={13} />
          </DmView>
        </DmView>

        <AppScrollView
          className="flex-1"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <CalendarTimePicker
            key={openCount}
            showAnyTime={!hideSpecialOptions}
            earliestAt={earliestAt}
            onSelectionChange={setSelection}
          />
        </AppScrollView>

        {/* Pinned under the scroll, so it never scrolls away or off screen. */}
        <DmView
          className="px-[20] pt-[10]"
          style={{ paddingBottom: insets.bottom + 10 }}
        >
          <ActionBtn
            title={t("confirm")}
            onPress={handleConfirm}
            disable={!selection}
            className={`h-[48] rounded-10 ${selection ? "bg-red" : ""}`}
            textClassName="text-14 font-custom600"
          />
        </DmView>
      </DmView>
    </NativeActionSheet>
  )
}

const styles = StyleSheet.create({
  round: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
})

export default CalendarTimeSheet
