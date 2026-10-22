/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressText,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  type Step,
} from "testing/screenKit"
import { guestState, screenState } from "testing/screenKit/states"
import { CUSTOMER, signedIn } from "testing/screenKit/fixtures/users"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * Account: the signed-in menu, the guest's sign-in card and menu, and the
 * logout confirmation (open, and with Yes pressed: both buttons dead). The
 * language picker's two checkboxes live in AccountScreen.language.parity.tsx
 * (their labels name TheSans-Regular, which isn't shipped: the one drawing
 * W2 changes on purpose, in its own commit, so its rows have a fixture of
 * their own). Every handler with an effect is pressed in the second block.
 */

const load = () => require("../AccountScreen")

const NO_NAME = {
  state: { auth: signedIn({ ...CUSTOMER, firstName: "" }) },
  api: screenState("data").api,
}

const STATES = {
  "signed in": screenState("data"),
  "signed in, no first name": NO_NAME,
  guest: guestState("data"),
}
type StateName = keyof typeof STATES

const options = (name: StateName, env: ParityEnv) => ({
  ...STATES[name],
  lang: env.language,
  platform: env.platform ?? "ios",
  route: { name: "AccountScreen" },
})

const openLogout: Step = (root, env) => pressText(root, copy(env, "logout"))
const pressYes: Step = Object.assign(
  (root: Parameters<Step>[0], env: ParityEnv) =>
    pressTitled(root, copy(env, "yes")),
  // The sign-out itself starts 300 ms after Yes (a network round trip).
  { settleMs: 50 }
)

const CASES: { state: StateName; label: string; steps?: Step[] }[] = [
  { state: "signed in", label: "signed in" },
  { state: "signed in, no first name", label: "signed in, no first name" },
  { state: "guest", label: "guest" },
  { state: "signed in", label: "logout asked", steps: [openLogout] },
  {
    state: "signed in",
    label: "logout confirmed, both buttons dead",
    steps: [openLogout, pressYes],
  },
]

describe("AccountScreen", () => {
  it.each(rowsByPlatform(CASES, PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ state, label, steps, env }) => {
      expectParity(
        parityName(label, env),
        await treeAfter(load, options(state, env), env, steps)
      )
    }
  )
})

const MENU: { who: StateName; key: string; route: string; accessory?: string }[] = [
  { who: "signed in", key: "account_details", route: "AccountDetailsScreen" },
  { who: "signed in", key: "my_saved_addresses", route: "MySavedAddressesScreen" },
  { who: "signed in", key: "about_app", route: "AboutAppScreen" },
  { who: "guest", key: "about_app", route: "AboutAppScreen" },
]

describe("AccountScreen presses", () => {
  it.each(rowsByPlatform(MENU, PARITY_MATRIX))(
    "$who: $key opens $route [$env.language $env.platform]",
    async ({ who, key, route, env }) => {
      const session = await openScreen(load, options(who, env))
      try {
        await session.act(() => {
          pressText(session.root, copy(env, key))
        })
        expect(session.navigation.actions).toEqual([
          expect.objectContaining({
            type: "NAVIGATE",
            payload: expect.objectContaining({ name: route }),
          }),
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(
    rowsByPlatform(
      [
        { key: "create_account", route: "RegisterScreen" },
        { key: "log_In", route: "AuthWelcomeScreen" },
      ],
      PARITY_MATRIX
    )
  )(
    "the guest's $key button opens $route [$env.language $env.platform]",
    async ({ key, route, env }) => {
      const session = await openScreen(load, options("guest", env))
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, key))
        })
        expect(session.navigation.actions).toEqual([
          expect.objectContaining({
            type: "NAVIGATE",
            payload: expect.objectContaining({ name: route }),
          }),
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(rowsByPlatform([{}], PARITY_MATRIX))(
    "Yes on the logout card starts the sign-out; No does not [$env.language $env.platform]",
    async ({ env }) => {
      const asked = await treeAfter(load, options("signed in", env), env, [
        openLogout,
      ])
      const yes = await treeAfter(load, options("signed in", env), env, [
        openLogout,
        pressYes,
      ])
      const no = await treeAfter(load, options("signed in", env), env, [
        openLogout,
        (root, e) => pressTitled(root, copy(e, "no")),
      ])
      // Yes spins both buttons dead; No leaves the sign-out unstarted (on iOS
      // the card still draws after No, as asked does: LogoutModal's own press
      // rows prove No closes it).
      expect(JSON.stringify(yes)).not.toBe(JSON.stringify(asked))
      expect(JSON.stringify(no)).not.toBe(JSON.stringify(yes))
    }
  )
})
