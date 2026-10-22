/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressTitled,
  rowsByPlatform,
  treeAfter,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { ADDRESS } from "testing/screenKit/fixtures/routes"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * The "Save this address?" sheet: the title row, the description, the
 * address card (street, then "city, governorate" when there is one) and the
 * two buttons (No thanks outlined, Save red). No address draws the card empty
 * and Save does nothing.
 */

const load = () => require("../SaveAddressSheetScreen")

const STREET_ONLY = { ...ADDRESS, city: "", governorate: "" }
const NO_CITY = { ...ADDRESS, city: "" }

const optionsFor = (env: ParityEnv, address: object | null = ADDRESS) => ({
  ...screenState("data"),
  lang: env.language,
  platform: env.platform ?? "ios",
  route: { name: "SaveAddressSheetScreen", params: { address: address ?? undefined } },
})

// No thanks and Save are ActionBtns turned into ds Buttons by the conversion:
// Button's own height and accessibility props, on every row.
const BUTTONS: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const CASES: { label: string; address?: object | null }[] = [
  { label: "an address with city and governorate" },
  { label: "street only", address: STREET_ONLY },
  { label: "governorate only", address: NO_CITY },
  { label: "no address", address: null },
]

describe("SaveAddressSheetScreen", () => {
  it.each(rowsByPlatform(CASES, PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ label, address, env }) => {
      expectParity(
        parityName(label, env),
        await treeAfter(load, optionsFor(env, address), env),
        { allow: BUTTONS }
      )
    }
  )
})

describe("SaveAddressSheetScreen presses", () => {
  const envs = rowsByPlatform([{}], PARITY_MATRIX)

  it.each(envs)("No thanks goes back [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      await session.act(() => {
        pressTitled(session.root, copy(env, "no_thanks"))
      })
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({ type: "GO_BACK" }),
      ])
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("Save replaces the sheet with the form, carrying the address [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      await session.act(() => {
        pressTitled(session.root, copy(env, "save"))
      })
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({
          type: "REPLACE",
          payload: expect.objectContaining({
            name: "AddNewAddressScreen",
            params: {
              address: ADDRESS.address,
              city: ADDRESS.city,
              governorate: ADDRESS.governorate,
              coords: ADDRESS.coords,
              fromSuccess: true,
            },
          }),
        }),
      ])
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("Save without an address does nothing [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env, null))
    try {
      await session.act(() => {
        pressTitled(session.root, copy(env, "save"))
      })
      expect(session.navigation.actions).toEqual([])
    } finally {
      session.unmount()
    }
  })
})
