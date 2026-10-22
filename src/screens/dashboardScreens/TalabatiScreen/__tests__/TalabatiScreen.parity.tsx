/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"
import type { ReactTestInstance } from "react-test-renderer"

import {
  copy,
  openScreen,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  type Step,
} from "testing/screenKit"
import { pressContaining } from "testing/pressContaining"
import { guestState, screenState } from "testing/screenKit/states"
import {
  DATA,
  SERVER_ERROR,
  type BackendFixtures,
} from "testing/screenKit/fixtures/api"
import { JOB } from "testing/screenKit/fixtures/entities"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"
import type { JobType } from "types/job"

import {
  JOB_REVIEWABLE,
  TALABATI_JOBS,
  SELECTED_OFFER,
} from "../../__fixtures__/jobStates"

/*
 * TalabatiScreen, the Requests tab: a guest's sign-in prompt, the skeleton, a
 * failed load (and the retry while it loads again), nothing yet, and the list:
 * a request in every state its status line words differently (active with
 * offers, completed, cancelled by either side, declined, ended, expired, an
 * unknown status, no category, a food order declined, cancelled or moving), the
 * Leave a review pill with the sheet it opens, a pull to refresh and a tap on a
 * row (a pull to refresh draws the same tree as the list, so it is a press
 * test only). The FlatList draws its first ten rows, so the twelve requests are two
 * rows of the table.
 */

const load = () => require("../TalabatiScreen")
const NAME = "TalabatiScreen"

// Log in (the guest's) and Try again (a failed load) are ActionBtns before the
// conversion and ds Buttons after it. Emptied, exactly those two states fail
// (8 rows), on the button's height and its accessibility props. The retry
// while it loads draws the same spinner tree either way: no allowance there.
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

type Case = {
  state: string
  guest?: boolean
  jobs?: "loading" | "error" | JobType[]
  /** What the jobs list answers after the first time (the retry). */
  then?: "loading"
  steps?: (env: ParityEnv) => Step[]
  allow?: ParityAllowance[]
}

const FIRST = TALABATI_JOBS.slice(0, 6)
const SECOND = TALABATI_JOBS.slice(6)
const ONE_REVIEW = [TALABATI_JOBS[0]]
const TWO_REVIEWABLE: JobType[] = [
  {
    ...JOB,
    id: 8201,
    pros: JOB_REVIEWABLE.pros!.slice(0, 2),
  },
]

const press =
  (text: string, nth = 0): Step =>
  (root) => {
    const found = root.findAll(
      (node) =>
        typeof node.props.onPress === "function" &&
        JSON.stringify(textOf(node)).includes(JSON.stringify(text).slice(1, -1))
    )
    const controls = found.filter(
      (node) => !found.some((other) => other !== node && isInside(other, node))
    )
    controls[nth].props.onPress()
  }

const textOf = (node: ReactTestInstance): string =>
  node.children
    .map((child) => (typeof child === "string" ? child : textOf(child)))
    .join("")

const isInside = (node: ReactTestInstance, outer: ReactTestInstance) => {
  for (let up = node.parent; up; up = up.parent) if (up === outer) return true
  return false
}

const pull: Step = (root) => {
  const control = root.findAll(
    (node) => typeof node.props.onRefresh === "function"
  )[0]
  control.props.onRefresh()
}

