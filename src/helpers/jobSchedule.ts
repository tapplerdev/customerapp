// One place that turns a job's stored schedule into something readable.
// The wire gives an ISO timestamp for the date and "HH:MM:SS" for the slot;
// three screens were formatting that themselves and disagreeing — the request
// details screen was printing "2026-07-29T00:00:00.000Z · 09:00:00 - 12:00:00"
// straight out of the database.
type Slot = { start: string; end: string }

const clock = (value: string, am: string, pm: string) => {
  const [hour, minute] = value.split(":").map(Number)
  return {
    text: `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""}`,
    suffix: hour >= 12 ? pm : am,
  }
}

// "9 AM - 12 PM". Collapses to one meridiem when both ends share it, except
// across midnight — 00:00 closes the last slot and is 12 AM, so reading it as
// PM printed "9 - 12 PM", which is backwards.
export const formatSlot = (slot: Slot, am: string, pm: string): string => {
  const from = clock(slot.start, am, pm)
  const endsAtMidnight = slot.end.startsWith("00:")
  const to = endsAtMidnight ? { text: "12", suffix: am } : clock(slot.end, am, pm)
  return !endsAtMidnight && from.suffix === to.suffix
    ? `${from.text} - ${to.text} ${to.suffix}`
    : `${from.text} ${from.suffix} - ${to.text} ${to.suffix}`
}

export const formatJobSchedule = (
  dates: { date: string }[] | undefined,
  timeSlots: Slot[] | undefined,
  locale: string,
  am: string,
  pm: string
): string => {
  const raw = dates?.[0]?.date
  if (!raw) return ""
  const day = new Date(raw).toLocaleDateString(locale, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const slot = timeSlots?.[0]
  return slot ? `${day} · ${formatSlot(slot, am, pm)}` : day
}
