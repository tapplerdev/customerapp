/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  typeInto,
  type Step,
} from "testing/screenKit"
import { guestState } from "testing/screenKit/states"
import { CUSTOMER } from "testing/screenKit/fixtures/users"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * The gate's register form. Nothing imports it today, so it is rendered bare
 * (`navigation: "none"`) with the two navigation stubs it is given. Five
 * DmAuthInput fields (first name, last name, email, password with its hint
 * and show/hide icon, a mobile number in its own +20 row) are typed into, so
 * every filled face is a row; the gender radios are pressed; Register's grey
 * (until the form is valid), red and spinner looks; the refusals.
 */

const load = () => require("../GateRegisterScreen")

const ANSWERS = {
  pending: "loading" as const,
  validation: {
    error: {
      status: 400,
      data: { validationErrors: { email: ["Email already registered"] } },
    },
  },
  message: { error: { status: 409, data: { message: "Account exists" } } },
  "no message": { error: { status: 500, data: {} } },
  accepted: { data: { id: 1 } },
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
  api: {
    ...base.api,
    customerSignUp: ANSWERS[answer],
    auth: { data: { token: "t", refreshToken: "r" } },
    getCustomerMe: { data: CUSTOMER },
  },
  lang: env.language,
  platform: env.platform ?? "ios",
  navigation: "none" as const,
  props,
})

const type = (index: number, text: string): Step => (root) =>
  typeInto(root, index, text)
const register: Step = (root, env) => pressTitled(root, copy(env, "register"))
const showPassword: Step = (root) =>
  pressIcon(root, { icon: "svg:hide-password" })
const pickFemale: Step = (root, env) => pressText(root, copy(env, "female"))
const pickMale: Step = (root, env) => pressText(root, copy(env, "male"))

const FILLED = [
  type(0, "Mona"),
  type(1, "Adel"),
  type(2, "Mona.Adel@Example.com"),
  type(3, "secret123"),
  type(4, "01012345678"),
]

// Register is an ActionBtn turned into a ds Button by the conversion: Button's own height and accessibility props, on the rows that draw it.
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

type Case = { label: string; answer?: keyof typeof ANSWERS; steps?: Step[] }
const CASES: Case[] = [
  { label: "as opened" },
  { label: "first name typed", steps: [type(0, "Mona")] },
  { label: "everything typed and valid", steps: FILLED },
  { label: "everything typed, password shown", steps: [...FILLED, showPassword] },
  { label: "everything typed, female picked", steps: [...FILLED, pickFemale] },
  { label: "female picked, nothing typed", steps: [pickFemale] },
  { label: "password too short", steps: [...FILLED.slice(0, 3), type(3, "abc"), FILLED[4]] },
  { label: "mobile number invalid", steps: [...FILLED.slice(0, 4), type(4, "0123")] },
  { label: "registering", steps: [...FILLED, register] },
  { label: "refused with a validation error", answer: "validation", steps: [...FILLED, register] },
  { label: "refused with a message", answer: "message", steps: [...FILLED, register] },
  { label: "refused with neither", answer: "no message", steps: [...FILLED, register] },
]

describe("GateRegisterScreen", () => {
  it.each(rowsByPlatform(CASES, PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ label, answer, steps, env }) => {
      expectParity(
        parityName(label, env),
        await treeAfter(load, optionsFor(env, answer), env, steps),
        { allow: BUTTON }
      )
    }
  )
})

describe("GateRegisterScreen presses", () => {
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

  it.each(envs)("the radios swap: Male after Female draws the opened form again [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      const opened = JSON.stringify(session.tree())
      await run(session, env, [pickFemale])
      expect(JSON.stringify(session.tree())).not.toBe(opened)
      await run(session, env, [pickMale])
      expect(JSON.stringify(session.tree())).toBe(opened)
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("Register is refused until the form is valid [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      expect(() => pressTitled(session.root, copy(env, "register"))).toThrow()
      await run(session, env, [type(0, "Mona")])
      expect(() => pressTitled(session.root, copy(env, "register"))).toThrow()
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("Register signs up, signs in and dismisses the gate [$env.language $env.platform]", async ({ env }) => {
    const navigation = { goBack: jest.fn() }
    const parentNav = { goBack: jest.fn() }
    const session = await openScreen(load, optionsFor(env, "accepted", { navigation, parentNav }))
    try {
      await run(session, env, [...FILLED, pickFemale, register])
      const signUp = session.requests().filter((r) => r.endpoint === "customerSignUp")
      expect(signUp).toHaveLength(1)
      const body = JSON.stringify(signUp[0].args)
      expect(body).toContain('"email":"mona.adel@example.com"')
      expect(body).toContain('"gender":"female"')
      expect(body).toContain('"mobileNumber":"01012345678"')
      expect(session.requests().filter((r) => r.endpoint === "auth")).toHaveLength(1)
      expect(parentNav.goBack).toHaveBeenCalledTimes(1)
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("OK closes the error card; the chevron goes back [$env.language $env.platform]", async ({ env }) => {
    const navigation = { goBack: jest.fn() }
    const session = await openScreen(
      load,
      optionsFor(env, "message", { navigation, parentNav: { goBack: jest.fn() } })
    )
    try {
      await run(session, env, [...FILLED, register])
      const card = () =>
        session.root.findAll(
          (node) =>
            typeof node.type !== "string" &&
            "isVisible" in node.props &&
            "descr" in node.props
        )[0].props
      expect(card().isVisible).toBe(true)
      await run(session, env, [(root, e) => pressTitled(root, copy(e, "OK"))])
      expect(card().isVisible).toBe(false)
      await run(session, env, [(root) => pressIcon(root, { icon: "svg:chevron-left" })])
      expect(navigation.goBack).toHaveBeenCalledTimes(1)
    } finally {
      session.unmount()
    }
  })
})
