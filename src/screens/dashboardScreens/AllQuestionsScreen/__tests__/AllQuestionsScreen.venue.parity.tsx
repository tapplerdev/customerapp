import { describe, expect, it, jest } from "@jest/globals"

import {
  copy,
  openScreen,
  pressTitled,
  type RenderScreenOptions,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { pressContaining } from "testing/pressContaining"
import { PARITY_MATRIX, type ParityEnv } from "testing/hostTreeParity"

import { QUESTIONS_RICH } from "../../ProsListingScreen/__fixtures__/discover"

/*
 * The job-details editor at a fixed location (venue-on-job): the venues are
 * listed under the place while the request is at a fixed location, a pick
 * goes out with See matches, Reset all clears it, and another place drops it.
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

const load = () => {
  const React = require("react") as typeof import("react")
  const { AllQuestionsSheet } = require("../AllQuestionsScreen")
  const Harness = (props: Record<string, unknown>) =>
    React.createElement(AllQuestionsSheet, {
      visible: true,
      contentKey: 1,
      onClose: () => undefined,
      onApply: () => undefined,
      categoryName: "Airport Pickup",
      placeOfServiceOptions: ["fixedLocations"],
      fixedLocations: [CAIRO, SPHINX],
      customerQuestions: QUESTIONS_RICH.slice(0, 1),
      initialAnswers: [],
      ...props,
    })
  return { default: Harness }
}

describe.each(PARITY_MATRIX)(
  "AllQuestionsSheet, the venues [$language $platform]",
  (env: ParityEnv) => {
    const open = (props: Record<string, unknown> = {}) =>
      openScreen(load, {
        ...screenState("data"),
        lang: env.language,
        platform: env.platform,
        navigation: "none",
        props,
      } as RenderScreenOptions)
    const name = (venue: typeof CAIRO) =>
      env.language === "ar" ? venue.nameAr : venue.nameEn

    it("lists the venues and sends the one picked with See matches", async () => {
      const onApply = jest.fn()
      const session = await open({ onApply })
      try {
        const shown = JSON.stringify(session.tree())
        expect(shown).toContain(copy(env, "where_do_you_need_service"))
        expect(shown).toContain(name(CAIRO))
        await session.act(() => {
          pressContaining(session.root, name(SPHINX))
        })
        await session.act(() => {
          pressTitled(session.root, copy(env, "see_matches"))
        })
        expect(onApply).toHaveBeenLastCalledWith(
          expect.objectContaining({
            fixedLocationId: SPHINX.id,
            filtersChanged: true,
          })
        )
      } finally {
        session.unmount()
      }
    })

    it("Reset all clears the venue", async () => {
      const onApply = jest.fn()
      const session = await open({ onApply, initialFixedLocationId: CAIRO.id })
      try {
        await session.act(() => {
          pressContaining(session.root, copy(env, "reset_all"))
        })
        await session.act(() => {
          pressTitled(session.root, copy(env, "see_matches"))
        })
        expect(onApply).toHaveBeenLastCalledWith(
          expect.objectContaining({
            fixedLocationId: undefined,
            resetAll: true,
          })
        )
      } finally {
        session.unmount()
      }
    })

    it("another place hides the venues and sends none", async () => {
      const onApply = jest.fn()
      const session = await open({
        onApply,
        placeOfServiceOptions: ["proToCustomer", "fixedLocations"],
        initialPlaceOfService: "fixedLocations",
        initialFixedLocationId: CAIRO.id,
      })
      try {
        expect(JSON.stringify(session.tree())).toContain(name(CAIRO))
        await session.act(() => {
          pressContaining(session.root, copy(env, "at_my_location"))
        })
        expect(JSON.stringify(session.tree())).not.toContain(name(CAIRO))
        await session.act(() => {
          pressTitled(session.root, copy(env, "see_matches"))
        })
        expect(onApply).toHaveBeenLastCalledWith(
          expect.objectContaining({
            placeOfService: "proToCustomer",
            fixedLocationId: undefined,
          })
        )
      } finally {
        session.unmount()
      }
    })
  }
)
