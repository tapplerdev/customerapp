/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  openScreen,
  pressIcon,
  rowsByPlatform,
  treeAfter,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"

/*
 * About app: the header and the four rows. Static, so one state; the back
 * chevron is its one pressable with an effect (the rows' handlers are empty).
 */

const load = () => require("../AboutAppScreen")
const rows = rowsByPlatform([{ state: "menu" }], PARITY_MATRIX)

const options = (env: { language: "en" | "ar"; platform?: "ios" | "android" }) => ({
  ...screenState("data"),
  lang: env.language,
  platform: env.platform ?? "ios",
  route: { name: "AboutAppScreen" },
})

describe("AboutAppScreen", () => {
  it.each(rows)("$state [$env.language $env.platform]", async ({ state, env }) => {
    expectParity(parityName(state, env), await treeAfter(load, options(env), env))
  })
})

describe("AboutAppScreen presses", () => {
  it.each(rowsByPlatform([{}], PARITY_MATRIX))(
    "the back chevron goes back [$env.language $env.platform]",
    async ({ env }) => {
      const session = await openScreen(load, options(env))
      try {
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:chevron-left" })
        })
        expect(session.navigation.actions).toEqual([
          expect.objectContaining({ type: "GO_BACK" }),
        ])
      } finally {
        session.unmount()
      }
    }
  )
})
