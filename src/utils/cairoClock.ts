/**
 * Today's date and minutes-since-midnight in Cairo, the clock the backend
 * checks slots against (a customer abroad, or a phone on the wrong zone,
 * must not see a window the server will call past).
 */
export type Clock = { day: string; minutes: number }

const cairoFormat = (() => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Cairo",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return null
  }
})()

const pad = (n: number) => String(n).padStart(2, "0")

export const localClock = (at: Date): Clock => ({
  day: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
  minutes: at.getHours() * 60 + at.getMinutes(),
})

// Falls back to the phone's own clock when the engine can't format in
// Cairo's zone or leaves a part out (proapp's egyptToday does the same).
// `% 24`: an engine that ignores hourCycle writes midnight as "24".
export const cairoClock = (at: Date): Clock => {
  try {
    const { year, month, day, hour, minute } = Object.fromEntries(
      (cairoFormat?.formatToParts(at) ?? []).map((p) => [p.type, p.value])
    )
    if (year && month && day && hour && minute) {
      return {
        day: `${year}-${month}-${day}`,
        minutes: (Number(hour) % 24) * 60 + Number(minute),
      }
    }
  } catch {
    // the phone's own clock below
  }
  return localClock(at)
}

/** "21:00" -> 1260; the "00:00" that closes the last window is the day's end. */
export const slotEndMinutes = (end: string) => {
  const [h, m] = end.split(":").map(Number)
  return h === 0 && m === 0 ? 24 * 60 : h * 60 + m
}

/** A window that has ended on `clock`'s day. Started-not-ended is still open. */
export const slotEndedOn = (clock: Clock, day: string, slot: { end: string }) =>
  day === clock.day && slotEndMinutes(slot.end) <= clock.minutes
