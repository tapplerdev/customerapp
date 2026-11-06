import { describe, expect, it } from "@jest/globals"

import { copy, openScreen, pressTitled } from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { PARITY_MATRIX, type ParityEnv } from "testing/hostTreeParity"

/*
 * POST /jobs refuses a request that no longer fits (mode-mismatch PR 2):
 * JOB_PROS_NOT_SERVING when a selected pro no longer serves it,
 * JOB_PLACE_OF_SERVICE_NOT_OFFERED when the category dropped the place
 * chosen. The summary says so in the app's words, and OK takes the customer
 * back to the list, which is told to fetch again (and, for the place, to
 * clear it): ProsListingScreen.refusal.parity.tsx has that half.
 */
const NAME = "RequestSummaryScreen"
const load = () => require("../RequestSummaryScreen")
const PARAMS = ROUTE_PARAMS.RequestSummaryScreen as Record<string, unknown>

const refusing = (code: string, message: string) => ({
  error: { status: 400, data: { statusCode: 400, code, message } },
})

const open = (env: ParityEnv, createJob: unknown) =>
  openScreen(load, {
    ...screenState("data"),
    api: { ...DATA, createJob: createJob as never },
    lang: env.language,
    platform: env.platform,
    route: { name: NAME, params: PARAMS },
  })

type Session = Awaited<ReturnType<typeof open>>

const sendAndAcknowledge = async (session: Session, env: ParityEnv) => {
  await session.act(() => {
    pressTitled(session.root, copy(env, "send_request"))
  })
  const shown = JSON.stringify(session.tree())
  await session.act(() => {
    pressTitled(session.root, copy(env, "OK"))
  })
  await session.settle(1000)
  return shown
}

const listen = () => {
  const { questionFlowEventBus } = require("events/questionFlowEventBus")
  const heard: unknown[] = []
  questionFlowEventBus.on("request:refused", (event: unknown) =>
    heard.push(event)
  )
  return heard
}

describe("RequestSummaryScreen: a refused request", () => {
  it.each(PARITY_MATRIX)(
    "a pro who no longer serves it: the app's line, then back to the list to refetch [$language $platform]",
    async (env) => {
      const session = await open(
        env,
        refusing(
          "JOB_PROS_NOT_SERVING",
          "This pro no longer matches your selection."
        )
      )
      try {
        const heard = listen()
        const shown = await sendAndAcknowledge(session, env)
        expect(shown).toContain(copy(env, "request_pros_not_serving"))
        expect(shown).not.toContain("This pro no longer matches")
        expect(heard).toEqual([{ clearPlaceOfService: false }])
        expect(session.navigation.actions.at(-1)).toMatchObject({
          type: "POP_TO",
          payload: {
            name: "ProsListingScreen",
            params: expect.objectContaining({
              categoryId: PARAMS.categoryId,
              placeOfService: PARAMS.placeOfService,
            }),
          },
        })
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "a place the category dropped: the app's line, then back to the list without it [$language $platform]",
    async (env) => {
      const session = await open(
        env,
        refusing(
          "JOB_PLACE_OF_SERVICE_NOT_OFFERED",
          "This service is no longer offered this way. Please choose again."
        )
      )
      try {
        const heard = listen()
        const shown = await sendAndAcknowledge(session, env)
        expect(shown).toContain(copy(env, "request_place_not_offered"))
        expect(heard).toEqual([{ clearPlaceOfService: true }])
        const last = session.navigation.actions.at(-1) as {
          type: string
          payload: { name: string; params: Record<string, unknown> }
        }
        expect(last.type).toBe("POP_TO")
        expect(last.payload.name).toBe("ProsListingScreen")
        expect(last.payload.params.placeOfService).toBeUndefined()
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "any other refusal keeps the server's message and stays [$language $platform]",
    async (env) => {
      const session = await open(env, {
        error: {
          status: 400,
          data: { code: "VALIDATION_FAILED", message: "Pick a date type" },
        },
      })
      try {
        const heard = listen()
        const shown = await sendAndAcknowledge(session, env)
        expect(shown).toContain("Pick a date type")
        expect(heard).toEqual([])
        expect(session.navigation.actions).toEqual([])
      } finally {
        session.unmount()
      }
    }
  )
})
