/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the sheet is passed as a loader. */
import { describe, expect, it, jest } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  type RenderScreenOptions,
  type Step,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { pressContaining } from "testing/pressContaining"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"

import {
  Q_AREA,
  Q_BRAND,
  Q_BUDGET,
  Q_CUISINES,
  Q_KIND,
} from "../../ProsListingScreen/__fixtures__/discover"

/*
 * FiltersSheet (the filters), captured from the unconverted code, on its own
 * with the props the listing hands it: the sheet's every section (pro type,
 * distance, rating, response time, payment), the refinement chips with a
 * parent, the range boxes with and without a slider, the locked upfront picks
 * ("chosen earlier"), food's fulfillment chips and cuisines, everything seeded
 * as a second open (every chip picked, a distance, ranges), at the platform's
 * own bottom inset and at none and a home indicator past it. The listing's own
 * test opens it by pressing the filters icon and applies it; this one holds
 * what a listing row can't reach cheaply. Then the presses: a chip, Reset all,
 * the close X and Show results, each handing over exactly what was picked.
 */

const load = () => {
  const React = require("react") as typeof import("react")
  const { FiltersSheet } = require("../FiltersScreen")
  const Harness = (props: Record<string, unknown>) =>
    React.createElement(FiltersSheet, {
      visible: true,
      contentKey: 1,
      onClose: () => undefined,
      onApply: () => undefined,
      ...props,
    })
  return { default: Harness }
}

// Show results is an ActionBtn before and a Button after: Button's own listed deltas on its root.
const ALLOW: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const UPFRONT = [
  {
    questionText: Q_KIND.text,
    questionTextAr: Q_KIND.textAr,
    options: [{ key: "repair", label: "Repair", labelAr: "إصلاح" }],
  },
]

type Case = {
  state: string
  props: Record<string, unknown>
  insets?: { bottom: number }
  steps?: Step[]
}

const PLAIN = { currentPlaceOfService: "customerPlace" }
const PHYSICAL = { currentPlaceOfService: "proToCustomer" }
const REFINEMENTS = { refinementFilters: [Q_BRAND, Q_BUDGET, Q_AREA] }

const CASES: Case[] = [
  { state: "nothing asked, online", props: PLAIN },
  // (Every physical place, proToCustomer to fixedLocations, draws the distance section: one row.)
  { state: "nothing asked, at the customer's", props: PHYSICAL },
  { state: "every filter kind", props: { ...PHYSICAL, ...REFINEMENTS } },
  { state: "an upfront pick locks a parent", props: { ...PHYSICAL, ...REFINEMENTS, upfrontSelections: UPFRONT } },
  { state: "two upfront questions, one with many picks", props: { ...PHYSICAL, ...REFINEMENTS, upfrontSelections: [...UPFRONT, { questionText: "Anything else", options: [{ key: "a", label: "Alpha" }, { key: "b", label: "Beta" }, { key: "c", label: "Gamma", labelAr: "غاما" }] }] } },
  { state: "a second open, everything seeded", props: { ...PHYSICAL, ...REFINEMENTS, upfrontSelections: UPFRONT, initialFilters: { proType: "company", distanceKm: 20, minRating: 4.5, maxResponseTimeHours: 4, creditCardPayment: true }, initialRefinementOptionIds: [9021, 9022], initialRanges: [{ filterId: 91, min: 200, max: 400 }, { filterId: 92, min: 30 }] } },
  { state: "seeded ranges only", props: { ...PHYSICAL, ...REFINEMENTS, initialRanges: [{ filterId: 91, max: 500 }] } },
  { state: "food, all", props: { currentPlaceOfService: undefined, isFoodCategory: true, foodMode: "all", refinementFilters: [Q_CUISINES] } },
  { state: "food, delivery with a cuisine seeded", props: { isFoodCategory: true, foodMode: "delivery", refinementFilters: [Q_CUISINES], initialRefinementOptionIds: [9111] } },
  { state: "food, pickup, no refinements", props: { isFoodCategory: true, foodMode: "pickup" } },
  { state: "a distance of 1 km seeded", props: { ...PHYSICAL, initialFilters: { distanceKm: 1 } } },
  { state: "bottom inset 0", props: PHYSICAL, insets: { bottom: 0 } },
  { state: "bottom inset 48", props: PHYSICAL, insets: { bottom: 48 } },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("FiltersSheet, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async ({ state, props, insets, steps, env }) => {
    const tree = await treeAfter(
      load,
      { ...screenState("data"), lang: env.language, platform: env.platform, navigation: "none", insets, props },
      env,
      steps
    )
    expectParity(parityName(state, env), tree, { allow: ALLOW })
  })
})

