/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import {
  copy,
  openScreen,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  type Step,
} from "testing/screenKit"
import { pressContaining } from "testing/pressContaining"
import { screenState } from "testing/screenKit/states"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * TooltipComponent (the tour's "best deal" tip), captured from the unconverted
 * code: as it opens and with "don't show again" ticked (its check). rn-tourguide draws this tooltip only once its zones have been
 * measured, which a jest render never gives, so the tip is rendered on its own
 * with the props the tour hands it. Then the presses: the checkbox ticks and
 * unticks, Got it stops the tour once, and remembers "don't show again" only
 * when it was ticked.
 */

const load = () => {
  const React = require("react") as typeof import("react")
  const Tooltip = require("../TooltipComponent").default
  const Harness = ({ handleStop }: { handleStop?: () => void }) =>
    React.createElement(Tooltip, { handleStop })
  return { default: Harness }
}

// Got it is an ActionBtn before and a Button after: Button's own listed deltas on its root.
const ALLOW: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

type Case = { state: string; steps?: Step[] }
const tick: Step = (root, env) => pressContaining(root, copy(env, "do_not_show_again"))

const CASES: Case[] = [
  { state: "as it opens" },
  { state: "do not show again ticked", steps: [tick] },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("TooltipComponent, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async ({ state, steps, env }) => {
    const tree = await treeAfter(
      load,
      { ...screenState("data"), lang: env.language, platform: env.platform, navigation: "none", props: { handleStop: () => undefined } },
      env,
      steps
    )
    expectParity(parityName(state, env), tree, { allow: ALLOW })
  })
})

describe.each(PARITY_MATRIX)("TooltipComponent presses [$language $platform]", (env: ParityEnv) => {
  const open = (handleStop: () => void) =>
    openScreen(load, {
      ...screenState("data"),
      state: { auth: { ...screenState("data").state.auth, dontShowBestDealTooltip: false } },
      lang: env.language,
      platform: env.platform,
      navigation: "none",
      props: { handleStop },
    })

  it("Got it stops the tour once, and forgets the tip only when ticked", async () => {
    const handleStop = jest.fn()
    const session = await open(handleStop)
    try {
      await session.act(() => {
        pressTitled(session.root, copy(env, "got_it"))
      })
      expect(handleStop).toHaveBeenCalledTimes(1)
      expect(session.store.getState().auth.dontShowBestDealTooltip).toBe(false)
      await session.act(() => {
        pressContaining(session.root, copy(env, "do_not_show_again"))
      })
      await session.act(() => {
        pressTitled(session.root, copy(env, "got_it"))
      })
      expect(handleStop).toHaveBeenCalledTimes(2)
      expect(session.store.getState().auth.dontShowBestDealTooltip).toBe(true)
    } finally {
      session.unmount()
    }
  })

  it("the checkbox shows its check while ticked", async () => {
    const session = await open(() => undefined)
    try {
      expect(JSON.stringify(session.tree())).not.toContain("✓")
      await session.act(() => {
        pressContaining(session.root, copy(env, "do_not_show_again"))
      })
      expect(JSON.stringify(session.tree())).toContain("✓")
      await session.act(() => {
        pressContaining(session.root, copy(env, "do_not_show_again"))
      })
      expect(JSON.stringify(session.tree())).not.toContain("✓")
    } finally {
      session.unmount()
    }
  })
})
