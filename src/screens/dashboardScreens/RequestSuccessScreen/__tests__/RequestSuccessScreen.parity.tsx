/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressTitled,
  rowsByPlatform,
  treeAfter,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { ADDRESS, ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * RequestSuccessScreen: the check-mark animation, the two lines and Done.
 * It draws one thing in every state (signed in, a guest, an address already
 * saved or not, none at all): the rows below prove that rather than assume
 * it, and each takes its own inset (the screen is a SafeAreaView, all edges).
 * The Lottie animation is a host here with its source and style.
 */

const load = () => require("../RequestSuccessScreen")
const NAME = "RequestSuccessScreen"

// Done is an ActionBtn before the conversion and a ds Button after it.
const BUTTON: ParityAllowance[] = []

type Case = {
  state: string
  params?: object
  insets?: { top?: number; bottom?: number }
}

// A street the account has not saved (ADDRESS is its Home, to the metre).
const NEW_ADDRESS = {
  ...ADDRESS,
  address: "9 Gameat El Dowal Street, Mohandessin",
  city: "Mohandessin",
  coords: { lat: 30.0561, lon: 31.2005 },
}

// Signed in or not, an address saved or not, or none at all, it draws the same
// tree (the four states were captured and shared one), so the rows are the
// screen as it is and the two insets its SafeAreaView reads.
const CASES: Case[] = [
  { state: "shown" },
  { state: "no insets", insets: { top: 0, bottom: 0 } },
  { state: "a tall bottom inset", insets: { bottom: 48 } },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

const options = (entry: Case, env: ParityEnv) => ({
  ...screenState("data"),
  lang: env.language,
  platform: env.platform,
  ...(entry.insets ? { insets: entry.insets } : {}),
  route: {
    name: NAME,
    params: entry.params ?? ROUTE_PARAMS.RequestSuccessScreen,
  },
})

describe("RequestSuccessScreen, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async (entry) => {
    const tree = await treeAfter(load, options(entry, entry.env), entry.env)
    expectParity(parityName(entry.state, entry.env), tree, { allow: BUTTON })
  })
})

describe("RequestSuccessScreen: Done", () => {
  it.each(PARITY_MATRIX)(
    "leaves for Talabati once [$language $platform]",
    async (env) => {
      const session = await openScreen(load, options({ state: "done" }, env))
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "done"))
        })
        // The reset names Talabati's tab; a second press does nothing.
        await session.act(() => {
          pressTitled(session.root, copy(env, "done"))
        })
        const resets = session.navigation.actions.filter(
          (action) => action.type === "RESET"
        )
        expect(resets).toHaveLength(1)
        expect(JSON.stringify(resets[0])).toContain("talabati")
      } finally {
        session.unmount()
      }
    }
  )

  it("an address with no saved id offers the save sheet after three seconds, and Done cancels it", async () => {
    const env: ParityEnv = { language: "en", platform: "ios" }
    const fresh = { address: NEW_ADDRESS }
    const waiting = await openScreen(
      load,
      options({ state: "waiting", params: fresh }, env)
    )
    try {
      await waiting.settle(3500)
      expect(
        JSON.stringify(waiting.navigation.actions.map((a) => a.type))
      ).toContain("NAVIGATE")
    } finally {
      waiting.unmount()
    }
    const cancelled = await openScreen(
      load,
      options({ state: "cancelled", params: fresh }, env)
    )
    try {
      await cancelled.act(() => {
        pressTitled(cancelled.root, copy(env, "done"))
      })
      await cancelled.settle(3500)
      expect(
        cancelled.navigation.actions.filter((a) => a.type === "NAVIGATE")
      ).toHaveLength(0)
    } finally {
      cancelled.unmount()
    }
  })
})
