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
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * Delete account: the warning, the multiline reason field (empty, typed),
 * the Delete button and its confirmation card (MainModal with its icon,
 * title, two buttons and the screen's class-styled title, wrapper, buttons
 * and card). Yes does nothing yet (an empty handler), so the card's only
 * observable control is No.
 */

const load = () => require("../DeleteAccountScreen")

const optionsFor = (env: ParityEnv) => ({
  ...screenState("data"),
  lang: env.language,
  platform: env.platform ?? "ios",
  route: { name: "DeleteAccountScreen" },
})

const typeReason: Step = (root) =>
  typeInto(root, 0, "I moved abroad and will not need the service.")
const askDelete: Step = (root, env) =>
  pressTitled(root, copy(env, "delete_my_account"))

const CASES: { label: string; steps?: Step[] }[] = [
  { label: "as opened" },
  { label: "reason typed", steps: [typeReason] },
  { label: "confirmation asked", steps: [askDelete] },
  { label: "reason typed, confirmation asked", steps: [typeReason, askDelete] },
]

describe("DeleteAccountScreen", () => {
  it.each(rowsByPlatform(CASES, PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ label, steps, env }) => {
      expectParity(
        parityName(label, env),
        await treeAfter(load, optionsFor(env), env, steps)
      )
    }
  )
})

describe("DeleteAccountScreen presses", () => {
  const envs = rowsByPlatform([{}], PARITY_MATRIX)

  it.each(envs)("Delete opens the card, No closes it; the chevron goes back [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      // The screen's MainModal: the outermost element with isVisible and a title.
      const card = () =>
        session.root.findAll(
          (node) =>
            typeof node.type !== "string" &&
            "isVisible" in node.props &&
            "isBtnsTwo" in node.props
        )[0].props
      expect(card().isVisible).toBe(false)
      await session.act(() => {
        askDelete(session.root, env)
      })
      expect(card().isVisible).toBe(true)
      await session.act(() => {
        pressTitled(session.root, copy(env, "no"))
      })
      expect(card().isVisible).toBe(false)
      await session.act(() => {
        pressIcon(session.root, { icon: "svg:chevron-left" })
      })
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({ type: "GO_BACK" }),
      ])
      expect(session.requests().filter((r) => r.type === "mutation")).toEqual([])
    } finally {
      session.unmount()
    }
  })
})
