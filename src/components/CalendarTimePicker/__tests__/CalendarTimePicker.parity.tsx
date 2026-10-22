import { describe, it } from "@jest/globals"
import path from "path"

/*
 * CalendarTimePicker (the calendar, the six time windows and "Any time"),
 * pinned to what it drew before its conversion, for every prop set its call
 * sites hand it (the date question's inline picker and the schedule sheet's),
 * with the answers and the basket's lead time those sites compute in each
 * state; and after a customer picks a window or "Any time".
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/CalendarTimePicker.cases.json; the sites pass no
 * class names. The clock is the kit's. The trees in __parity__ were captured
 * from CalendarTimePicker before its conversion (each case names the
 * commit). Both languages, both platforms.
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest (writes the cases)
 *   yarn ds:parity:capture <this file> --force                recapture, on the old code only
 */

/* eslint-disable import/first */
import { renderScreen, rowsByPlatform } from "testing/screenKit"
import {
  PARITY_MATRIX,
  captureCommit,
  expectParity,
  parityName,
} from "testing/hostTreeParity"
import {
  componentImport,
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestedCase,
  type HarvestOptions,
} from "testing/harvest"
import { copy, pressText, treeAfter, wait } from "testing/screenKit"
/* eslint-enable import/first */

const FILES = harvestFilesFor(__dirname, "CalendarTimePicker")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("CalendarTimePicker"),
  props: {
    initialDate: "any",
    initialTimeSlot: "any",
    showAnyTime: "bool",
    earliestAt: "any",
    inset: "value",
    onSelectionChange: "fn",
    key: "any",
  },
}

/**
 * What the picker's sites compute, by variant. The clock is the kit's
 * (2026-10-20, 11:00 in Cairo): the 6-9 window is already over today.
 * `earliestAt` is a basket's lead time, only the sheet's site passes it.
 */
const ANY_TIME = { start: "06:00", end: "00:00" }
const PICKER: Record<string, Record<string, unknown>> = {
  "no answer": {},
  "answered day and window": {
    answeredDay: "2026-10-22",
    answeredSlot: { start: "12:00", end: "15:00" },
  },
  "answered any time": {
    answeredDay: "2026-10-21",
    answeredSlot: ANY_TIME,
  },
  "a late floor": { earliestAt: new Date("2026-10-20T19:30:00Z") },
  "a floor tomorrow": { earliestAt: new Date("2026-10-21T10:00:00Z") },
}
const VARIANTS = Object.fromEntries(
  Object.keys(PICKER).map((name) => [name, name])
)

const pickerValue = (variant: string, key: string) =>
  key === "openCount" ? 0 : PICKER[variant][key]

/** A row's component, loaded in the row's own registry (the kit's rule). */
const loaderFor =
  (entry: HarvestedCase, variant = "") =>
  () => {
    /* eslint-disable global-require, @typescript-eslint/no-var-requires */
    const React = require("react") as typeof import("react")
    const { buildProps } =
      require("testing/harvest") as typeof import("testing/harvest")
    const Component = require("../CalendarTimePicker").default
    /* eslint-enable global-require, @typescript-eslint/no-var-requires */
    const Harness = () =>
      React.createElement(
        Component,
        buildProps(entry.props, {
          opaque: (key: string) => pickerValue(variant, key),
        })
      )
    return { default: Harness }
  }

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "CalendarTimePicker", OPTIONS, captureCommit())
    })
  })
} else {
  const harvested = readHarvest(FILES)
  const cases: Record<string, HarvestedCase> = harvested.cases
  const rows = rowsByPlatform(
    Object.entries(cases).flatMap(([id, entry]) =>
      Object.keys(VARIANTS).map((variant) => ({
        id: `${id} ${variant}`,
        site: entry.sites[0],
        entry,
        variant,
      }))
    ),
    PARITY_MATRIX
  )
  describe("CalendarTimePicker draws as before", () => {
    it.each(rows)("$id ($site) [$env.language $env.platform]", async (row) => {
      const { id, entry, env } = row
      const tree = await renderScreen(loaderFor(entry, row.variant), {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
      })
      expectParity(parityName(id, env), tree)
    })
  })
  // Pressed: the picked window and "Any time" draw their selected look, and a
  // window picked on a day it survives keeps it.
  // (initialDate and initialTimeSlot come from a date question's answer: answeredDay, answeredSlot.)
  describe("CalendarTimePicker after a customer picks", () => {
    const withAnyTime = Object.entries(cases).find(
      ([, entry]) => entry.props.showAnyTime === true
    )!
    const STEPS = {
      "a window": [(root: never) => pressText(root, "12:00 - 3:00 PM")],
      "another window after it": [
        (root: never) => pressText(root, "12:00 - 3:00 PM"),
        (root: never) => pressText(root, "3:00 - 6:00 PM"),
      ],
      "the same window twice": [
        (root: never) => pressText(root, "12:00 - 3:00 PM"),
        (root: never) => pressText(root, "12:00 - 3:00 PM"),
      ],
      "any time": [
        (root: never, env: never) => pressText(root, copy(env, "any_time")),
      ],
      "any time after a window": [
        (root: never) => pressText(root, "12:00 - 3:00 PM"),
        (root: never, env: never) => pressText(root, copy(env, "any_time")),
      ],
    }
    const pressed = rowsByPlatform(
      Object.keys(STEPS).map((name) => ({ name })),
      PARITY_MATRIX
    )
    it.each(pressed)(
      "$name [$env.language $env.platform]",
      async ({ name, env }) => {
        const tree = await treeAfter(
          loaderFor(withAnyTime[1], "no answer"),
          { lang: env.language, platform: env.platform, navigation: "none" },
          env,
          STEPS[name as keyof typeof STEPS] as never
        )
        expectParity(parityName(`pressed ${name}`, env), tree)
      }
    )
  })
}
