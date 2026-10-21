/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import { openScreen, renderScreen, rowsByPlatform } from "testing/screenKit"
import { screenState, type ScreenStateName } from "testing/screenKit/states"
import {
  PARITY_MATRIX,
  captureMode,
  expectParity,
  parityName,
} from "testing/hostTreeParity"

/*
 * The wave 2 screen method, end to end, on a screen of the kit's own
 * (__fixtures__/ExampleScreen: class names, DmText, ActionBtn, the store and
 * an endpoint), as README.md in src/testing writes it out:
 *
 * 1. Before the conversion: this block renders the screen in each state
 *    (data, empty, loading) for every row of PARITY_MATRIX, and
 *    `yarn ds:parity:capture <this file>` writes __parity__/workflow.parity.json.
 * 2. The conversion (__fixtures__/ExampleScreen.converted) draws the same
 *    trees, with Button's listed deltas allowed on its root only.
 * 3. A conversion one point off (__fixtures__/ExampleScreen.mutant) fails.
 */

const STATES: ScreenStateName[] = ["data", "empty", "loading"]
const rows = rowsByPlatform(
  STATES.map((state) => ({ state })),
  PARITY_MATRIX
)

const BEFORE = () => require("../__fixtures__/ExampleScreen")
const CONVERTED = () => require("../__fixtures__/ExampleScreen.converted")
const MUTANT = () => require("../__fixtures__/ExampleScreen.mutant")

const render = (
  load: () => unknown,
  state: ScreenStateName,
  env: (typeof rows)[number]["env"]
) =>
  renderScreen(load, {
    ...screenState(state),
    lang: env.language,
    platform: env.platform,
  })

describe("the screen before its conversion (the captured fixture)", () => {
  it.each(rows)(
    "$state [$env.language $env.platform]",
    async ({ state, env }) => {
      expectParity(parityName(state, env), await render(BEFORE, state, env))
    }
  )
})

const compareOnly = captureMode() === "compare" ? describe : describe.skip

compareOnly("the converted screen", () => {
  it.each(rows)(
    "draws the same tree, Button's deltas allowed on its root [$env.language $env.platform] $state",
    async ({ state, env }) => {
      const tree = await render(CONVERTED, state, env)
      expect(() => expectParity(parityName(state, env), tree)).toThrow()
      const { accepted } = expectParity(parityName(state, env), tree, {
        allow: ["buttonHeight", "buttonAccessibility"],
      })
      expect(accepted.map((delta) => delta.what)).toEqual([
        "height 51 -> minHeight 51 (Button)",
        "accessibilityLabel, accessibilityRole (Button)",
      ])
    }
  )

  it.each(rows)(
    "mutant: one point off fails, allowances or not [$env.language $env.platform] $state",
    async ({ state, env }) => {
      const tree = await render(MUTANT, state, env)
      expect(() =>
        expectParity(parityName(state, env), tree, {
          allow: ["buttonHeight", "buttonAccessibility"],
        })
      ).toThrow(/marginTop/)
    }
  )
})

describe("what the states drew", () => {
  it("data shows the backend's count, empty a zero, loading the placeholder", async () => {
    const text = async (state: ScreenStateName) => {
      const session = await openScreen(BEFORE, screenState(state))
      try {
        return JSON.stringify(session.tree())
      } finally {
        session.unmount()
      }
    }
    expect(await text("data")).toContain("Leads: 2")
    expect(await text("empty")).toContain("Leads: 0")
    expect(await text("loading")).toContain("…")
  })
})