describe.each(PARITY_MATRIX)("FiltersSheet presses [$language $platform]", (env: ParityEnv) => {
  const open = (props: Record<string, unknown>) =>
    openScreen(load, {
      ...screenState("data"),
      lang: env.language,
      platform: env.platform,
      navigation: "none",
      props,
    } as RenderScreenOptions)
  type Session = Awaited<ReturnType<typeof open>>
  const act = (session: Session, press: () => void) => session.act(() => { press() })
  const individual = copy(env, "individual")

  it("Show results hands over what was picked, once, and closes", async () => {
    const onApply = jest.fn()
    const onClose = jest.fn()
    const session = await open({ ...PHYSICAL, ...REFINEMENTS, onApply, onClose })
    try {
      await act(session, () => pressText(session.root, individual))
      await act(session, () => pressText(session.root, "4+ ★"))
      await act(session, () => pressText(session.root, copy(env, "under_4_hours")))
      await act(session, () => pressText(session.root, copy(env, "credit_card")))
      await act(session, () => pressText(session.root, env.language === "ar" ? Q_BRAND.options![0].labelAr! : Q_BRAND.options![0].label))
      await act(session, () => pressTitled(session.root, copy(env, "show_results")))
      expect(onApply).toHaveBeenCalledTimes(1)
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({
          proType: "individual",
          minRating: 4,
          maxResponseTimeHours: 4,
          creditCardPayment: true,
          refinementFilterOptionIds: [9021],
          ranges: [],
          distanceKm: undefined,
        })
      )
      expect(onClose).toHaveBeenCalledTimes(1)
    } finally {
      session.unmount()
    }
  })

  it("the close X closes without applying; Reset all clears what was picked", async () => {
    const onApply = jest.fn()
    const onClose = jest.fn()
    const session = await open({ ...PHYSICAL, onApply, onClose, initialFilters: { proType: "company", minRating: 3 } })
    try {
      await act(session, () => pressText(session.root, copy(env, "reset_all")))
      await act(session, () => pressTitled(session.root, copy(env, "show_results")))
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ proType: undefined, minRating: undefined, distanceKm: undefined, ranges: [], refinementFilterOptionIds: [] })
      )
      expect(onClose).toHaveBeenCalledTimes(1)
      onApply.mockClear()
      await act(session, () => pressIcon(session.root, { icon: "svg:close" }))
      expect(onClose).toHaveBeenCalledTimes(2)
      expect(onApply).not.toHaveBeenCalled()
    } finally {
      session.unmount()
    }
  })

  it("food's fulfillment chips hand over the mode", async () => {
    const onApply = jest.fn()
    const session = await open({ isFoodCategory: true, foodMode: "all", onApply })
    try {
      await act(session, () => pressText(session.root, copy(env, "pickup")))
      await act(session, () => pressTitled(session.root, copy(env, "show_results")))
      expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ fulfillment: "pickup" }))
    } finally {
      session.unmount()
    }
  })

  it("a refinement chip's child shows once its parent is locked in upfront, and a oneChoice replaces its sibling", async () => {
    const onApply = jest.fn()
    const session = await open({ ...PHYSICAL, ...REFINEMENTS, upfrontSelections: UPFRONT, onApply })
    try {
      const ideal = env.language === "ar" ? Q_BRAND.options![1].labelAr! : Q_BRAND.options![1].label
      expect(JSON.stringify(session.tree())).toContain(ideal)
      expect(JSON.stringify(session.tree())).not.toContain(env.language === "ar" ? Q_BRAND.options![2].labelAr! : Q_BRAND.options![2].label)
      await act(session, () => pressText(session.root, ideal))
      await act(session, () => pressTitled(session.root, copy(env, "show_results")))
      expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ refinementFilterOptionIds: [9022] }))
    } finally {
      session.unmount()
    }
  })
})
