/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import {
  openScreen,
  pressIcon,
  renderScreen,
  rowsByPlatform,
} from "testing/screenKit"
import { guestState, screenState } from "testing/screenKit/states"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * TapplyAIScreen (the assistant's greeting and its search field),
 * captured from the unconverted code: its one state, with the field's
 * bottom padding (the bottom inset + 16) at the platform's own inset, none
 * and a home indicator past it; and the back chevron.
 */

const load = () => require("../TapplyAIScreen")

const INSETS = [undefined, { bottom: 0 }, { bottom: 48 }] as const
const CASES = INSETS.map((insets) => ({
  state: insets ? `bottom inset ${insets.bottom}` : "the platform's own inset",
  insets,
}))
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("TapplyAIScreen, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async ({ state, insets, env }) => {
    const tree = await renderScreen(load, {
      ...screenState("data"),
      lang: env.language,
      platform: env.platform,
      insets,
    })
    expectParity(parityName(state, env), tree)
  })

  it.each(
    rowsByPlatform([{ state: "guest" }], PARITY_MATRIX)
  )("$state [$env.language $env.platform] draws what a signed-in customer's does", async ({ env }) => {
    const options = { lang: env.language, platform: env.platform } as const
    const guest = await renderScreen(load, { ...guestState("data"), ...options })
    const signed = await renderScreen(load, { ...screenState("data"), ...options })
    expect(guest).toEqual(signed)
  })
})

describe.each(PARITY_MATRIX)("TapplyAIScreen presses [$language $platform]", (env: ParityEnv) => {
  it("the back chevron goes back", async () => {
    const session = await openScreen(load, {
      ...screenState("data"),
      lang: env.language,
      platform: env.platform,
    })
    try {
      await session.act(() => {
        pressIcon(session.root, { icon: "svg:chevron-left" })
      })
      expect(session.navigation.actions.map((action) => action.type)).toEqual(["GO_BACK"])
    } finally {
      session.unmount()
    }
  })
})
