/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressText,
  rowsByPlatform,
  treeAfter,
  type RenderScreenOptions,
  type Step,
} from "testing/screenKit"
import { freshInstallState } from "testing/screenKit/states"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * GuestLocationScreen (where the guest is), captured from the unconverted
 * code: as it opens, and with Enable your location pressed while the device
 * has no fix yet (the button's spinner; the shadow is the platform's own).
 * Then the presses: a fix stores the guest's coordinates and leaves for Home,
 * a refusal stays put, Choose your location opens the picker, and a second
 * press on Enable while it looks does nothing. (The address the picker hands
 * back arrives on an event bus and leaves on the next focus, which the kit's
 * one-route stack never raises: PickAddressScreen's own rows cover the pick.)
 */

const load = () => require("../GuestLocationScreen")

const enable: Step = (root, env) => pressText(root, copy(env, "enable_your_location"))

type Case = { state: string; steps?: Step[] }
const CASES: Case[] = [
  { state: "as it opens" },
  { state: "looking for a fix (the spinner)", steps: [enable] },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("GuestLocationScreen, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async ({ state, steps, env }) => {
    const tree = await treeAfter(
      load,
      { ...freshInstallState(), lang: env.language, platform: env.platform, route: { name: "GuestLocationScreen" } },
      env,
      steps
    )
    expectParity(parityName(state, env), tree)
  })
})

describe.each(PARITY_MATRIX)("GuestLocationScreen presses [$language $platform]", (env: ParityEnv) => {
  const open = (options: Partial<RenderScreenOptions> = {}) =>
    openScreen(load, {
      ...freshInstallState(),
      lang: env.language,
      platform: env.platform,
      route: { name: "GuestLocationScreen" },
      ...options,
    })
  type Session = Awaited<ReturnType<typeof open>>
  const act = (session: Session, press: () => void) => session.act(() => { press() })
  const navigated = (session: Session) =>
    session.navigation.actions.map((action) => ({ type: action.type, ...(action.payload as object) }))

  it("a fix is stored as the guest's place, and the screen leaves for Home", async () => {
    const session = await open({ location: { latitude: 30.05, longitude: 31.23 } })
    try {
      await act(session, () => enable(session.root, env))
      await session.settle(1000)
      expect(session.store.getState().auth.guestLocation).toEqual({
        coords: { lat: 30.05, lng: 31.23 },
        address: null,
      })
      expect(navigated(session)).toEqual([
        expect.objectContaining({ type: "RESET", index: 0, routes: [{ name: "HomeTabs" }] }),
      ])
    } finally {
      session.unmount()
    }
  })

  it("a refused fix stores nothing and stays", async () => {
    const session = await open({ location: { error: { code: 1, message: "denied" } } })
    try {
      await act(session, () => enable(session.root, env))
      await session.settle(1000)
      expect(session.store.getState().auth.guestLocation).toEqual({ coords: null, address: null })
      expect(navigated(session)).toEqual([])
    } finally {
      session.unmount()
    }
  })

  it("Choose your location opens the picker", async () => {
    const session = await open()
    try {
      await act(session, () => pressText(session.root, copy(env, "choose_your_location")))
      expect(navigated(session)).toEqual([expect.objectContaining({ name: "PickAddressScreen" })])
    } finally {
      session.unmount()
    }
  })

  it("while it looks for a fix a second press on Enable does nothing", async () => {
    const session = await open()
    try {
      await act(session, () => enable(session.root, env))
      await session.settle(500)
      expect(JSON.stringify(session.tree())).not.toContain(copy(env, "enable_your_location"))
      expect(navigated(session)).toEqual([])
    } finally {
      session.unmount()
    }
  })
})
