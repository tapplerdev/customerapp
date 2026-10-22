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
import { screenState } from "testing/screenKit/states"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * Account details: the header and the five rows (AccountMenuItem, which is
 * S4's too: its chevron, its separator and the label are drawn here). Every
 * row and the back chevron are pressed, and the navigation each asks for is
 * asserted, so a handler lost in the conversion fails a row.
 */

const load = () => require("../AccountDetailsScreen")

const options = (env: ParityEnv) => ({
  ...screenState("data"),
  lang: env.language,
  platform: env.platform ?? "ios",
  route: { name: "AccountDetailsScreen" },
})

describe("AccountDetailsScreen", () => {
  it.each(rowsByPlatform([{ state: "menu" }], PARITY_MATRIX))(
    "$state [$env.language $env.platform]",
    async ({ state, env }) => {
      expectParity(parityName(state, env), await treeAfter(load, options(env), env))
    }
  )
})

const ROWS = [
  ["my_information", "MyInformationScreen"],
  ["change_password", "ChangePasswordScreen"],
  ["update_mobile_number", "UpdateMobileNumberScreen"],
  ["update_email_address", "UpdateEmailScreen"],
  ["delete_my_account", "DeleteAccountScreen"],
] as const

describe("AccountDetailsScreen presses", () => {
  it.each(rowsByPlatform(ROWS.map(([key, route]) => ({ key, route })), PARITY_MATRIX))(
    "$key opens $route [$env.language $env.platform]",
    async ({ key, route, env }) => {
      const session = await openScreen(load, options(env))
      try {
        await session.act(() => {
          pressText(session.root, copy(env, key))
        })
        expect(session.navigation.actions).toEqual([
          expect.objectContaining({
            type: "NAVIGATE",
            payload: expect.objectContaining({ name: route }),
          }),
        ])
      } finally {
        session.unmount()
      }
    }
  )

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
