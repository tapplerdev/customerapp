/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressText,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  type Step,
} from "testing/screenKit"
import { guestState, screenState } from "testing/screenKit/states"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * The language picker (MainModal with two DmChecbox rows), open, signed in
 * and as a guest. The checkbox labels are :176/:301's `font-sans400`, which
 * names TheSans-Regular (not shipped, so the device draws the fallback), and
 * `font-custom400`. Its own fixture because the deliberate change (the labels
 * draw the shipped regular face) recaptures exactly these rows.
 */

const load = () => require("../AccountScreen")

const STATES = {
  "signed in": screenState("data"),
  guest: guestState("data"),
}
type StateName = keyof typeof STATES

const options = (name: StateName, env: ParityEnv) => ({
  ...STATES[name],
  lang: env.language,
  platform: env.platform ?? "ios",
  route: { name: "AccountScreen" },
})

const openLanguage: Step = (root, env) =>
  pressText(root, copy(env, "language") + copy(env, env.language === "ar" ? "arabic" : "english"))

describe("AccountScreen language picker", () => {
  it.each(
    rowsByPlatform(
      [
        { state: "signed in" as const, label: "language picker open, signed in" },
        { state: "guest" as const, label: "language picker open, guest" },
      ],
      PARITY_MATRIX
    )
  )("$label [$env.language $env.platform]", async ({ state, label, env }) => {
    expectParity(
      parityName(label, env),
      await treeAfter(load, options(state, env), env, [openLanguage])
    )
  })
})

describe("AccountScreen language picker presses", () => {
  it.each(rowsByPlatform([{ state: "signed in" as const }, { state: "guest" as const }], PARITY_MATRIX))(
    "the other language's checkbox switches the language; the current one only closes [$state] [$env.language $env.platform]",
    async ({ state, env }) => {
      const other = env.language === "ar" ? "en" : "ar"
      const open = async () => {
        const session = await openScreen(load, options(state, env))
        await session.act(() => {
          openLanguage(session.root, env)
        })
        return session
      }

      const switching = await open()
      try {
        await switching.act(() => {
          pressTitled(switching.root, copy(env, other === "ar" ? "arabic" : "english"))
        })
        const auth = (switching.store.getState() as any).auth
        expect(auth.language).toBe(other)
        expect(auth.currentScreen).toBe("home")
      } finally {
        switching.unmount()
      }

      const staying = await open()
      try {
        await staying.act(() => {
          pressTitled(staying.root, copy(env, env.language === "ar" ? "arabic" : "english"))
        })
        const auth = (staying.store.getState() as any).auth
        expect(auth.language).toBe(env.language)
        expect(auth.currentScreen).not.toBe("home")
      } finally {
        staying.unmount()
      }
    }
  )
})
