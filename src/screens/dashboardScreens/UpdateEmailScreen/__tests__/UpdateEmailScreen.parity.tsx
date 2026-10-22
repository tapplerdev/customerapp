/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

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
import { screenState } from "testing/screenKit/states"
import { CUSTOMER, signedIn } from "testing/screenKit/fixtures/users"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * Update email: the current address, the new-address and password fields,
 * the two client errors (not an email, the same as now), Change Email's
 * grey, red and spinner looks, and the answers (ErrorModal with the
 * email-exists icon, SuccessModal). A customer with no email on file is a
 * state too (the current address row draws nothing).
 */

const load = () => require("../UpdateEmailScreen")

const NO_EMAIL = {
  state: { auth: signedIn({ ...CUSTOMER, email: "" }) },
  api: screenState("data").api,
}

const ANSWERS = {
  pending: "loading" as const,
  validation: {
    error: {
      status: 400,
      data: { validationErrors: { email: ["Email already registered"] } },
    },
  },
  message: { error: { status: 409, data: { message: "Email is taken" } } },
  "no message": { error: { status: 500, data: {} } },
  accepted: { data: CUSTOMER },
}

const base = screenState("data")
const optionsFor = (
  env: ParityEnv,
  answer: keyof typeof ANSWERS = "pending",
  who: typeof base = base
) => ({
  ...who,
  api: { ...who.api, updateCustomer: ANSWERS[answer] },
  lang: env.language,
  platform: env.platform ?? "ios",
  route: { name: "UpdateEmailScreen" },
})

const type = (index: number, text: string): Step => (root) =>
  typeInto(root, index, text)
const send: Step = (root, env) => pressTitled(root, copy(env, "change_email"))
const ok: Step = (root, env) => pressTitled(root, copy(env, "OK"))

const FILLED = [type(0, "New.Address@Example.com"), type(1, "secret123")]

// The screen's save button is an ActionBtn turned into a ds Button by the conversion: Button's own height and accessibility props, on the rows that draw it.
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

type Case = {
  label: string
  answer?: keyof typeof ANSWERS
  who?: typeof base
  steps?: Step[]
}
const CASES: Case[] = [
  { label: "as opened" },
  { label: "no email on file", who: NO_EMAIL },
  { label: "not an email", steps: [type(0, "abc")] },
  { label: "the same email as now, in other letters", steps: [type(0, "Customer.Parity@Example.com"), type(1, "secret123")] },
  { label: "email typed, no password", steps: [type(0, "new@example.com")] },
  { label: "password typed, no email", steps: [type(1, "secret123")] },
  { label: "both filled and valid", steps: FILLED },
  { label: "sent, pending", steps: [...FILLED, send] },
  { label: "refused with a validation error", answer: "validation", steps: [...FILLED, send] },
  { label: "refused with a message", answer: "message", steps: [...FILLED, send] },
  { label: "refused with neither", answer: "no message", steps: [...FILLED, send] },
  { label: "accepted: the fields clear and the success card shows", answer: "accepted", steps: [...FILLED, send] },
]

describe("UpdateEmailScreen", () => {
  it.each(rowsByPlatform(CASES, PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ label, answer, who, steps, env }) => {
      expectParity(
        parityName(label, env),
        await treeAfter(load, optionsFor(env, answer, who), env, steps),
        { allow: BUTTON }
      )
    }
  )
})

describe("UpdateEmailScreen presses", () => {
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

  it.each(envs)("Change Email is refused until both fields are right [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      expect(() => pressTitled(session.root, copy(env, "change_email"))).toThrow()
      await run(session, env, [type(0, "abc"), type(1, "secret123")])
      expect(() => pressTitled(session.root, copy(env, "change_email"))).toThrow()
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("Change Email sends the lower-cased address; OK on the success card goes back [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env, "accepted"))
    try {
      await run(session, env, [...FILLED, send])
      const sent = session.requests().filter((r) => r.endpoint === "updateCustomer")
      expect(sent).toHaveLength(1)
      expect(JSON.stringify(sent[0].args)).toContain('"email":"new.address@example.com"')
      expect(session.navigation.actions).toEqual([])
      await run(session, env, [ok])
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({ type: "GO_BACK" }),
      ])
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("OK closes the error card; the chevron goes back [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env, "message"))
    try {
      await run(session, env, [...FILLED, send])
      const card = () =>
        session.root.findAll(
          (node) =>
            typeof node.type !== "string" &&
            "isVisible" in node.props &&
            "descr" in node.props
        )[0].props
      expect(JSON.stringify(session.tree())).toContain("Email is taken")
      expect(card().isVisible).toBe(true)
      await run(session, env, [ok])
      expect(card().isVisible).toBe(false)
      await session.act(() => {
        pressIcon(session.root, { icon: "svg:chevron-left" })
      })
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({ type: "GO_BACK" }),
      ])
    } finally {
      session.unmount()
    }
  })
})
