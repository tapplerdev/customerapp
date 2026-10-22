/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the sheet is passed as a loader. */
import { describe, expect, it, jest } from "@jest/globals"

import {
  closeSheetAsUser,
  copy,
  openScreen,
  pressIcon,
  pressText,
  rowsByPlatform,
  treeAfter,
  typeInto,
  wait,
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

import { Q_DETAILS, QUESTIONS_RICH } from "../../ProsListingScreen/__fixtures__/discover"

/*
 * QuestionFlowSheet (the question flow), captured from the unconverted code,
 * on its own with the props the listing hands it: the place step, a place
 * picked, the second, third and last cards stacked over each other (a covered
 * card drifts back by a third of the window, so these run at the 402-wide
 * default and a 390-wide phone), Back popping a card, one question and no
 * question at all, a seeded repost, a long category name, and the platform's
 * own bottom inset, none and a home indicator past it. Next is disabled until
 * the card is answered. The listing's own test lets the flow open by itself and
 * finishes it. Then the presses: a place, an answer, Next, Back, the close X and
 * Done, each handing over what was picked, and that a swipe down is refused.
 */

const load = () => {
  const React = require("react") as typeof import("react")
  const { QuestionFlowSheet } = require("../QuestionStepScreen")
  const Harness = (props: Record<string, unknown>) =>
    React.createElement(QuestionFlowSheet, {
      visible: true,
      contentKey: 1,
      onClose: () => undefined,
      categoryName: "Plumbing",
      placeOfServiceOptions: ["proToCustomer", "customerToPro", "remoteOrOnline"],
      customerQuestions: QUESTIONS_RICH,
      ...props,
    })
  return { default: Harness }
}

// Next and Done are an ActionBtn before and a Button after: Button's own listed deltas on its root.
const ALLOW: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const place = (key: string): Step => (root, env) => pressContaining(root, copy(env, key))
/** Next on the nth card of the stack (each visited card stays mounted); disabled ones are refused. */
const next = (nth: number): Step => (root, env) => pressText(root, copy(env, "next"), { nth })
const done = (nth: number): Step => (root, env) => pressText(root, copy(env, "done"), { nth })
const back = (nth: number): Step => (root) => pressIcon(root, { icon: "svg:chevron-left", nth })
const words = (env: ParityEnv, en: string, ar: string) => (env.language === "ar" ? ar : en)
const option = (en: string, ar: string): Step => (root, env) => pressContaining(root, words(env, en, ar))

const TO_SECOND: Step[] = [place("at_my_location"), next(0), wait(600)]
const TO_THIRD: Step[] = [...TO_SECOND, option("Repair", "إصلاح"), next(1), wait(600)]
const TO_LAST: Step[] = [...TO_THIRD, option("The tap", "الصنبور"), next(2), wait(600)]

type Case = {
  state: string
  props?: Record<string, unknown>
  insets?: { bottom: number }
  window?: { width: number }
  steps?: Step[]
}

const SEEDED = [
  { questionId: 801, optionId: 8011, answer: "Repair" },
  { questionId: 805, optionsIds: [8051], answer: "The tap" },
  { questionId: 806, answer: "Under the kitchen sink." },
]

const BASE: Case[] = [
  { state: "the place step" },
  // (A place seeded by the repost draws the same as one picked.)
  { state: "a place picked", steps: [place("at_pro_location")] },
  { state: "the second card over the first", steps: TO_SECOND },
  { state: "the second card, an answer picked", steps: [...TO_SECOND, option("Installation", "تركيب")] },
  { state: "the third card (a multiple choice)", steps: TO_THIRD },
  { state: "the last card, Done disabled", steps: TO_LAST },
  { state: "the last card answered, Done", steps: [...TO_LAST, (root) => typeInto(root, 0, "Under the sink.")] },
  { state: "Back pops the second card", steps: [...TO_SECOND, back(1), wait(600)] },
  { state: "a seeded repost opens pre-filled", props: { initialPlaceOfService: "proToCustomer", initialAnswers: SEEDED }, steps: [next(0), wait(600)] },
  { state: "one question, no place step (Done at once)", props: { placeOfServiceOptions: ["proToCustomer"], customerQuestions: [Q_DETAILS] } },
  { state: "one question answered", props: { placeOfServiceOptions: ["proToCustomer"], customerQuestions: [Q_DETAILS] }, steps: [(root) => typeInto(root, 0, "Hello")] },
  { state: "no places and no questions", props: { placeOfServiceOptions: [], customerQuestions: [] } },
  { state: "a long category name", props: { categoryName: "Plumbing, heating and every other kind of household maintenance and repair" } },
  { state: "bottom inset 0", insets: { bottom: 0 } },
  { state: "bottom inset 48", insets: { bottom: 48 } },
]

// A covered card's drift reads the window (a third of it): run the stacked states at 390 too.
const STACKED = ["the second card over the first", "the third card (a multiple choice)", "the last card, Done disabled"]
const CASES: Case[] = [
  ...BASE,
  ...BASE.filter((c) => STACKED.includes(c.state)).map((c) => ({
    ...c,
    state: `${c.state}, a 390-wide phone`,
    window: { width: 390 },
  })),
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)
// A window's rows together (each window is a registry of its own).
const ordered = [...rows.filter((r) => !r.window), ...rows.filter((r) => r.window)]

describe("QuestionFlowSheet, captured from the unconverted code", () => {
  it.each(ordered)("$state [$env.language $env.platform]", async ({ state, props, insets, window, steps, env }) => {
    const tree = await treeAfter(
      load,
      { ...screenState("data"), lang: env.language, platform: env.platform, navigation: "none", insets, window, props } as RenderScreenOptions,
      env,
      steps
    )
    expectParity(parityName(state, env), tree, { allow: ALLOW })
  })
})

describe.each(PARITY_MATRIX)("QuestionFlowSheet presses [$language $platform]", (env: ParityEnv) => {
  const open = (props: Record<string, unknown>) =>
    openScreen(load, {
      ...screenState("data"),
      lang: env.language,
      platform: env.platform,
      navigation: "none",
      props,
    } as RenderScreenOptions)
  type Session = Awaited<ReturnType<typeof open>>
  const run = async (session: Session, steps: Step[]) => {
    for (const step of steps) {
      // eslint-disable-next-line no-await-in-loop
      await session.act(() => step(session.root, env), step.settleMs)
    }
  }

  it("Next is refused until the card is answered, then walks on; Done commits once and closes", async () => {
    const onClose = jest.fn()
    const session = await open({ onClose })
    try {
      await expect(run(session, [next(0)])).rejects.toThrow(/disabled/)
      await run(session, [...TO_LAST, (root) => typeInto(root, 0, "Under the sink."), done(0)])
      expect(onClose).toHaveBeenCalledTimes(1)
    } finally {
      session.unmount()
    }
  })

  it("Back goes to the card before; from the first card it commits and closes; the X does too", async () => {
    const onClose = jest.fn()
    const session = await open({ onClose })
    try {
      await run(session, TO_SECOND)
      await run(session, [back(1), wait(600)])
      expect(onClose).not.toHaveBeenCalled()
      expect(JSON.stringify(session.tree())).not.toContain("What kind of job is it?")
      await run(session, [back(0)])
      expect(onClose).toHaveBeenCalledTimes(1)
      await run(session, [(root) => pressIcon(root, { icon: "svg:close" })])
      expect(onClose).toHaveBeenCalledTimes(2)
    } finally {
      session.unmount()
    }
  })

  it("a swipe down is refused (the sheet intercepts back): nothing is committed or closed", async () => {
    const onClose = jest.fn()
    const session = await open({ onClose })
    try {
      await run(session, [place("at_my_location")])
      await session.act(() => {
        closeSheetAsUser(session.root, { refused: true })
      })
      expect(onClose).not.toHaveBeenCalled()
    } finally {
      session.unmount()
    }
  })
})
