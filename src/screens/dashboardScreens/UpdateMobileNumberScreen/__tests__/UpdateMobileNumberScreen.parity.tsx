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
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * Update mobile number: the current number (or the dash), the +20 prefix box
 * (a different row direction and borders in Arabic), the number field, the
 * format error, the send button's grey label while the number is invalid and
 * the spinner, and the answers.
 */

const load = () => require("../UpdateMobileNumberScreen")

const NO_NUMBER = {
  state: { auth: signedIn({ ...CUSTOMER, mobileNumber: "" }) },
  api: screenState("data").api,
}

const ANSWERS = {
  pending: "loading" as const,
  validation: {
    error: {
      status: 400,
      data: { validationErrors: { mobileNumber: ["Number already used"] } },
    },
  },
  message: { error: { status: 409, data: { message: "Number is taken" } } },
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
  route: { name: "UpdateMobileNumberScreen" },
})

const type = (text: string): Step => (root) => typeInto(root, 0, text)
const send: Step = (root, env) =>
  pressTitled(root, copy(env, "send_verification_code"))
const ok: Step = (root, env) => pressTitled(root, copy(env, "OK"))

const VALID = "01012345678"

type Case = {
  label: string
  answer?: keyof typeof ANSWERS
  who?: typeof base
  steps?: Step[]
}
const CASES: Case[] = [
  { label: "as opened" },
  { label: "no number on file", who: NO_NUMBER },
  { label: "does not start with 01", steps: [type("1234")] },
  { label: "one digit", steps: [type("0")] },
  { label: "01 and too short", steps: [type("01012")] },
  { label: "valid number", steps: [type(VALID)] },
  { label: "sent, pending", steps: [type(VALID), send] },
  { label: "refused with a validation error", answer: "validation", steps: [type(VALID), send] },
  { label: "refused with a message", answer: "message", steps: [type(VALID), send] },
  { label: "refused with neither", answer: "no message", steps: [type(VALID), send] },
  { label: "accepted: the field clears and the success card shows", answer: "accepted", steps: [type(VALID), send] },
]

describe("UpdateMobileNumberScreen", () => {
  it.each(rowsByPlatform(CASES, PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ label, answer, who, steps, env }) => {
      expectParity(
        parityName(label, env),
        await treeAfter(load, optionsFor(env, answer, who), env, steps)
      )
    }
  )
})

describe("UpdateMobileNumberScreen presses", () => {
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

  it.each(envs)("Send is refused until the number is valid [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      expect(() => pressTitled(session.root, copy(env, "send_verification_code"))).toThrow()
      await run(session, env, [type("01012")])
      expect(() => pressTitled(session.root, copy(env, "send_verification_code"))).toThrow()
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("Send sends the number; OK on the success card goes back [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env, "accepted"))
    try {
      await run(session, env, [type(VALID), send])
      const sent = session.requests().filter((r) => r.endpoint === "updateCustomer")
      expect(sent).toHaveLength(1)
      expect(JSON.stringify(sent[0].args)).toContain(`"mobileNumber":"${VALID}"`)
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
      await run(session, env, [type(VALID), send])
      const card = () =>
        session.root.findAll(
          (node) =>
            typeof node.type !== "string" &&
            "isVisible" in node.props &&
            "descr" in node.props
        )[0].props
      expect(JSON.stringify(session.tree())).toContain("Number is taken")
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
