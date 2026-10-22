/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  BOTTOM_GAP_INSETS,
  copy,
  openScreen,
  pressIcon,
  presentedSheets,
  pressText,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  typeInto,
  wait,
  type Step,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import {
  CATEGORY,
  PRO_INDIVIDUAL,
  QUESTION_NOTES,
  QUESTION_PLACE,
  SERVICE,
} from "testing/screenKit/fixtures/entities"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"
import type { ServiceQuestionType, ServiceType } from "types/cms"

/*
 * ServiceRequestDetailsScreen: the request flow's question-by-question steps
 * after the pros are picked, ending in the "when" step. Every step kind: the
 * first question (a radio) and its answered state, the next step by pressing
 * Next (the screen pushes itself), a typed note, the date step alone and as
 * the last of three (progress full, "Continue"), each date option chosen, the
 * calendar sheet a further-out date opens, the chosen date shown as a pressable
 * line that reopens it, the loading overlay, the sheet that tells a customer a
 * late filter answer excluded a pro (and Next's own loading while that is
 * checked), and the bottom-gap insets (0, 48) under the button. The date line
 * is the one pressable DmText: it has a row that presses it.
 */

const NAME = "ServiceRequestDetailsScreen"
const load = () => require("../ServiceRequestDetailsScreen")

// Next / Continue is an ActionBtn before the conversion and a ds Button after,
// drawn in every state but the loading overlay: emptied, those 64 rows fail, and
// each of the two allowances alone fails them all, so each needs both.
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const FILTER_QUESTION: ServiceQuestionType = {
  ...QUESTION_PLACE,
  id: 711,
  text: "Which room?",
  textAr: "أي غرفة؟",
  isFilter: true,
  tier: "primary",
  options: [
    {
      id: 7111,
      label: "Kitchen",
      labelAr: "المطبخ",
      value: "kitchen",
      valueAr: "المطبخ",
      serviceCategoryFilterOptionId: 91,
    },
    {
      id: 7112,
      label: "Bathroom",
      labelAr: "الحمام",
      value: "bathroom",
      valueAr: "الحمام",
      serviceCategoryFilterOptionId: 92,
    },
  ],
}

const serviceWith = (
  questions: ServiceQuestionType[],
  dateTypes: string[] = CATEGORY.dateTypes ?? []
): ServiceType => ({
  ...SERVICE,
  categories: [{ ...CATEGORY, customerQuestions: questions, dateTypes }],
})

const FILTERED = serviceWith([FILTER_QUESTION], [])
const NOTHING_TO_ASK = serviceWith([], [])

const params = (more: object = {}) => ({
  ...ROUTE_PARAMS.ServiceRequestDetailsScreen,
  ...more,
})
/** Nothing answered before the flow: both questions, then the date. */
const FRESH = { answeredQuestions: [], initialAnsweredIds: [], stepIndex: 0 }

// What a question's option shows: its value, in the language when it has one.
const optionLabel = (question: ServiceQuestionType, env: ParityEnv) => {
  const [option] = question.options!
  return env.language === "ar" && option.valueAr ? option.valueAr : option.value
}

const pressOption =
  (question: ServiceQuestionType = QUESTION_PLACE): Step =>
  (root, env) => {
    pressTitled(root, optionLabel(question, env))
  }
const next =
  (env: ParityEnv): Step =>
  (root) => {
    pressTitled(root, copy(env, "next"))
  }
const cont =
  (env: ParityEnv): Step =>
  (root) => {
    pressTitled(root, copy(env, "continue"))
  }
const choose =
  (key: string): Step =>
  (root, env) => {
    pressTitled(root, copy(env, key))
  }
const pickWindow: Step = (root) => {
  pressText(root, "12:00 - 3:00 PM")
}
const confirmDate =
  (env: ParityEnv): Step =>
  (root) => {
    pressTitled(root, copy(env, "confirm"))
  }
const dateLine: Step = (root) => {
  pressText(root, "2026-10-20  •  12:00 - 15:00")
}
const furtherOut = choose("further_out")
const specificDates = choose("specific_dates")

