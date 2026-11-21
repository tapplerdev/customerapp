import { afterEach, describe, expect, it, jest } from "@jest/globals"

import {
  cairoClock,
  localClock,
  slotEndedOn,
  slotEndMinutes,
} from "utils/cairoClock"

/*
 * "Has this window ended today" on Cairo's clock. Egypt is UTC+2 in winter
 * and UTC+3 in summer (DST), so both are pinned.
 */
describe("cairoClock", () => {
  it("winter: 2026-11-21 10:30Z is 12:30 in Cairo", () => {
    expect(cairoClock(new Date("2026-11-21T10:30:00Z"))).toEqual({
      day: "2026-11-21",
      minutes: 12 * 60 + 30,
    })
  })

  it("summer: 2026-07-01 10:30Z is 13:30 in Cairo", () => {
    expect(cairoClock(new Date("2026-07-01T10:30:00Z"))).toEqual({
      day: "2026-07-01",
      minutes: 13 * 60 + 30,
    })
  })

  it("rolls the Cairo date forward while UTC is still yesterday", () => {
    expect(cairoClock(new Date("2026-11-21T22:30:00Z"))).toEqual({
      day: "2026-11-22",
      minutes: 30,
    })
  })
})

describe("cairoClock, an engine that can't be trusted", () => {
  const at = new Date("2026-11-21T10:30:00Z")
  const parts = (hour: string) => [
    { type: "year", value: "2026" },
    { type: "literal", value: "-" },
    { type: "month", value: "11" },
    { type: "literal", value: "-" },
    { type: "day", value: "21" },
    { type: "literal", value: ", " },
    { type: "hour", value: hour },
    { type: "literal", value: ":" },
    { type: "minute", value: "05" },
  ]
  const spy = (impl: () => Intl.DateTimeFormatPart[]) =>
    jest
      .spyOn(Intl.DateTimeFormat.prototype, "formatToParts")
      .mockImplementation(impl)

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("midnight written as 24 is minute 0, not the day's end", () => {
    spy(() => parts("24") as Intl.DateTimeFormatPart[])
    expect(cairoClock(at)).toEqual({ day: "2026-11-21", minutes: 5 })
  })

  it("throws or leaves a part out: the phone's own clock", () => {
    spy(() => {
      throw new TypeError("formatToParts is not a function")
    })
    expect(cairoClock(at)).toEqual(localClock(at))
    spy(() => parts("").filter((p) => p.type !== "hour") as never)
    expect(cairoClock(at)).toEqual(localClock(at))
  })
})

describe("slotEndedOn", () => {
  const noon = { day: "2026-11-21", minutes: 12 * 60 + 30 }
  const slot = (end: string) => ({ end })

  it("a window that ended is gone, one that started but has not ended stays", () => {
    expect(slotEndedOn(noon, "2026-11-21", slot("12:00"))).toBe(true)
    expect(slotEndedOn(noon, "2026-11-21", slot("15:00"))).toBe(false)
  })

  it("a window ending exactly now has ended", () => {
    expect(
      slotEndedOn(
        { day: "2026-11-21", minutes: 900 },
        "2026-11-21",
        slot("15:00")
      )
    ).toBe(true)
  })

  it("00:00 closes the day: it never ends before midnight", () => {
    expect(slotEndMinutes("00:00")).toBe(1440)
    expect(
      slotEndedOn(
        { day: "2026-11-21", minutes: 1439 },
        "2026-11-21",
        slot("00:00")
      )
    ).toBe(false)
  })

  it("only today is judged; other days are open", () => {
    expect(slotEndedOn(noon, "2026-11-22", slot("09:00"))).toBe(false)
  })
})
