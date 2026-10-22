/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  type RenderScreenOptions,
  type Step,
} from "testing/screenKit"
import { freshInstallState } from "testing/screenKit/states"
import { GUEST_LOCATION } from "testing/screenKit/fixtures/users"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * AuthWelcomeScreen (sign in or continue as a guest), captured from the
 * unconverted code: a fresh install (email, Facebook, Google and guest),
 * someone who already picked a location (the back chevron and the create
 * account button, which has two lines; coordinates alone draw the same), and the
 * screen after the language toggle is pressed (the loading overlay). Its five
 * white buttons with icons are ActionBtns before and Buttons after, so every
 * row but the loading one allows Button's two listed deltas. Then the
 * presses: each button once, the toggle (it stores the other language and
 * where to come back to) and the back chevron.
 */

const load = () => require("../AuthWelcomeScreen")

const FRESH = freshInstallState()
const PICKED = {
  ...FRESH,
  state: { auth: { ...FRESH.state.auth, hasPickedLanguage: true, guestLocation: GUEST_LOCATION } },
}
// Button's own listed deltas on its root: ActionBtn before, Button after.
const ALLOW: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const toggle: Step = (root, env) => pressText(root, env.language === "ar" ? "English" : "عربي")

type Case = {
  state: string
  options: Omit<RenderScreenOptions, "lang" | "platform">
  steps?: Step[]
  allow?: ParityAllowance[]
}

const CASES: Case[] = [
  { state: "a fresh install", options: FRESH, allow: ALLOW },
  { state: "a location picked (the back chevron, create account)", options: PICKED, allow: ALLOW },
  { state: "the language toggled: the loading overlay", options: FRESH, steps: [toggle] },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("AuthWelcomeScreen, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async ({ state, options, steps, allow, env }) => {
    const tree = await treeAfter(
      load,
      { ...options, lang: env.language, platform: env.platform, route: { name: "AuthWelcomeScreen" } },
      env,
      steps
    )
    expectParity(parityName(state, env), tree, allow ? { allow } : undefined)
  })
})

describe.each(PARITY_MATRIX)("AuthWelcomeScreen presses [$language $platform]", (env: ParityEnv) => {
  const open = (options: object) =>
    openScreen(load, {
      ...options,
      lang: env.language,
      platform: env.platform,
      route: { name: "AuthWelcomeScreen" },
    } as RenderScreenOptions)
  type Session = Awaited<ReturnType<typeof open>>
  const act = (session: Session, press: () => void) => session.act(() => { press() })
  const navigated = (session: Session) =>
    session.navigation.actions.map((action) => ({ type: action.type, ...(action.payload as object) }))

  it("email and guest go to their screens; Facebook and Google go nowhere", async () => {
    const session = await open(FRESH)
    try {
      await act(session, () => pressTitled(session.root, copy(env, "sign_in_with_email")))
      await act(session, () => pressTitled(session.root, copy(env, "sign_in_with_facebook")))
      await act(session, () => pressTitled(session.root, copy(env, "sign_in_with_google")))
      expect(navigated(session)).toEqual([expect.objectContaining({ name: "SignInEmailScreen" })])
      await act(session, () => pressTitled(session.root, copy(env, "continue_as_guest")))
      expect(navigated(session)).toEqual([
        expect.objectContaining({ name: "SignInEmailScreen" }),
        expect.objectContaining({ name: "GuestLocationScreen" }),
      ])
    } finally {
      session.unmount()
    }
  })

  it("create an account goes to the sign-up; the chevron leaves for Home", async () => {
    const session = await open(PICKED)
    try {
      await act(session, () => pressTitled(session.root, copy(env, "dont_have_an_account")))
      expect(navigated(session)).toEqual([expect.objectContaining({ name: "RegisterScreen" })])
      await act(session, () => pressIcon(session.root, { icon: "svg:chevron-left" }))
      expect(navigated(session)[1]).toEqual(
        expect.objectContaining({ type: "RESET", index: 0, routes: [{ name: "HomeTabs" }] })
      )
    } finally {
      session.unmount()
    }
  })

  it("the toggle stores the other language and where to come back to", async () => {
    const session = await open(FRESH)
    try {
      await act(session, () => toggle(session.root, env))
      expect(session.store.getState().auth.language).toBe(env.language === "ar" ? "en" : "ar")
      expect(session.store.getState().auth.currentScreen).toBe("auth-welcome")
    } finally {
      session.unmount()
    }
  })
})
