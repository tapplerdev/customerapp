/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
  rowsByPlatform,
  treeAfter,
} from "testing/screenKit"
import { guestState } from "testing/screenKit/states"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * The auth gate sheet a guest meets before sending a request: the close
 * button, the hero icon, the title (font-custom800: the system face), the
 * three value rows, Sign up (red, shadowed) and Log in (outlined) as
 * pressable views, and the terms line. Static, one state. Sign up and Log in
 * go back and then navigate 300 ms later; the close button only goes back.
 */

const load = () => require("../AuthGateScreen")

const optionsFor = (env: ParityEnv) => ({
  ...guestState("data"),
  lang: env.language,
  platform: env.platform ?? "ios",
  route: { name: "AuthGateScreen" },
})

describe("AuthGateScreen", () => {
  it.each(rowsByPlatform([{ label: "the gate" }], PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ label, env }) => {
      expectParity(parityName(label, env), await treeAfter(load, optionsFor(env), env))
    }
  )
})

describe("AuthGateScreen presses", () => {
  const envs = rowsByPlatform([{}], PARITY_MATRIX)

  it.each(envs)("the close button goes back [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      await session.act(() => {
        pressIcon(session.root, { icon: "svg:close" })
      })
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({ type: "GO_BACK" }),
      ])
    } finally {
      session.unmount()
    }
  })

  it.each(
    rowsByPlatform(
      [
        { key: "sign_up", route: "RegisterScreen" },
        { key: "log_in", route: "SignInEmailScreen" },
      ],
      PARITY_MATRIX
    )
  )("$key goes back, then opens $route with returnTo [$env.language $env.platform]", async ({ key, route, env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      await session.act(() => {
        pressText(session.root, copy(env, key))
      }, 1000)
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({ type: "GO_BACK" }),
        expect.objectContaining({
          type: "NAVIGATE",
          payload: expect.objectContaining({ name: route, params: { returnTo: true } }),
        }),
      ])
    } finally {
      session.unmount()
    }
  })
})