type Case = {
  state: string
  params?: object
  service?: ServiceType | "loading"
  pros?: "excluded" | "loading"
  insets?: { bottom: number }
  steps?: (env: ParityEnv) => Step[]
  allow?: ParityAllowance[]
}

const CASES: Case[] = [
  { state: "loading", service: "loading", allow: [] },
  { state: "the first question", params: params(FRESH) },
  {
    state: "the first question answered",
    params: params(FRESH),
    steps: () => [pressOption()],
  },
  {
    state: "Next: the note question",
    params: params(FRESH),
    steps: (env) => [pressOption(), next(env)],
  },
  {
    state: "a note typed",
    params: params(FRESH),
    steps: (env) => [
      pressOption(),
      next(env),
      (root) => typeInto(root, 0, "Under the kitchen sink."),
    ],
  },
  { state: "the date step, answers carried in" },
  {
    state: "the date step, no bottom inset",
    insets: { bottom: BOTTOM_GAP_INSETS[0] },
  },
  {
    state: "the date step, a tall bottom inset",
    insets: { bottom: BOTTOM_GAP_INSETS[1] },
  },
  { state: "not decided", steps: () => [choose("havent_decided_yet")] },
  { state: "within 48 hours", steps: () => [choose("within_48_hours")] },
  { state: "within a week", steps: () => [choose("within_a_week")] },
  { state: "further out, the calendar open", steps: () => [furtherOut] },
  {
    state: "further out, a date picked",
    steps: (env) => [furtherOut, pickWindow, confirmDate(env)],
  },
  {
    state: "the date line pressed, the calendar open again",
    steps: (env) => [furtherOut, pickWindow, confirmDate(env), dateLine],
  },
  {
    state: "specific dates, a date picked",
    steps: (env) => [specificDates, pickWindow, confirmDate(env)],
  },
  {
    state: "a filter answer excludes a pro",
    service: FILTERED,
    pros: "excluded",
    params: params({ ...FRESH, selectedProIds: [1001, 1002] }),
    steps: (env) => [pressOption(FILTER_QUESTION), cont(env)],
  },
  {
    state: "checking the shortlist",
    service: FILTERED,
    pros: "loading",
    params: params({ ...FRESH, selectedProIds: [1001, 1002] }),
    steps: (env) => [pressOption(FILTER_QUESTION), cont(env)],
  },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

const options = (entry: Case, env: ParityEnv) => ({
  ...screenState("data"),
  api: {
    ...DATA,
    getServiceById:
      entry.service === "loading"
        ? ("loading" as const)
        : { data: entry.service ?? SERVICE },
    getProsForCategory:
      entry.pros === "loading"
        ? ("loading" as const)
        : {
            data: {
              data: [PRO_INDIVIDUAL],
              page: 1,
              perPage: 20,
              total: 1,
            },
          },
  },
  lang: env.language,
  platform: env.platform,
  ...(entry.insets ? { insets: entry.insets } : {}),
  route: { name: NAME, params: entry.params ?? params() },
})

describe("ServiceRequestDetailsScreen, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async (entry) => {
    const tree = await treeAfter(load, options(entry, entry.env), entry.env, [
      ...(entry.steps?.(entry.env) ?? []),
      wait(0),
    ])
    expectParity(parityName(entry.state, entry.env), tree, {
      allow: entry.allow ?? BUTTON,
    })
  })
})

type Action = {
  type: string
  payload?: { name?: string; params?: Record<string, unknown> }
}

