/**
 * The timing choices the request's date step offers. The backend derives
 * `category.dateTypes` (urgent: none, food: asap + date, scheduled: date,
 * standard: all four), so the app only orders and filters what it is given.
 * "hours48" is no longer offered: old jobs keep it, new requests are refused.
 */
export type DateOption = "asap" | "week" | "date" | "notDecided"

const ORDER: readonly DateOption[] = ["asap", "week", "date", "notDecided"]

export const dateOptionsFor = (dateTypes?: readonly string[]): DateOption[] =>
  ORDER.filter((option) => dateTypes?.includes(option))
