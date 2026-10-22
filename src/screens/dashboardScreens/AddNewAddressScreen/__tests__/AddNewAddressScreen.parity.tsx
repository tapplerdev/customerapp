/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  typeInto,
  type Step,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { SAVED_HOME } from "testing/screenKit/fixtures/users"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * Add new address: four underlined fields (placeholders when empty), the
 * place-type chips (red when picked, outlined otherwise, in the language's
 * own words) and Add address, grey while a field or the type is missing, red
 * when filled, a spinner while it saves. The form opens prefilled from the
 * map picker's params, or empty. Typed and picked states are reached by
 * typing and pressing.
 */

const load = () => require("../AddNewAddressScreen")

const base = screenState("data")
const optionsFor = (
  env: ParityEnv,
  params: object | undefined = ROUTE_PARAMS.AddNewAddressScreen,
  answer: "pending" | "accepted" | "refused" = "pending"
) => ({
  ...base,
  api: {
    ...base.api,
    createCustomerAddress:
      answer === "pending"
        ? ("loading" as const)
        : answer === "accepted"
          ? { data: SAVED_HOME }
          : { error: { status: 400, data: { message: "no" } } },
  },
  lang: env.language,
  platform: env.platform ?? "ios",
  route: { name: "AddNewAddressScreen", params },
})

const type = (index: number, text: string): Step => (root) =>
  typeInto(root, index, text)
const chip =
  (en: string, ar: string): Step =>
  (root, env) =>
    pressText(root, env.language === "ar" ? ar : en)
const flat = chip("Flat", "شقة")
const villa = chip("Villa", "فيلا")
const office = chip("Office", "مكتب")
const add: Step = (root, env) => pressTitled(root, copy(env, "add_address"))

const TYPED = [
  type(0, "Mum's flat"),
  type(1, "5 Corniche Road"),
  type(2, "Maadi"),
  type(3, "Cairo"),
]

type Case = { label: string; params?: object | null; steps?: Step[] }
const CASES: Case[] = [
  { label: "prefilled from the picker, no type" },
  { label: "empty form", params: {} },
  { label: "prefilled, Flat picked", steps: [flat] },
  { label: "prefilled, Villa then Office picked", steps: [villa, office] },
  { label: "empty form, nickname typed", params: {}, steps: [type(0, "Mum's flat")] },
  { label: "empty form, typed in full, no type", params: {}, steps: TYPED },
  { label: "empty form, typed in full, Flat picked", params: {}, steps: [...TYPED, flat] },
  { label: "saving", params: {}, steps: [...TYPED, flat, add] },
]

describe("AddNewAddressScreen", () => {
  it.each(rowsByPlatform(CASES, PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ label, params, steps, env }) => {
      expectParity(
        parityName(label, env),
        await treeAfter(
          load,
          optionsFor(env, params === null ? undefined : params),
          env,
          steps
        )
      )
    }
  )
})

describe("AddNewAddressScreen presses", () => {
  const envs = rowsByPlatform([{}], PARITY_MATRIX)
  const run = async (
    session: Awaited<ReturnType<typeof openScreen>>,
    env: ParityEnv,
    steps: Step[]
  ) => {
    for (const step of steps) {
      // eslint-disable-next-line no-await-in-loop
      await session.act(() => {
        step(session.root, env)
      })
    }
  }

  it.each(envs)("Add is refused until every field and a type are set [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      expect(() => pressTitled(session.root, copy(env, "add_address"))).toThrow()
      await run(session, env, [type(0, "Home 2")])
      expect(() => pressTitled(session.root, copy(env, "add_address"))).toThrow()
      await run(session, env, [villa])
      // Nickname, the picker's address, city, governorate and a type: filled.
      await run(session, env, [add])
      const sent = session.requests().filter((r) => r.endpoint === "createCustomerAddress")
      expect(sent).toHaveLength(1)
      expect((sent[0].args as { body: unknown }).body).toEqual({
        name: "Home 2",
        type: "villa",
        streetAddress: ROUTE_PARAMS.AddNewAddressScreen?.address,
        city: ROUTE_PARAMS.AddNewAddressScreen?.city,
        governorate: ROUTE_PARAMS.AddNewAddressScreen?.governorate,
        location: {
          lat: ROUTE_PARAMS.AddNewAddressScreen?.coords?.lat,
          lng: ROUTE_PARAMS.AddNewAddressScreen?.coords?.lon,
        },
      })
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("a saved address goes back, or resets to Talabati from the success screen [$env.language $env.platform]", async ({ env }) => {
    const back = await openScreen(load, optionsFor(env, ROUTE_PARAMS.AddNewAddressScreen, "accepted"))
    try {
      await run(back, env, [type(0, "Home 2"), flat, add])
      expect(back.navigation.actions).toEqual([
        expect.objectContaining({ type: "GO_BACK" }),
      ])
    } finally {
      back.unmount()
    }
    const reset = await openScreen(
      load,
      optionsFor(env, { ...ROUTE_PARAMS.AddNewAddressScreen, fromSuccess: true }, "accepted")
    )
    try {
      await run(reset, env, [type(0, "Home 2"), flat, add])
      expect(reset.navigation.actions).toEqual([
        expect.objectContaining({
          type: "RESET",
          payload: expect.objectContaining({
            routes: [
              expect.objectContaining({
                name: "HomeTabs",
                params: { screen: "talabati" },
              }),
            ],
          }),
        }),
      ])
    } finally {
      reset.unmount()
    }
  })

  it.each(envs)("a refused save leaves the form as it was [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env, ROUTE_PARAMS.AddNewAddressScreen, "refused"))
    try {
      await run(session, env, [type(0, "Home 2"), flat])
      const before = JSON.stringify(session.tree())
      await run(session, env, [add])
      expect(session.requests().filter((r) => r.endpoint === "createCustomerAddress")).toHaveLength(1)
      expect(JSON.stringify(session.tree())).toBe(before)
      expect(session.navigation.actions).toEqual([])
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("the chevron goes back, or resets from the success screen [$env.language $env.platform]", async ({ env }) => {
    const back = await openScreen(load, optionsFor(env))
    try {
      await back.act(() => {
        pressIcon(back.root, { icon: "svg:chevron-left" })
      })
      expect(back.navigation.actions).toEqual([
        expect.objectContaining({ type: "GO_BACK" }),
      ])
    } finally {
      back.unmount()
    }
    const reset = await openScreen(
      load,
      optionsFor(env, { ...ROUTE_PARAMS.AddNewAddressScreen, fromSuccess: true })
    )
    try {
      await reset.act(() => {
        pressIcon(reset.root, { icon: "svg:chevron-left" })
      })
      expect(reset.navigation.actions).toEqual([
        expect.objectContaining({ type: "RESET" }),
      ])
    } finally {
      reset.unmount()
    }
  })
})
