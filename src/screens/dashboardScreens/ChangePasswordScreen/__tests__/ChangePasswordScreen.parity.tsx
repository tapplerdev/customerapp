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
import { CUSTOMER } from "testing/screenKit/fixtures/users"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * Change password: three secure fields, the two client errors (too short,
 * not the same), Send's grey (disabled), red (filled and valid) and spinner
 * looks, and the answers: refused with validation errors, with a message,
 * with neither (ErrorModal and its icon), accepted (SuccessModal).
 */

const load = () => require("../ChangePasswordScreen")

const ANSWERS = {
  pending: "loading" as const,
  validation: {
    error: {
      status: 400,
      data: { validationErrors: { password: ["Current password is wrong"] } },
    },
  },
  message: { error: { status: 400, data: { message: "Too many attempts" } } },
  "no message": { error: { status: 500, data: {} } },
  accepted: { data: CUSTOMER },
}

const base = screenState("data")
const optionsFor = (env: ParityEnv, answer: keyof typeof ANSWERS = "pending") => ({
  ...base,
  api: { ...base.api, updateCustomer: ANSWERS[answer] },
  lang: env.language,
  platform: env.platform ?? "ios",
  route: { name: "ChangePasswordScreen" },
})

const type = (index: number, text: string): Step => (root) =>
  typeInto(root, index, text)
const send: Step = (root, env) => pressTitled(root, copy(env, "send"))
const ok: Step = (root, env) => pressTitled(root, copy(env, "OK"))

const FILLED = [type(0, "oldpass1"), type(1, "newpass12"), type(2, "newpass12")]

// The screen's save button is an ActionBtn turned into a ds Button by the conversion: Button's own height and accessibility props, on the rows that draw it.
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

type Case = { label: string; answer?: keyof typeof ANSWERS; steps?: Step[] }
const CASES: Case[] = [
  { label: "as opened" },
  { label: "current password typed", steps: [type(0, "oldpass1")] },
  { label: "new password too short", steps: [type(0, "oldpass1"), type(1, "abc")] },
  {
    label: "repeat does not match",
    steps: [type(0, "oldpass1"), type(1, "newpass12"), type(2, "newpass1")],
  },
  { label: "short and mismatching", steps: [type(1, "abc"), type(2, "abd")] },
  { label: "all three filled and valid", steps: FILLED },
  { label: "sent, pending", steps: [...FILLED, send] },
  { label: "refused with a validation error", answer: "validation", steps: [...FILLED, send] },
  { label: "refused with a message", answer: "message", steps: [...FILLED, send] },
  { label: "refused with neither", answer: "no message", steps: [...FILLED, send] },
  { label: "accepted: the fields clear and the success card shows", answer: "accepted", steps: [...FILLED, send] },
]

describe("ChangePasswordScreen", () => {
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

describe("ChangePasswordScreen presses", () => {
  const envs = rowsByPlatform([{}], PARITY_MATRIX)

  it.each(envs)("Send is refused while a field is empty or an error shows [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      expect(() => pressTitled(session.root, copy(env, "send"))).toThrow()
      await session.act(() => {
        type(1, "abc")(session.root, env)
      })
      expect(() => pressTitled(session.root, copy(env, "send"))).toThrow()
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("Send sends the new password; OK on the success card goes back [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env, "accepted"))
    try {
      for (const step of [...FILLED, send]) {
        // eslint-disable-next-line no-await-in-loop
        await session.act(() => {
          step(session.root, env)
        })
      }
      const sent = session.requests().filter((r) => r.endpoint === "updateCustomer")
      expect(sent).toHaveLength(1)
      expect(JSON.stringify(sent[0].args)).toContain('"currentPassword":"oldpass1"')
      expect(JSON.stringify(sent[0].args)).toContain('"newPassword":"newpass12"')
      expect(session.navigation.actions).toEqual([])
      await session.act(() => {
        ok(session.root, env)
      })
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
      for (const step of [...FILLED, send]) {
        // eslint-disable-next-line no-await-in-loop
        await session.act(() => {
          step(session.root, env)
        })
      }
      // The card is the screen's ErrorModal (the outermost element with an
      // isVisible and a descr; iOS keeps drawing a closed Modal for a while).
      const card = () =>
        session.root.findAll(
          (node) =>
            typeof node.type !== "string" &&
            "isVisible" in node.props &&
            "descr" in node.props
        )[0].props
      expect(JSON.stringify(session.tree())).toContain("Too many attempts")
      expect(card().isVisible).toBe(true)
      await session.act(() => {
        ok(session.root, env)
      })
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
