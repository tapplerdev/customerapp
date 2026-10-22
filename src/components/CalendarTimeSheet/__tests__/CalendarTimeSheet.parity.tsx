import { describe, it } from "@jest/globals"
import path from "path"

/*
 * CalendarTimeSheet (the "when?" bottom sheet with a Confirm button),
 * pinned to what it drew before its conversion, for every prop set its call
 * sites hand it (food checkout's schedule row and the request's date step),
 * with and without a basket lead time, and by hand with the special options;
 * and after a customer picks a window (Confirm turns from the disabled grey
 * button to the red one).
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/CalendarTimeSheet.cases.json; the sites pass no
 * class names. The sheet is the kit's stand-in for the native sheet. The
 * trees in __parity__ were captured from CalendarTimeSheet before its
 * conversion (each case names the commit). Both languages, both platforms.
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
  type ParityAllowance,
} from "testing/hostTreeParity"
import {
  componentImport,
  expectClassFree,
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestOptions,
  type HarvestedCase,
} from "testing/harvest"
import { pressText, treeAfter } from "testing/screenKit"
/* eslint-enable import/first */

/** What Button draws differently from the ActionBtn it replaced (listed deltas only, on its root): Confirm, once the sheet is open */
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const FILES = harvestFilesFor(__dirname, "CalendarTimeSheet")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("CalendarTimeSheet"),
  props: {
    isVisible: "bool",
    onClose: "fn",
    onConfirm: "fn",
    hideSpecialOptions: "bool",
    earliestAt: "any",
  },
}

/**
 * By hand: both sites hide the special options, so the sheet's own default
 * (the picker with "Any time") is no harvested row.
 */
const HAND: Record<string, HarvestedCase> = {
  "hand with the special options": {
    props: {
      isVisible: true,
      onClose: { $fn: true },
      onConfirm: { $fn: true },
    },
    sites: ["by hand"],
  },
}

/** The basket's lead time (the checkout's site computes it; the request's passes none). */
const SHEET: Record<string, Record<string, unknown>> = {
  "no lead time": {},
  "a late floor": { earliestAt: new Date("2026-10-20T19:30:00Z") },
}
const VARIANTS = Object.fromEntries(
  Object.keys(SHEET).map((name) => [name, name])
)

const sheetValue = (variant: string, key: string) => SHEET[variant][key]

/** A row's component, loaded in the row's own registry (the kit's rule). */
const loaderFor =
  (entry: HarvestedCase, variant = "") =>
  () => {
    /* eslint-disable global-require, @typescript-eslint/no-var-requires */
    const React = require("react") as typeof import("react")
    const { buildProps } =
      require("testing/harvest") as typeof import("testing/harvest")
    const Component = require("../CalendarTimeSheet").default
    /* eslint-enable global-require, @typescript-eslint/no-var-requires */
    const Harness = () =>
      React.createElement(
        Component,
        buildProps(entry.props, {
          opaque: (key: string) => sheetValue(variant, key),
        })
      )
    return { default: Harness }
  }

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "CalendarTimeSheet", OPTIONS, captureCommit())
    })
  })
} else {
  const harvested = readHarvest(FILES)

  it("the cases hand it no class, no DmText and no ActionBtn", () => {
    expectClassFree(harvested.cases)
  })

  const cases: Record<string, HarvestedCase> = { ...harvested.cases, ...HAND }
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
  describe("CalendarTimeSheet draws as before", () => {
    it.each(rows)("$id ($site) [$env.language $env.platform]", async (row) => {
      const { id, entry, env } = row
      const tree = await renderScreen(loaderFor(entry, row.variant), {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
      })
      expectParity(parityName(id, env), tree, {
        allow: entry.props.isVisible === true ? BUTTON : undefined,
      })
    })
  })
  // Confirm is a disabled grey button until a window is picked, then red.
  describe("CalendarTimeSheet after a customer picks", () => {
    const open = Object.entries(cases).find(
      ([, entry]) => entry.props.isVisible === true
    )!
    const STEPS = {
      "a window": [(root: never) => pressText(root, "12:00 - 3:00 PM")],
      "a window, then another": [
        (root: never) => pressText(root, "12:00 - 3:00 PM"),
        (root: never) => pressText(root, "3:00 - 6:00 PM"),
      ],
      "a window, then the same": [
        (root: never) => pressText(root, "12:00 - 3:00 PM"),
        (root: never) => pressText(root, "12:00 - 3:00 PM"),
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
          loaderFor(open[1], "no lead time"),
          { lang: env.language, platform: env.platform, navigation: "none" },
          env,
          STEPS[name as keyof typeof STEPS] as never
        )
        expectParity(parityName(`pressed ${name}`, env), tree, {
          allow: BUTTON,
        })
      }
    )
  })
}
