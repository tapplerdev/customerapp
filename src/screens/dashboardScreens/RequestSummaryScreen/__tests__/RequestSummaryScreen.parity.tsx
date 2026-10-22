/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  BOTTOM_GAP_INSETS,
  copy,
  openScreen,
  pressIcon,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  wait,
  type BackendFixtures,
  type Step,
} from "testing/screenKit"
import { pressContaining } from "testing/pressContaining"
import { guestState, screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import {
  CATEGORY,
  PRO_COMPANY,
  PRO_INDIVIDUAL,
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
import type { SelectedProInfo } from "navigation/types"
import type { ServiceQuestionType, ServiceType } from "types/cms"
import type { QuestionAnswerType } from "types/job"

/*
 * RequestSummaryScreen: "Review request", the last screen before a request is
 * sent. Every "when" card (as soon as possible, within 48 hours and a week
 * with their deadlines, undecided, a chosen day with and without a window, and
 * the day a customer with no date type still carries; no date type alone and a
 * guest draw the same tree as undecided and as the first row, so they have no
 * row), the pros (one, two with
 * their remove crosses, no photo, no rating, a rating with and without a review
 * count, a business), the answers (each kind of answer, an answer whose question
 * is gone, rows with nothing to show), notes or none, no insets and a tall
 * bottom inset under Send, Send while it sends, and the error sheet (a message,
 * validation errors, nothing but the default). Pressed: Send (signed in: the
 * request; a guest: the sign-in gate), the pros, Edit, the crosses, the back
 * chevron. The card headings use font-custom800 (no such face: the system
 * one), the deadline reads the clock the kit freezes, the map is a host.
 */

const NAME = "RequestSummaryScreen"
const load = () => require("../RequestSummaryScreen")

// Send is an ActionBtn before the conversion and a ds Button after it, in every
// row (its loading and disabled rows too): emptied, all 76 rows fail, and each
// allowance alone fails them all, so each row needs both. Its `rounded-[12]`
// drew nothing (a latent row), so the Button has no shape prop.
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const MULTI: ServiceQuestionType = {
  id: 703,
  assignee: "customer",
  type: "multipleChoice",
  style: "checkbox",
  text: "Which fixtures?",
  textAr: "أي تركيبات؟",
  isFilter: false,
  order: 3,
  options: [
    {
      id: 7031,
      label: "Tap",
      labelAr: "صنبور",
      value: "Tap",
      valueAr: "صنبور",
    },
    { id: 7032, label: "Sink", labelAr: "حوض", value: "Sink" },
  ],
}

const SERVICE_WITH_QUESTIONS: ServiceType = {
  ...SERVICE,
  categories: [
    {
      ...CATEGORY,
      customerQuestions: [QUESTION_PLACE, MULTI],
    },
  ],
}

const ANSWERS: QuestionAnswerType[] = [
  { questionId: 701, optionId: 7011 },
  { questionId: 702, answer: "Under the kitchen sink, behind the pipe." },
  { questionId: 703, optionsIds: [7031, 7032] },
  { questionId: 704, date: "2026-10-25" },
  { questionId: 705, startTime: "09:00", endTime: "12:00" },
  { questionId: 706, files: ["a.jpg", "b.jpg"] },
  // nothing to show: a bare row, and an option whose question is gone
  { questionId: 707 },
  { questionId: 798, optionId: 5 },
]

const PRO_PHOTO: SelectedProInfo = {
  id: PRO_INDIVIDUAL.id,
  name: PRO_INDIVIDUAL.registeredName,
  photo: PRO_INDIVIDUAL.profilePhoto,
  rating: 4.6,
  reviewsCount: 18,
  proType: "individual",
}
const PRO_BUSINESS: SelectedProInfo = {
  id: PRO_COMPANY.id,
  name: PRO_COMPANY.registeredName,
  rating: 4.2,
  proType: "company",
}
const PRO_NEW: SelectedProInfo = {
  id: 1004,
  name: "salma nour",
  proType: "individual",
}

const params = (more: object = {}) => ({
  ...ROUTE_PARAMS.RequestSummaryScreen,
  ...more,
})

const send =
  (env: ParityEnv): Step =>
  (root) => {
    pressTitled(root, copy(env, "send_request"))
  }
const removePro =
  (nth: number): Step =>
  (root) => {
    pressIcon(root, { icon: "svg:close", nth })
  }

type Case = {
  state: string
  guest?: boolean
  params?: object
  api?: BackendFixtures
  insets?: { bottom: number }
  steps?: (env: ParityEnv) => Step[]
  allow?: ParityAllowance[]
}

const CASES: Case[] = [
  { state: "as soon as possible, two pros, answers and notes" },
  { state: "within 48 hours", params: params({ dateType: "hours48" }) },
  { state: "within a week", params: params({ dateType: "week" }) },
  { state: "undecided", params: params({ dateType: "notDecided" }) },
  {
    state: "no date type, a day carried",
    params: params({ dateType: undefined, selectedDate: "2026-10-24" }),
  },
  {
    state: "a day and a window",
    params: params({
      dateType: "date",
      selectedDate: "2026-10-24",
      selectedTimeSlot: { start: "09:00", end: "12:00" },
    }),
  },
  {
    state: "a day, no window",
    params: params({ dateType: "date", selectedDate: "2026-10-24" }),
  },
  {
    state: "one pro, no notes, no answers",
    params: params({
      selectedProsInfo: [PRO_PHOTO],
      notes: "",
      questionsAnswers: [],
    }),
  },
  {
    state: "three pros: a photo, a business, a new one",
    params: params({ selectedProsInfo: [PRO_PHOTO, PRO_BUSINESS, PRO_NEW] }),
  },
  { state: "no pros left", params: params({ selectedProsInfo: [] }) },
  {
    state: "a pro removed",
    params: params({ selectedProsInfo: [PRO_PHOTO, PRO_BUSINESS, PRO_NEW] }),
    steps: () => [removePro(1)],
  },
  {
    state: "every kind of answer",
    params: params({ questionsAnswers: ANSWERS }),
    api: { getServiceById: { data: SERVICE_WITH_QUESTIONS } },
  },
  {
    state: "answers whose questions did not load",
    params: params({ questionsAnswers: ANSWERS }),
    api: { getServiceById: "loading" },
  },
  { state: "no bottom inset", insets: { bottom: BOTTOM_GAP_INSETS[0] } },
  { state: "a tall bottom inset", insets: { bottom: BOTTOM_GAP_INSETS[1] } },
  {
    state: "sending",
    api: { createJob: "loading" },
    steps: (env) => [send(env)],
  },
  {
    state: "the server's message",
    api: {
      createJob: {
        error: { status: 400, data: { message: "That pro is not available." } },
      },
    },
    steps: (env) => [send(env)],
  },
  {
    state: "validation errors",
    api: {
      createJob: {
        error: {
          status: 422,
          data: {
            validationErrors: {
              dateType: ["Pick a date type"],
              address: ["Address is missing", "City is missing"],
            },
          },
        },
      },
    },
    steps: (env) => [send(env)],
  },
  {
    state: "an error with no message",
    api: { createJob: { error: { status: 500, data: {} } } },
    steps: (env) => [send(env)],
  },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

const options = (entry: Case, env: ParityEnv) => {
  const base = entry.guest ? guestState("data") : screenState("data")
  return {
    ...base,
    api: { ...DATA, ...entry.api },
    lang: env.language,
    platform: env.platform,
    ...(entry.insets ? { insets: entry.insets } : {}),
    route: { name: NAME, params: entry.params ?? params() },
  }
}

describe("RequestSummaryScreen, captured from the unconverted code", () => {
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

describe("RequestSummaryScreen: presses", () => {
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
  const created = (session: Session) =>
    session.requests().filter((request) => request.endpoint === "createJob")

  it.each(PARITY_MATRIX)(
    "Send posts the request once and opens the success screen [$language $platform]",
    async (env) => {
      const session = await open(
        { state: "send", api: { createJob: { data: { id: 8301 } } } },
        env
      )
      try {
        await run(session, env, [send(env)])
        expect(created(session)).toHaveLength(1)
        const body = JSON.stringify(created(session)[0].args)
        expect(body).toContain('"serviceCategoryId":301')
        expect(body).toContain('"prosIds":[1001,1002]')
        expect(body).toContain('"dateType":"asap"')
        expect(body).toContain('"orderNotes":"Please call when you arrive."')
        const last = actions(session).at(-1)!
        expect(last.payload?.name).toBe("RequestSuccessScreen")
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a guest's Send goes to the sign-in gate and sends nothing [$language $platform]",
    async (env) => {
      const session = await open({ state: "guest", guest: true }, env)
      try {
        await run(session, env, [send(env)])
        expect(created(session)).toHaveLength(0)
        expect(actions(session).at(-1)!.payload?.name).toBe("AuthGateScreen")
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "Send is off with no pros [$language $platform]",
    async (env) => {
      const session = await open(
        { state: "none", params: params({ selectedProsInfo: [] }) },
        env
      )
      try {
        expect(() =>
          pressTitled(session.root, copy(env, "send_request"))
        ).toThrow(/disabled/)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "removing a pro takes it off the request [$language $platform]",
    async (env) => {
      const session = await open(
        {
          state: "remove",
          params: params({ selectedProsInfo: [PRO_PHOTO, PRO_BUSINESS] }),
          api: { createJob: { data: { id: 8301 } } },
        },
        env
      )
      try {
        await run(session, env, [removePro(0), send(env)])
        expect(JSON.stringify(created(session)[0].args)).toContain(
          '"prosIds":[1002]'
        )
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a pro opens its profile, Edit and the chevron go back [$language $platform]",
    async (env) => {
      const session = await open({ state: "navigate" }, env)
      try {
        await run(session, env, [
          (root) => pressContaining(root, PRO_INDIVIDUAL.registeredName),
          (root) => pressContaining(root, copy(env, "edit")),
          (root) => pressIcon(root, { icon: "svg:chevron-left" }),
        ])
        const list = actions(session)
        expect(list.map((action) => action.type)).toEqual([
          "NAVIGATE",
          "GO_BACK",
          "GO_BACK",
        ])
        expect(list[0].payload?.name).toBe("ProProfileScreen")
        expect(list[0].payload?.params).toEqual({
          proId: PRO_INDIVIDUAL.id,
          serviceCategoryId: CATEGORY.id,
        })
      } finally {
        session.unmount()
      }
    }
  )
})
