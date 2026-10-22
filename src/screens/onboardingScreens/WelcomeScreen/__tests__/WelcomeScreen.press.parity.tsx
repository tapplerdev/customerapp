/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import { openScreen, pressTitled } from "testing/screenKit"
import { freshInstallState } from "testing/screenKit/states"
import { PARITY_MATRIX, type ParityEnv } from "testing/hostTreeParity"

/*
 * WelcomeScreen's two buttons do what they say, once: each stores its
 * language and the screen to come back to, and covers the screen with the
 * loading overlay (the app restarts 100 ms later; the restart is the kit's
 * stand-in). The drawing is the frozen proof's (screenKit/__tests__/
 * example.parity.tsx); this holds what a tree can't show, the handler's
 * effect on the store. It also pins that the screen clears a screen to come
 * back to that an earlier restart left behind.
 */

const load = () => require("../WelcomeScreen")

describe.each(PARITY_MATRIX)("WelcomeScreen presses [$language $platform]", (env: ParityEnv) => {
  const open = (currentScreen?: string) =>
    openScreen(load, {
      ...freshInstallState(),
      state: { auth: { ...freshInstallState().state.auth, currentScreen } as never },
      lang: env.language,
      platform: env.platform,
      route: { name: "WelcomeScreen" },
    })

  it.each([
    ["English", "en"],
    ["عربي", "ar"],
  ])("%s stores the language and where to come back to", async (title, language) => {
    const session = await open()
    try {
      expect(session.store.getState().auth.currentScreen).toBeUndefined()
      await session.act(() => {
        pressTitled(session.root, title)
      })
      expect(session.store.getState().auth.language).toBe(language)
      expect(session.store.getState().auth.currentScreen).toBe("auth-welcome")
      expect(JSON.stringify(session.tree())).not.toContain("Please Select Your Language")
    } finally {
      session.unmount()
    }
  })

  it("an earlier restart's screen to come back to is cleared on arrival", async () => {
    const session = await open("auth-welcome")
    try {
      expect(session.store.getState().auth.currentScreen).toBeUndefined()
    } finally {
      session.unmount()
    }
  })
})
