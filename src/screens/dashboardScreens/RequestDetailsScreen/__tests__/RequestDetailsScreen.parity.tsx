/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  openScreen,
  pressIcon,
  rowsByPlatform,
  treeAfter,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA, SERVER_ERROR } from "testing/screenKit/fixtures/api"
import { JOB, JOB_FOOD } from "testing/screenKit/fixtures/entities"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"
import type { JobType } from "types/job"

import {
  FOOD_ACCEPTED,
  FOOD_PICKUP,
  FOOD_SENT,
} from "../../__fixtures__/jobStates"

/*
 * RequestDetailsScreen: the record of a request, opened from JobDetail's
 * ••• menu. A service request (as soon as possible; a dated slot with every
 * kind of answer; undecided with no address and no pin) and a food order
 * (delivery with a note, options and a discount; free delivery; a pickup,
 * whose map outlines the pro's district, with and without that district
 * resolving), each behind the loading overlay it opens on.
 */

const load = () => require("../RequestDetailsScreen")
const NAME = "RequestDetailsScreen"

const ANSWERED: JobType["questionsAnswers"] = [
  { questionId: 701, answer: "A leaking tap under the sink." },
  { questionId: 702, optionId: 7011 },
  { questionId: 703, date: "2026-10-25" },
  { questionId: 704, startTime: "09:00", endTime: "12:00" },
  { questionId: 705, files: ["a.jpg", "b.jpg"] },
  { questionId: 706 },
]

const SERVICE_DATED: JobType = {
  ...JOB,
  dateType: "date",
  dates: [{ id: 1, date: "2026-10-24T00:00:00.000Z" }],
  timeSlots: [{ id: 1, start: "09:00:00", end: "12:00:00" }],
  orderNotes: "Please bring a spare washer.",
  questionsAnswers: ANSWERED,
}

const SERVICE_DATE_ONLY: JobType = {
  ...JOB,
  dateType: "date",
  dates: [{ id: 1, date: "2026-10-24T00:00:00.000Z" }],
  timeSlots: [],
}

const SERVICE_UNDECIDED: JobType = {
  ...JOB,
  dateType: "notDecided",
  address: undefined,
  serviceCategory: undefined,
  questionsAnswers: [],
}

const SERVICE_NO_PIN: JobType = {
  ...JOB,
  address: { address: { city: "Dokki", governorate: "Giza" } },
}

const FOOD_FREE: JobType = { ...FOOD_SENT, deliveryFee: 0, orderDiscount: 0 }
const FOOD_PICKUP_SENT: JobType = {
  ...FOOD_PICKUP,
  dateType: "asap",
  dates: [],
}

type Case = {
  state: string
  job?: JobType | "loading"
  api?: Record<string, unknown>
}

const CASES: Case[] = [
  { state: "loading", job: "loading" },
  { state: "service, as soon as possible" },
  { state: "service, a dated slot with every answer", job: SERVICE_DATED },
  { state: "service, a date and no slot", job: SERVICE_DATE_ONLY },
  { state: "service, undecided, no address", job: SERVICE_UNDECIDED },
  { state: "service, an address with no street or pin", job: SERVICE_NO_PIN },
  { state: "food delivery, a note, options, a discount", job: FOOD_ACCEPTED },
  { state: "food delivery, as soon as possible, a fee", job: JOB_FOOD },
  { state: "food delivery, free", job: FOOD_FREE },
  { state: "food pickup, a slot", job: FOOD_PICKUP },
  { state: "food pickup, as soon as possible", job: FOOD_PICKUP_SENT },
  {
    state: "food pickup, the pro's profile failed",
    job: FOOD_PICKUP,
    api: { getProProfile: SERVER_ERROR },
  },
]

const options = (entry: Case, env: ParityEnv) => ({
  ...screenState("data"),
  api: {
    ...DATA,
    getCustomerJobDetails:
      entry.job === "loading"
        ? ("loading" as const)
        : { data: entry.job ?? JOB },
    ...entry.api,
  },
  lang: env.language,
  platform: env.platform,
  route: { name: NAME, params: { jobId: JOB.id } },
})

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("RequestDetailsScreen, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async (entry) => {
    const tree = await treeAfter(load, options(entry, entry.env), entry.env)
    expectParity(parityName(entry.state, entry.env), tree)
  })
})

describe("RequestDetailsScreen: the X", () => {
  it.each(PARITY_MATRIX)("goes back [$language $platform]", async (env) => {
    const session = await openScreen(load, options({ state: "x" }, env))
    try {
      await session.act(() => {
        pressIcon(session.root, { icon: "svg:close" })
      })
      expect(session.navigation.actions.map((action) => action.type)).toEqual([
        "GO_BACK",
      ])
    } finally {
      session.unmount()
    }
  })
})
