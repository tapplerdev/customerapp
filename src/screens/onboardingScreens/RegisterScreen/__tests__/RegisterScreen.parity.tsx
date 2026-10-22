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
 * RegisterScreen (a new account), captured from the unconverted code: as it
 * opens (Register disabled), each field typed in turn (the filled field's own
 * face, the password's hint), the form ready (Register in red), a form that
 * is not (a short password, a mobile number that does not start with 01),
 * Female picked, the password shown, the request on its way and each card a
 * failed sign-up opens (the server's first reason, its message, nothing). The
 * Register button is an ActionBtn before and a Button after: Button's two
 * listed deltas on every row. Then the presses: Register signs up, logs in,
 * stores the tokens and leaves for Home (or goes back to the job flow it
 * came from), a form that is not ready sends nothing, the chevron and the
 * log-in link.
 */

const load = () => require("../RegisterScreen")

const ALLOW: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const type = (index: number, text: string): Step => (root) => typeInto(root, index, text)
const FILLED: Step[] = [
  type(0, "Mona"),
  type(1, "Adel"),
  type(2, "Mona.Adel@Example.com"),
  type(3, "secret-1"),
  type(4, "01012345678"),
]
const register: Step = (root, env) => pressTitled(root, copy(env, "register"))
const SIGNED_UP = { data: { id: 1 } }
const TOKENS = { data: { token: "t-1", refreshToken: "r-1" } }
const refused = (data: unknown) => ({ customerSignUp: { error: { status: 400, data } } })

type Case = {
  state: string
  api?: object
  steps?: Step[]
}

const CASES: Case[] = [
  { state: "as it opens" },
  { state: "a first name typed", steps: [type(0, "Mona")] },
  { state: "the form filled, ready", steps: FILLED },
  { state: "a short password", steps: [...FILLED.slice(0, 3), type(3, "abc"), FILLED[4]] },
  { state: "a mobile number not starting with 01", steps: [...FILLED.slice(0, 4), type(4, "02012345678")] },
  { state: "a mobile number too short", steps: [...FILLED.slice(0, 4), type(4, "010123")] },
  { state: "Female picked", steps: [...FILLED, (root, env) => pressText(root, copy(env, "female"))] },
  { state: "the password shown", steps: [...FILLED, (root) => pressIcon(root, { icon: "svg:hide-password" })] },
  { state: "the request on its way", api: { customerSignUp: "loading" }, steps: [...FILLED, register] },
  { state: "refused with a reason", api: refused({ validationErrors: { email: ["email already exists"] } }), steps: [...FILLED, register] },
  { state: "refused with a message", api: refused({ message: "Something went wrong." }), steps: [...FILLED, register] },
  // (A reason that is not text draws the same card as none.)
  { state: "refused with nothing to say", api: refused({}), steps: [...FILLED, register] },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("RegisterScreen, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async ({ state, api, steps, env }) => {
    const tree = await treeAfter(
      load,
      {
        ...guestState("data"),
        api: { ...DATA, ...api },
        lang: env.language,
        platform: env.platform,
        route: { name: "RegisterScreen" },
      },
      env,
      steps
    )
    expectParity(parityName(state, env), tree, { allow: ALLOW })
  })
})

describe.each(PARITY_MATRIX)("RegisterScreen presses [$language $platform]", (env: ParityEnv) => {
  const open = (options: Partial<RenderScreenOptions> = {}) =>
    openScreen(load, {
      ...guestState("data"),
      api: { ...DATA, customerSignUp: SIGNED_UP, auth: TOKENS },
      lang: env.language,
      platform: env.platform,
      route: { name: "RegisterScreen" },
      ...options,
    })
  type Session = Awaited<ReturnType<typeof open>>
  const run = async (session: Session, steps: Step[]) => {
    for (const step of steps) {
      // eslint-disable-next-line no-await-in-loop
      await session.act(() => step(session.root, env), step.settleMs)
    }
  }
  const navigated = (session: Session) =>
    session.navigation.actions.map((action) => ({ type: action.type, ...(action.payload as object) }))
  const sent = (session: Session, endpoint: string) =>
    session.requests().filter((request) => request.endpoint === endpoint)

  it("Register signs up once, logs in, stores the tokens and leaves for Home", async () => {
    const session = await open()
    try {
      await run(session, [...FILLED, register])
      await session.settle(1000)
      expect(sent(session, "customerSignUp")).toHaveLength(1)
      const body = JSON.stringify(sent(session, "customerSignUp")[0].args)
      expect(body).toContain("mona.adel@example.com")
      expect(body).toContain('"gender":"male"')
      expect(sent(session, "auth")).toHaveLength(1)
      expect(session.store.getState().auth.token).toBe("t-1")
      expect(navigated(session)).toEqual([
        expect.objectContaining({ type: "RESET", index: 0, routes: [{ name: "HomeTabs" }] }),
      ])
    } finally {
      session.unmount()
    }
  })

  it("Female is what it signs up with; coming from the gate it goes back instead", async () => {
    const session = await open({ route: { name: "RegisterScreen", params: { returnTo: true } } })
    try {
      await run(session, [...FILLED, (root) => pressText(root, copy(env, "female")), register])
      await session.settle(1000)
      expect(JSON.stringify(sent(session, "customerSignUp")[0].args)).toContain('"gender":"female"')
      expect(navigated(session)).toEqual([expect.objectContaining({ type: "GO_BACK" })])
      await run(session, [(root) => pressText(root, copy(env, "have_account_login"))])
      expect(navigated(session)[1]).toEqual(
        expect.objectContaining({ name: "SignInEmailScreen", params: { returnTo: true } })
      )
    } finally {
      session.unmount()
    }
  })

  it("a form that is not ready sends nothing; the chevron goes back", async () => {
    const session = await open()
    try {
      await run(session, [...FILLED.slice(0, 4), type(4, "02012345678")])
      await expect(run(session, [register])).rejects.toThrow(/disabled/)
      expect(sent(session, "customerSignUp")).toHaveLength(0)
      await run(session, [(root) => pressIcon(root, { icon: "svg:chevron-left" })])
      expect(navigated(session)).toEqual([expect.objectContaining({ type: "GO_BACK" })])
    } finally {
      session.unmount()
    }
  })
})