describe("ServiceRequestDetailsScreen: presses", () => {
  const open = (entry: Case, env: ParityEnv) =>
    openScreen(load, options(entry, env))
  type Session = Awaited<ReturnType<typeof open>>
  const run = async (session: Session, env: ParityEnv, steps: Step[]) => {
    for (const step of steps) {
      // eslint-disable-next-line no-await-in-loop
      await session.act(() => {
        step(session.root, env)
      })
    }
  }
  const actions = (session: Session) => session.navigation.actions as Action[]

  it.each(PARITY_MATRIX)(
    "the chevron goes back, the X pops to the listing [$language $platform]",
    async (env) => {
      const session = await open({ state: "header" }, env)
      try {
        await run(session, env, [
          (root) => pressIcon(root, { icon: "svg:chevron-left" }),
          (root) => pressIcon(root, { icon: "svg:close" }),
        ])
        expect(actions(session).map((action) => action.type)).toEqual([
          "GO_BACK",
          "POP_TO_TOP",
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "Next waits for an answer, then pushes the next step [$language $platform]",
    async (env) => {
      const session = await open({ state: "next", params: params(FRESH) }, env)
      try {
        expect(() => pressTitled(session.root, copy(env, "next"))).toThrow(
          /disabled/
        )
        await run(session, env, [pressOption(), next(env)])
        // the pushed step is the note question: its heading, and Next disabled again
        expect(JSON.stringify(session.tree())).toContain(
          env.language === "ar" ? QUESTION_NOTES.textAr : QUESTION_NOTES.text
        )
        expect(() => pressTitled(session.root, copy(env, "next"))).toThrow(
          /disabled/
        )
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "Continue on a chosen window sends the summary its dateType [$language $platform]",
    async (env) => {
      const session = await open({ state: "continue" }, env)
      try {
        expect(() => pressTitled(session.root, copy(env, "continue"))).toThrow(
          /disabled/
        )
        await run(session, env, [choose("within_a_week"), cont(env)])
        const last = actions(session).at(-1)!
        expect(last.payload?.name).toBe("RequestSummaryScreen")
        expect(last.payload?.params).toMatchObject({ dateType: "week" })
        expect(last.payload?.params?.selectedDate).toBeUndefined()
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a further-out date and its window reach the summary, and the date line reopens the calendar [$language $platform]",
    async (env) => {
      const session = await open({ state: "date" }, env)
      try {
        await run(session, env, [furtherOut])
        expect(presentedSheets(session.root)).toHaveLength(1)
        await run(session, env, [pickWindow, confirmDate(env)])
        expect(presentedSheets(session.root)).toHaveLength(0)
        await run(session, env, [dateLine])
        expect(presentedSheets(session.root)).toHaveLength(1)
        await run(session, env, [pickWindow, confirmDate(env)])
        expect(presentedSheets(session.root)).toHaveLength(0)
        await run(session, env, [cont(env)])
        const last = actions(session).at(-1)!
        expect(last.payload?.name).toBe("RequestSummaryScreen")
        expect(last.payload?.params).toMatchObject({
          dateType: "date",
          selectedDate: "2026-10-20",
          selectedTimeSlot: { start: "12:00", end: "15:00" },
        })
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "an excluded pro stops Continue and the sheet's button goes back to the listing [$language $platform]",
    async (env) => {
      const session = await open(
        {
          state: "mismatch",
          service: FILTERED,
          pros: "excluded",
          params: params({ ...FRESH, selectedProIds: [1001, 1002] }),
        },
        env
      )
      try {
        await run(session, env, [pressOption(FILTER_QUESTION), cont(env)])
        expect(actions(session)).toHaveLength(0)
        expect(JSON.stringify(session.tree())).toContain(
          copy(env, "shortlist_updated")
        )
        await run(session, env, [
          (root) => pressTitled(root, copy(env, "see_matching_pros")),
        ])
        const last = actions(session).at(-1)!
        expect(last.type).toBe("POP_TO")
        expect(last.payload?.name).toBe("ProsListingScreen")
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a shortlist that still matches goes on to the summary [$language $platform]",
    async (env) => {
      const session = await open(
        {
          state: "match",
          service: FILTERED,
          params: params({ ...FRESH, selectedProIds: [1001] }),
        },
        env
      )
      try {
        await run(session, env, [pressOption(FILTER_QUESTION), cont(env)])
        expect(actions(session).at(-1)!.payload?.name).toBe(
          "RequestSummaryScreen"
        )
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "no questions and no date go straight to the summary [$language $platform]",
    async (env) => {
      const session = await open(
        { state: "nothing", service: NOTHING_TO_ASK },
        env
      )
      try {
        expect(
          actions(session).some(
            (action) => action.payload?.name === "RequestSummaryScreen"
          )
        ).toBe(true)
      } finally {
        session.unmount()
      }
    }
  )
})
