/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  typeInto,
  type Step,
} from "testing/screenKit"
import { guestState } from "testing/screenKit/states"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * The gate's sign-in form. Nothing imports it today, so it is rendered bare
 * (`navigation: "none"`) with the two navigation stubs it is given; its
 * DmAuthInput fields (email, password with the show/hide icon) are typed
 * into, so the filled face (the field-face case) is a row, and Log In is
 * answered every way its handler tells apart in the tree (any other
 * validation error, or none, draws the "no validation errors" row).
 */

const load = () => require("../GateSignInScreen")

const ANSWERS = {
  pending: "loading" as const,
  "password mismatch": {
    error: {
      status: 400,
      data: { validationErrors: { password: ["Password does not match"] } },
    },
  },
  "not registered": {
    error: {
      status: 400,
      data: { validationErrors: { email: ["This email is not registered"] } },
    },
  },
  "no validation": { error: { status: 500, data: {} } },
  accepted: { data: { token: "t", refreshToken: "r" } },
}

const base = guestState("data")
const optionsFor = (
  env: ParityEnv,
  answer: keyof typeof ANSWERS = "pending",
  props: Record<string, unknown> = {
    navigation: { goBack: () => undefined },
    parentNav: { goBack: () => undefined },
  }
) => ({
  ...base,
  api: { ...base.api, auth: ANSWERS[answer] },
  lang: env.language,
  platform: env.platform ?? "ios",
  navigation: "none" as const,
  props,
})

const type = (index: number, text: string): Step => (root) =>
  typeInto(root, index, text)
const logIn: Step = (root, env) => pressTitled(root, copy(env, "log_In"))
const showPassword: Step = (root) =>
  pressIcon(root, { icon: "svg:hide-password" })
const FILLED = [type(0, "Mona.Adel@Example.com"), type(1, "secret123")]

type Case = { label: string; answer?: keyof typeof ANSWERS; steps?: Step[] }
const CASES: Case[] = [
  { label: "as opened" },
  { label: "email typed", steps: [type(0, "Mona.Adel@Example.com")] },
  { label: "both typed, password hidden", steps: FILLED },
  { label: "both typed, password shown", steps: [...FILLED, showPassword] },
  { label: "signing in", steps: [...FILLED, logIn] },
  { label: "refused: wrong password", answer: "password mismatch", steps: [...FILLED, logIn] },
  { label: "refused: not registered", answer: "not registered", steps: [...FILLED, logIn] },
  { label: "refused: no validation errors", answer: "no validation", steps: [...FILLED, logIn] },
]

describe("GateSignInScreen", () => {
  it.each(rowsByPlatform(CASES, PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ label, answer, steps, env }) => {
      expectParity(
        parityName(label, env),
        await treeAfter(load, optionsFor(env, answer), env, steps)
      )
    }
  )
})

describe("GateSignInScreen presses", () => {
  const envs = rowsByPlatform([{}], PARITY_MATRIX)
  const run = async (
    session: Awaited<ReturnType<typeof openScreen>>,
    env: ParityEnv,
    steps: Step[]
  ) => {
    for (const step of steps) {
      // eslint-disable-next-line no-await-in-loop
      await session.act(() => {
        step(session.root, env)
      })
    }
  }

  it.each(envs)("Log In signs in with the lower-cased email and dismisses the gate [$env.language $env.platform]", async ({ env }) => {
    const navigation = { goBack: jest.fn() }
    const parentNav = { goBack: jest.fn() }
    const session = await openScreen(load, optionsFor(env, "accepted", { navigation, parentNav }))
    try {
      await run(session, env, [...FILLED, logIn])
      const sent = session.requests().filter((r) => r.endpoint === "auth")
      expect(sent).toHaveLength(1)
      expect(JSON.stringify(sent[0].args)).toContain('"email":"mona.adel@example.com"')
      expect(JSON.stringify(sent[0].args)).toContain('"password":"secret123"')
      expect(parentNav.goBack).toHaveBeenCalledTimes(1)
      expect(navigation.goBack).not.toHaveBeenCalled()
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("Log In with an empty form sends nothing; the back chevron goes back [$env.language $env.platform]", async ({ env }) => {
    const navigation = { goBack: jest.fn() }
    const session = await openScreen(load, optionsFor(env, "accepted", { navigation, parentNav: { goBack: jest.fn() } }))
    try {
      await run(session, env, [logIn])
      expect(session.requests().filter((r) => r.endpoint === "auth")).toHaveLength(0)
      await run(session, env, [(root) => pressIcon(root, { icon: "svg:chevron-left" })])
      expect(navigation.goBack).toHaveBeenCalledTimes(1)
    } finally {
      session.unmount()
    }
  })
})
