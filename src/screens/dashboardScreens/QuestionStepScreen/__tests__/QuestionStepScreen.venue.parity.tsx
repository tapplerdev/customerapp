import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
  wait,
  type RenderScreenOptions,
  type Step,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { pressContaining } from "testing/pressContaining"
import { PARITY_MATRIX, type ParityEnv } from "testing/hostTreeParity"

import { QUESTIONS_RICH } from "../../ProsListingScreen/__fixtures__/discover"

/*
 * The venue step (venue-on-job): a request at a fixed location is asked
 * which of the category's venues, so the job records it and the pro's Job
 * Details shows that venue's pin. Airport Pickup's shape: fixedLocations is
 * the only place, with three airports here. The step comes first when the
 * place is the category's only one, right after the place when the customer
 * picks a fixed location, and not at all for another place or a single
 * venue. Done hands the venue over with the place.
 */

const CAIRO = {
  id: 72,
  nameEn: "Cairo International Airport",
  nameAr: "مطار القاهرة الدولي",
}
const SPHINX = {
  id: 74,
  nameEn: "Sphinx International Airport",
  nameAr: "مطار سفنكس الدولي",
}
const ALEX = {
  id: 75,
  nameEn: "Alexandria International Airport",
  nameAr: "مطار الإسكندرية الدولي",
}

const load = () => {
  const React = require("react") as typeof import("react")
  const { QuestionFlowSheet } = require("../QuestionStepScreen")
  const Harness = (props: Record<string, unknown>) =>
    React.createElement(QuestionFlowSheet, {
      visible: true,
      contentKey: 1,
      onClose: () => undefined,
      categoryName: "Airport Pickup",
      placeOfServiceOptions: ["fixedLocations"],
      fixedLocations: [SPHINX, CAIRO, ALEX],
      customerQuestions: QUESTIONS_RICH.slice(0, 1),
      ...props,
    })
  return { default: Harness }
}

const words = (env: ParityEnv, en: string, ar: string) =>
  env.language === "ar" ? ar : en
const pick =
  (venue: { nameEn: string; nameAr: string }): Step =>
  (root, env) =>
    pressContaining(root, words(env, venue.nameEn, venue.nameAr))
const next =
  (nth: number): Step =>
  (root, env) =>
    pressText(root, copy(env, "next"), { nth })
const place =
  (key: string): Step =>
  (root, env) =>
    pressContaining(root, copy(env, key))

const listen = () => {
  const { questionFlowEventBus } = require("events/questionFlowEventBus")
  const heard: { placeOfService?: string; fixedLocationId?: number }[] = []
  questionFlowEventBus.on("questions:done", (event: never) => heard.push(event))
  return heard
}

describe.each(PARITY_MATRIX)(
  "QuestionFlowSheet, the venue step [$language $platform]",
  (env: ParityEnv) => {
    const open = (props: Record<string, unknown> = {}) =>
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
        await session.act(() => step(session.root, env), step.settleMs)
      }
    }
    // The X on the top card (each visited card stays mounted with its own),
    // which commits what was picked, as Done does.
    const close = (session: Session, nth = 0) =>
      session.act(() => {
        pressIcon(session.root, { icon: "svg:close", nth })
      })

    it("comes first for a category whose only place is a fixed location, listing its venues by name", async () => {
      const session = await open()
      try {
        const shown = JSON.stringify(session.tree())
        expect(shown).toContain(copy(env, "where_do_you_need_service"))
        const at = (venue: typeof CAIRO) =>
          shown.indexOf(words(env, venue.nameEn, venue.nameAr))
        // Alexandria, Cairo, Sphinx in either language.
        expect(at(ALEX)).toBeGreaterThan(-1)
        expect(at(ALEX)).toBeLessThan(at(CAIRO))
        expect(at(CAIRO)).toBeLessThan(at(SPHINX))
        expect(shown).not.toContain(copy(env, "how_do_you_want_service"))
      } finally {
        session.unmount()
      }
    })

    it("Next is refused until a venue is picked; Done hands it over", async () => {
      const session = await open()
      const heard = listen()
      try {
        await expect(run(session, [next(0)])).rejects.toThrow(/disabled/)
        await run(session, [pick(SPHINX), next(0), wait(600)])
        await close(session, 1)
        expect(heard).toEqual([
          expect.objectContaining({ fixedLocationId: SPHINX.id }),
        ])
      } finally {
        session.unmount()
      }
    })

    it("a repost opens with the old venue picked", async () => {
      const session = await open({ initialFixedLocationId: CAIRO.id })
      const heard = listen()
      try {
        await run(session, [next(0), wait(600)])
        await close(session, 1)
        expect(heard).toEqual([
          expect.objectContaining({ fixedLocationId: CAIRO.id }),
        ])
      } finally {
        session.unmount()
      }
    })

    it("a venue the category no longer lists is not handed over", async () => {
      const session = await open({ initialFixedLocationId: 73 })
      const heard = listen()
      try {
        await close(session)
        expect(heard).toEqual([
          expect.objectContaining({ fixedLocationId: undefined }),
        ])
      } finally {
        session.unmount()
      }
    })

    it("with several places, it follows the place only when a fixed location is picked", async () => {
      const session = await open({
        placeOfServiceOptions: ["proToCustomer", "fixedLocations"],
      })
      const heard = listen()
      try {
        await run(session, [place("at_fixed_location"), next(0), wait(600)])
        expect(JSON.stringify(session.tree())).toContain(
          copy(env, "where_do_you_need_service")
        )
        await run(session, [pick(CAIRO), next(1), wait(600)])
        await close(session, 2)
        expect(heard.at(-1)).toEqual(
          expect.objectContaining({
            placeOfService: "fixedLocations",
            fixedLocationId: CAIRO.id,
          })
        )
      } finally {
        session.unmount()
      }
    })

    it("another place has no venue step and hands no venue over", async () => {
      const session = await open({
        placeOfServiceOptions: ["proToCustomer", "fixedLocations"],
        initialFixedLocationId: CAIRO.id,
      })
      const heard = listen()
      try {
        await run(session, [place("at_my_location"), next(0), wait(600)])
        expect(JSON.stringify(session.tree())).not.toContain(
          copy(env, "where_do_you_need_service")
        )
        await close(session, 1)
        expect(heard.at(-1)).toEqual(
          expect.objectContaining({
            placeOfService: "proToCustomer",
            fixedLocationId: undefined,
          })
        )
      } finally {
        session.unmount()
      }
    })

    it("a single venue is picked without asking", async () => {
      const session = await open({ fixedLocations: [CAIRO] })
      const heard = listen()
      try {
        expect(JSON.stringify(session.tree())).not.toContain(
          copy(env, "where_do_you_need_service")
        )
        await close(session)
        expect(heard).toEqual([
          expect.objectContaining({ fixedLocationId: CAIRO.id }),
        ])
      } finally {
        session.unmount()
      }
    })
  }
)
