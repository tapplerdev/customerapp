/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  openScreen,
  pressIcon,
  rowsByPlatform,
  treeAfter,
  type Step,
} from "testing/screenKit"
import { pressContaining } from "testing/pressContaining"
import { screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import { JOB } from "testing/screenKit/fixtures/entities"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"
import type { JobType } from "types/job"

import {
  FOOD_COURIER,
  FOOD_DELIVERED,
  JOB_ALL_REVIEWED,
  JOB_REVIEWABLE,
} from "../../__fixtures__/jobStates"

/*
 * ReviewProSelectionScreen: the pros a customer can still review, after
 * Talabati's "Leave a review" when a request has several. States: loading
 * (the screen draws no skeleton: the header and the title, no pros; a failed
 * load draws the same tree, so it has no row), the kit's job with one pro to
 * review, three (a photo, a company's, none) beside a reviewed one and one
 * only selected, and nothing left to review. Presses: each pro opens the
 * review form with its own id, the X goes back.
 *
 * A food order is reviewable once it is delivered and not before: the daily
 * reminder and an old push can open this screen for an order that has not
 * arrived, and its restaurant must not be on the list.
 */

const load = () => require("../ReviewProSelectionScreen")
const NAME = "ReviewProSelectionScreen"

type Case = {
  state: string
  job?: JobType | "loading"
  steps?: Step[]
}

const CASES: Case[] = [
  { state: "loading", job: "loading" },
  { state: "one pro to review" },
  { state: "three pros to review", job: JOB_REVIEWABLE },
  { state: "nothing left to review", job: JOB_ALL_REVIEWED },
  { state: "a delivered food order: its restaurant", job: FOOD_DELIVERED },
  { state: "a food order still on its way: nobody", job: FOOD_COURIER },
]

const answer = (job: Case["job"]) => {
  if (job === "loading") return "loading" as const
  return { data: job ?? JOB }
}

const options = (entry: Case, env: ParityEnv) => {
  const base = screenState("data")
  return {
    ...base,
    api: { ...DATA, getCustomerJobById: answer(entry.job) },
    lang: env.language,
    platform: env.platform,
    route: { name: NAME, params: { jobId: JOB.id } },
  }
}

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("ReviewProSelectionScreen, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async (entry) => {
    const tree = await treeAfter(load, options(entry, entry.env), entry.env)
    expectParity(parityName(entry.state, entry.env), tree)
  })
})

describe("ReviewProSelectionScreen: presses", () => {
  it.each(PARITY_MATRIX)(
    "a pro opens the review form [$language $platform]",
    async (env) => {
      const session = await openScreen(
        load,
        options({ state: "pros", job: JOB_REVIEWABLE }, env)
      )
      try {
        const names = ["Omar Hassan", "Nile Plumbing Co.", "Salma Nour"]
        const proIds = [1001, 1005, 1004]
        for (const [i, name] of names.entries()) {
          await session.act(() => {
            pressContaining(session.root, name)
          })
          const last = session.navigation.actions.at(-1) as {
            type: string
            payload: { name: string; params: object }
          }
          expect(last.type).toBe("NAVIGATE")
          expect(last.payload.name).toBe("ReviewFormScreen")
          expect(last.payload.params).toEqual({
            jobId: JOB.id,
            proId: proIds[i],
          })
        }
        expect(session.navigation.actions).toHaveLength(3)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a delivered food order's restaurant can be picked, one still on its way cannot [$language $platform]",
    async (env) => {
      const late = await openScreen(
        load,
        options({ state: "late", job: FOOD_COURIER }, env)
      )
      try {
        expect(JSON.stringify(late.tree())).not.toContain("Laila's Kitchen")
      } finally {
        late.unmount()
      }
      const done = await openScreen(
        load,
        options({ state: "done", job: FOOD_DELIVERED }, env)
      )
      try {
        await done.act(() => {
          pressContaining(done.root, "Laila's Kitchen")
        })
        const last = done.navigation.actions.at(-1) as {
          payload: { name: string; params: object }
        }
        expect(last.payload.name).toBe("ReviewFormScreen")
        expect(last.payload.params).toEqual({
          jobId: JOB.id,
          proId: 1003,
        })
      } finally {
        done.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "the X goes back [$language $platform]",
    async (env) => {
      const session = await openScreen(load, options({ state: "x" }, env))
      try {
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:close" })
        })
        expect(session.navigation.actions.map((action) => action.type)).toEqual(
          ["GO_BACK"]
        )
      } finally {
        session.unmount()
      }
    }
  )
})
