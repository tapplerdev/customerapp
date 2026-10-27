/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import { copy, openScreen, rowsByPlatform, treeAfter } from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"
import type { JobType } from "types/job"

import { TALABATI_FOOD_JOBS } from "../../__fixtures__/jobStates"

/*
 * TalabatiScreen's food orders: the status line each way an order can end, and
 * who is offered "Leave review". The list says what the order screen says
 * about the same order (both ask utils/foodOrderState): cancelled when the
 * customer, the restaurant or moderation did it, expired when the restaurant
 * never answered, closed when the clock ended an accepted order. A review is
 * offered for a delivered order only: it used to show from Accepted on, and on
 * a cancelled order.
 */

const load = () => require("../TalabatiScreen")
const NAME = "TalabatiScreen"

type Case = { state: string; jobs: JobType[] }

const CASES: Case[] = [
  { state: "food orders, delivered to cancelled", jobs: TALABATI_FOOD_JOBS },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

const options = (entry: Case, env: ParityEnv) => ({
  ...screenState("data"),
  api: {
    ...DATA,
    getCustomerJobs: {
      data: {
        data: entry.jobs,
        page: 1,
        perPage: 20,
        total: entry.jobs.length,
      },
    },
  },
  lang: env.language,
  platform: env.platform,
  route: { name: NAME },
})

describe("TalabatiScreen's food orders, captured from the code as it is", () => {
  it.each(rows)("$state [$env.language $env.platform]", async (entry) => {
    const tree = await treeAfter(load, options(entry, entry.env), entry.env)
    expectParity(parityName(entry.state, entry.env), tree)
  })
})

describe("TalabatiScreen's food orders: what the list says", () => {
  const words = (key: string, env: ParityEnv) => copy(env, key)

  it.each(PARITY_MATRIX)(
    "each way an order ends has its own status line [$language $platform]",
    async (env) => {
      const session = await openScreen(
        load,
        options({ state: "words", jobs: TALABATI_FOOD_JOBS }, env)
      )
      try {
        const text = JSON.stringify(session.tree())
        // a status line is a Text whose only child is the word
        const count = (word: string) => text.split(`["${word}"]`).length - 1
        expect(count(words("cancelled", env))).toBe(3)
        expect(count(words("expired", env))).toBe(1)
        expect(count(words("closed", env))).toBe(1)
        expect(count(words("completed", env))).toBe(1)
        expect(count(words("active", env))).toBe(2)
        // never the raw status
        expect(count("cancelledByTappler")).toBe(0)
        expect(count("cancelledByPro")).toBe(0)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "only the delivered order offers Leave review [$language $platform]",
    async (env) => {
      const session = await openScreen(
        load,
        options({ state: "review", jobs: TALABATI_FOOD_JOBS }, env)
      )
      try {
        const text = JSON.stringify(session.tree())
        expect(text.split(words("leave_review", env)).length - 1).toBe(1)
      } finally {
        session.unmount()
      }
    }
  )
})
