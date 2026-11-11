import { describe, expect, it } from "@jest/globals"

import { openScreen } from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { CATEGORY, SERVICE } from "testing/screenKit/fixtures/entities"
import { copy, pressTitled } from "testing/screenKit"
import { PARITY_MATRIX, type ParityEnv } from "testing/hostTreeParity"

/*
 * The summary of a fixed-location request (venue-on-job). The job is at the
 * venue the customer picked, so the hero shows the venue's name, and POST
 * /jobs gets the venue with its place. A request without a venue sends no
 * venue key at all: a backend before the venue refuses an unknown field.
 */
const load = () => require("../RequestSummaryScreen")
const PARAMS = ROUTE_PARAMS.RequestSummaryScreen as Record<string, unknown>

const CAIRO = {
  id: 72,
  nameEn: "Cairo International Airport",
  nameAr: "مطار القاهرة الدولي",
  location: { type: "Point", coordinates: [31.4056, 30.1219] },
}
const AIRPORTS = {
  ...CATEGORY,
  placeOfService: ["fixedLocations"],
  fixedLocations: [CAIRO],
}

const open = (env: ParityEnv, params: Record<string, unknown>) =>
  openScreen(load, {
    ...screenState("data"),
    api: {
      ...DATA,
      getServiceById: { data: { ...SERVICE, categories: [AIRPORTS] } },
    },
    lang: env.language,
    platform: env.platform,
    route: { name: "RequestSummaryScreen", params: { ...PARAMS, ...params } },
  })

type Session = Awaited<ReturnType<typeof open>>

const sentBody = async (session: Session, env: ParityEnv) => {
  await session.act(() => {
    pressTitled(session.root, copy(env, "send_request"))
  })
  const [sent] = session
    .requests()
    .filter((request) => request.endpoint === "createJob")
  return (sent.args as { body: Record<string, unknown> }).body
}

describe("RequestSummaryScreen at a venue", () => {
  it.each(PARITY_MATRIX)(
    "shows the venue's name and sends the venue with its place [$language $platform]",
    async (env) => {
      const session = await open(env, {
        placeOfService: undefined,
        fixedLocationId: CAIRO.id,
      })
      try {
        expect(JSON.stringify(session.tree())).toContain(
          env.language === "ar" ? CAIRO.nameAr : CAIRO.nameEn
        )
        expect(await sentBody(session, env)).toMatchObject({
          placeOfService: "fixedLocations",
          fixedLocationId: CAIRO.id,
        })
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PARITY_MATRIX)(
    "without a venue sends no venue key, and the place as before [$language $platform]",
    async (env) => {
      const session = await open(env, {})
      try {
        const body = await sentBody(session, env)
        expect(body).not.toHaveProperty("fixedLocationId")
        expect(body.placeOfService).toBe(PARAMS.placeOfService)
      } finally {
        session.unmount()
      }
    }
  )
})
