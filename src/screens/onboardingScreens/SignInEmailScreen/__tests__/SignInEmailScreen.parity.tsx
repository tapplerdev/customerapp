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
  typeInto,
  type RenderScreenOptions,
  type Step,
} from "testing/screenKit"
import { guestState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * SignInEmailScreen (log in with an email), captured from the unconverted
 * code: as it opens, both fields filled (the filled field's own face), the
 * password shown, the request on its way (the button's spinner) and each
 * card a failed log-in opens (a wrong password, an email nobody registered,
 * any other refusal). The Log In button is an ActionBtn
 * before and a Button after: Button's two listed deltas on every row. Then
 * the presses: Log In stores the tokens and leaves for Home (or goes back to
 * the job flow it came from), an empty form sends nothing, the back chevron,
 * Forgot password (it does nothing yet) and the sign-up link.
 */

const load = () => require("../SignInEmailScreen")

const ALLOW: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const fill: Step[] = [
  (root) => typeInto(root, 0, "Mona.Adel@Example.com"),
  (root) => typeInto(root, 1, "secret-1"),
]
const login: Step = (root, env) => pressTitled(root, copy(env, "log_In"))
const refused = (message: unknown) => ({
  auth: { error: { status: 400, data: message } },
})
const ANSWER = { data: { token: "t-1", refreshToken: "r-1" } }

type Case = {
  state: string
  api?: object
  steps?: Step[]
}

const CASES: Case[] = [
  { state: "as it opens" },
  { state: "both fields filled", steps: fill },
  { state: "the password shown", steps: [...fill, (root) => pressIcon(root, { icon: "svg:hide-password" })] },
  { state: "the request on its way", api: { auth: "loading" }, steps: [...fill, login] },
  { state: "a wrong password", api: refused({ validationErrors: { password: ["Password does not match"] } }), steps: [...fill, login] },
  { state: "an email nobody registered", api: refused({ validationErrors: { email: ["This email is not registered"] } }), steps: [...fill, login] },
  // (A refusal with no reasons draws the same card.)
  { state: "any other refusal", api: refused({ validationErrors: { email: ["must be an email"] } }), steps: [...fill, login] },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("SignInEmailScreen, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async ({ state, api, steps, env }) => {
    const tree = await treeAfter(
      load,
      {
        ...guestState("data"),
        api: { ...DATA, ...api },
        lang: env.language,
        platform: env.platform,
        route: { name: "SignInEmailScreen" },
      },
      env,
      steps
    )
    expectParity(parityName(state, env), tree, { allow: ALLOW })
  })
})

describe.each(PARITY_MATRIX)("SignInEmailScreen presses [$language $platform]", (env: ParityEnv) => {
  const open = (options: Partial<RenderScreenOptions> = {}) =>
    openScreen(load, {
      ...guestState("data"),
      api: { ...DATA, auth: ANSWER },
      lang: env.language,
      platform: env.platform,
      route: { name: "SignInEmailScreen" },
      ...options,
    })
  type Session = Awaited<ReturnType<typeof open>>
  const act = (session: Session, press: () => void) => session.act(() => { press() })
  const run = async (session: Session, steps: Step[]) => {
    for (const step of steps) {
      // eslint-disable-next-line no-await-in-loop
      await session.act(() => step(session.root, env), step.settleMs)
    }
  }
  const navigated = (session: Session) =>
    session.navigation.actions.map((action) => ({ type: action.type, ...(action.payload as object) }))
  const sent = (session: Session) => session.requests().filter((request) => request.endpoint === "auth")

  it("Log In sends the lower-cased email once, stores the tokens and leaves for Home", async () => {
    const session = await open()
    try {
      await run(session, [...fill, login])
      await session.settle(1000)
      expect(sent(session)).toHaveLength(1)
      expect(JSON.stringify(sent(session)[0].args)).toContain("mona.adel@example.com")
      expect(session.store.getState().auth.token).toBe("t-1")
      expect(session.store.getState().auth.refreshToken).toBe("r-1")
      expect(navigated(session)).toEqual([
        expect.objectContaining({ type: "RESET", index: 0, routes: [{ name: "HomeTabs" }] }),
      ])
    } finally {
      session.unmount()
    }
  })

  it("coming from the sign-in gate it goes back instead, and the sign-up link carries that on", async () => {
    const session = await open({ route: { name: "SignInEmailScreen", params: { returnTo: true } } })
    try {
      await run(session, [...fill, login])
      await session.settle(1000)
      expect(navigated(session)).toEqual([expect.objectContaining({ type: "GO_BACK" })])
      await act(session, () => pressText(session.root, `${copy(env, "dont_have_an_account")} ${copy(env, "sign_up")}`.replace("  ", " ")))
      expect(navigated(session)[1]).toEqual(
        expect.objectContaining({ name: "RegisterScreen", params: { returnTo: true } })
      )
    } finally {
      session.unmount()
    }
  })

  it("an empty form sends nothing; the sign-up link, the back chevron and Forgot password", async () => {
    const session = await open()
    try {
      await act(session, () => login(session.root, env))
      await session.settle(500)
      expect(sent(session)).toHaveLength(0)
      await act(session, () => pressText(session.root, copy(env, "forgot_your_password")))
      expect(navigated(session)).toEqual([])
      await act(session, () => pressIcon(session.root, { icon: "svg:chevron-left" }))
      expect(navigated(session)).toEqual([expect.objectContaining({ type: "GO_BACK" })])
    } finally {
      session.unmount()
    }
  })
})