const CASES: Case[] = [
  { state: "a guest", guest: true, allow: BUTTON },
  { state: "loading" },
  { state: "the load failed", jobs: "error", allow: BUTTON },
  {
    state: "the retry loading",
    jobs: "error",
    then: "loading",
    steps: (env) => [(root) => pressTitled(root, copy(env, "try_again"))],
  },
  { state: "no requests yet", jobs: [] },
  { state: "requests, the first six", jobs: FIRST },
  { state: "requests, the rest", jobs: SECOND },
  { state: "one request with a review to leave", jobs: ONE_REVIEW },
  {
    state: "the review sheet open",
    jobs: ONE_REVIEW,
    steps: (env) => [press(copy(env, "leave_review"))],
  },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

const options = (entry: Case, env: ParityEnv) => {
  const base = entry.guest ? guestState("data") : screenState("data")
  let calls = 0
  const jobs = entry.jobs ?? "loading"
  const answer: BackendFixtures["getCustomerJobs"] = () => {
    calls += 1
    if (calls > 1 && entry.then) return entry.then
    if (jobs === "loading") return "loading"
    if (jobs === "error") return SERVER_ERROR
    return { data: { data: jobs, page: 1, perPage: 20, total: jobs.length } }
  }
  return {
    ...base,
    api: { ...DATA, getCustomerJobs: answer },
    lang: env.language,
    platform: env.platform,
    route: { name: NAME },
  }
}

describe("TalabatiScreen, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async (entry) => {
    const tree = await treeAfter(
      load,
      options(entry, entry.env),
      entry.env,
      entry.steps?.(entry.env)
    )
    expectParity(parityName(entry.state, entry.env), tree, {
      allow: entry.allow ?? [],
    })
  })
})

type Navigate = {
  type: string
  payload: { name: string; params?: object }
}

describe("TalabatiScreen: presses", () => {
  const open = (entry: Case, env: ParityEnv) =>
    openScreen(load, options(entry, env))
  const lastAction = (actions: unknown[]) =>
    actions[actions.length - 1] as Navigate

  it.each(PARITY_MATRIX)(
    "a guest's Log in opens the sign-in screen once [$language $platform]",
    async (env) => {
      const session = await open({ state: "guest", guest: true }, env)
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "log_In"))
        })
        expect(session.navigation.actions).toHaveLength(1)
        expect(lastAction(session.navigation.actions).payload.name).toBe(
          "SignInEmailScreen"
        )
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "Try again asks for the requests again [$language $platform]",
    async (env) => {
      const session = await open({ state: "failed", jobs: "error" }, env)
      try {
        const asked = () =>
          session.requests().filter((r) => r.endpoint === "getCustomerJobs")
            .length
        const before = asked()
        await session.act(() => {
          pressTitled(session.root, copy(env, "try_again"))
        })
        expect(asked()).toBe(before + 1)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a request opens its page [$language $platform]",
    async (env) => {
      const session = await open({ state: "row", jobs: ONE_REVIEW }, env)
      try {
        await session.act(() => {
          pressContaining(
            session.root,
            env.language === "ar" ? "السباكة" : "Plumbing"
          )
        })
        const last = lastAction(session.navigation.actions)
        expect(last.payload.name).toBe("JobDetailScreen")
        expect(last.payload.params).toEqual({ jobId: ONE_REVIEW[0].id })
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a pull refreshes the list [$language $platform]",
    async (env) => {
      const session = await open({ state: "pull", jobs: FIRST }, env)
      try {
        const asked = () =>
          session.requests().filter((r) => r.endpoint === "getCustomerJobs")
            .length
        const before = asked()
        await session.act(() => {
          pull(session.root, env)
        })
        expect(asked()).toBe(before + 1)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "Leave a review goes to the form for one pro, to the picker for several [$language $platform]",
    async (env) => {
      const one = await open({ state: "one", jobs: ONE_REVIEW }, env)
      try {
        await one.act(() => {
          press(copy(env, "leave_review"))(one.root, env)
        })
        // the sheet's own button (the pill is behind it)
        await one.act(() => {
          press(copy(env, "leave_review"), 1)(one.root, env)
        })
        const last = lastAction(one.navigation.actions)
        expect(last.payload.name).toBe("ReviewFormScreen")
        expect(last.payload.params).toEqual({
          jobId: ONE_REVIEW[0].id,
          proId: SELECTED_OFFER.proId,
        })
      } finally {
        one.unmount()
      }
      const several = await open(
        { state: "several", jobs: TWO_REVIEWABLE },
        env
      )
      try {
        await several.act(() => {
          press(copy(env, "leave_review"))(several.root, env)
        })
        await several.act(() => {
          press(copy(env, "leave_review"), 1)(several.root, env)
        })
        const last = lastAction(several.navigation.actions)
        expect(last.payload.name).toBe("ReviewProSelectionScreen")
        expect(last.payload.params).toEqual({ jobId: 8201 })
      } finally {
        several.unmount()
      }
    }
  )
})
