/**
 * The timing choices the request's date step offers. The backend derives
 * `category.dateTypes` (urgent: none, food: asap + date, scheduled: date,
 * standard: all four), so the app only orders and filters what it is given.
 * "hours48" is no longer offered: old jobs keep it, new requests are refused.
 */
export type DateOption = "asap" | "hours48" | "week" | "date" | "notDecided"

const ORDER: readonly DateOption[] = ["asap", "week", "date", "notDecided"]

// Except where it is all a category has: a backend from before release 11-21
// still sends the old sets, and one holding only hours48 would leave the step
// with nothing to pick. The new backend never sends hours48.
export const dateOptionsFor = (dateTypes?: readonly string[]): DateOption[] => {
  const offered = ORDER.filter((option) => dateTypes?.includes(option))
  return offered.length || !dateTypes?.includes("hours48")
    ? offered
    : ["hours48"]
}

/** Each choice's words, on the date step and wherever a request is shown. */
export const DATE_OPTION_LABELS: Record<DateOption, string> = {
  asap: "as_soon_as_possible",
  hours48: "within_48_hours",
  week: "within_a_week",
  date: "on_a_specific_date",
  notDecided: "havent_decided_yet",
}
