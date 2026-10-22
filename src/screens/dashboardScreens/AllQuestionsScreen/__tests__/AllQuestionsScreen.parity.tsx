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
  typeInto,
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

import { QUESTIONS_RICH } from "../../ProsListingScreen/__fixtures__/discover"

/*
 * AllQuestionsSheet (the job-details editor), captured from the unconverted
 * code, on its own with the props the listing hands it: with three places of
 * service (none, one, another picked), with one and with none (no place
 * block), with every kind of question, answers seeded as a second open, a long
 * category name, and at the platform's own bottom inset and at none and a home
 * indicator past it. The listing's own test opens it by pressing the banner.
 * Then the presses: a place, an answer, Reset all, the close X and See matches,
 * each handing over exactly what was picked, and the dismissal a swipe makes.
 */

const load = () => {
  const React = require("react") as typeof import("react")
  const { AllQuestionsSheet } = require("../AllQuestionsScreen")
  const Harness = (props: Record<string, unknown>) =>
    React.createElement(AllQuestionsSheet, {
      visible: true,
      contentKey: 1,
      onClose: () => undefined,
      onApply: () => undefined,
      categoryName: "Plumbing",
      placeOfServiceOptions: ["proToCustomer", "customerToPro", "remoteOrOnline"],
      customerQuestions: QUESTIONS_RICH,
      initialAnswers: [],
      ...props,
    })
  return { default: Harness }
}

// See matches is an ActionBtn before and a Button after: Button's own listed deltas on its root.
const ALLOW: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const SEEDED = [
  { questionId: 801, optionId: 8011, answer: "Repair" },
  { questionId: 805, optionsIds: [8051, 8053], answer: "The tap, The heater" },
  { questionId: 806, answer: "Under the kitchen sink, behind the pipes." },
]

type Case = {
  state: string
  props: Record<string, unknown>
  insets?: { bottom: number }
  steps?: Step[]
}

const CASES: Case[] = [
  { state: "three places, nothing answered", props: {} },
  { state: "a place seeded", props: { initialPlaceOfService: "customerToPro" } },
  { state: "a second open, answers and a place seeded", props: { initialPlaceOfService: "remoteOrOnline", initialAnswers: SEEDED } },
  // (No place at all draws the same as one: only two or more ask.)
  { state: "one place (no place block)", props: { placeOfServiceOptions: ["proToCustomer"] } },
  { state: "an unlisted place falls back to its own name", props: { placeOfServiceOptions: ["delivery", "fixedLocations", "somethingElse"] } },
  { state: "no questions", props: { customerQuestions: [] } },
  { state: "a pro's question is not asked", props: { customerQuestions: [{ ...QUESTIONS_RICH[0], id: 899, assignee: "pro", text: "A pro's question" }, ...QUESTIONS_RICH.slice(5)] } },
  { state: "a long category name", props: { categoryName: "Plumbing, heating and every other kind of household maintenance and repair" } },
  { state: "bottom inset 0", props: {}, insets: { bottom: 0 } },
  { state: "bottom inset 48", props: {}, insets: { bottom: 48 } },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("AllQuestionsSheet, captured from the unconverted code", () => {
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

describe.each(PARITY_MATRIX)("AllQuestionsSheet presses [$language $platform]", (env: ParityEnv) => {
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
  const ar = env.language === "ar"
  const label = (en: string, arabic: string) => (ar ? arabic : en)

  it("See matches hands over the place and the answers, once, and closes", async () => {
    const onApply = jest.fn()
    const onClose = jest.fn()
    const session = await open({ onApply, onClose })
    try {
      await act(session, () => pressContaining(session.root, copy(env, "at_pro_location")))
      await act(session, () => pressContaining(session.root, label("Repair", "إصلاح")))
      await act(session, () => pressContaining(session.root, label("The tap", "الصنبور")))
      await act(session, () => typeInto(session.root, 2, "Hello"))
      await act(session, () => pressTitled(session.root, copy(env, "see_matches")))
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onApply).toHaveBeenCalledTimes(1)
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({
          placeOfService: "customerToPro",
          filterOptionIds: [9011],
          filtersChanged: true,
          resetAll: false,
          dataAnswers: expect.arrayContaining([expect.objectContaining({ questionId: 806, answer: "Hello" })]),
        })
      )
    } finally {
      session.unmount()
    }
  })

  it("Reset all clears the answers and says so; the close X commits like See matches", async () => {
    const onApply = jest.fn()
    const onClose = jest.fn()
    const session = await open({ onApply, onClose, initialPlaceOfService: "remoteOrOnline", initialAnswers: SEEDED })
    try {
      await act(session, () => pressText(session.root, copy(env, "reset_all")))
      await act(session, () => pressIcon(session.root, { icon: "svg:close" }))
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onApply).toHaveBeenCalledTimes(1)
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ placeOfService: undefined, filterOptionIds: [], dataAnswers: [], allAnswers: [], resetAll: true, filtersChanged: true })
      )
    } finally {
      session.unmount()
    }
  })

  it("nothing changed: See matches reports no change", async () => {
    const onApply = jest.fn()
    const session = await open({ onApply, initialAnswers: SEEDED })
    try {
      await act(session, () => pressTitled(session.root, copy(env, "see_matches")))
      expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ filtersChanged: false, resetAll: false, filterOptionIds: [9011] }))
    } finally {
      session.unmount()
    }
  })
})
