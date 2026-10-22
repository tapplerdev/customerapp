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
  type Step,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * View address: the name in the header and the field, four read-only rows
 * (a dash for a missing value), the Delete link and its confirmation card
 * (MainModal: icon, title, Yes and No, the screen's class-styled title,
 * buttons, wrapper and card), and Yes while the delete is in flight.
 */

const load = () => require("../ViewAddressScreen")

const COMPLETE = ROUTE_PARAMS.ViewAddressScreen as object
const BARE = {
  addressId: 777,
  name: "Cottage",
  streetAddress: "",
  city: "",
  governorate: "",
  type: "",
}
const LONG_NAME = {
  ...COMPLETE,
  name: "My mother's second flat near the Nile, fourth floor",
}

const base = screenState("data")
const optionsFor = (
  env: ParityEnv,
  params: object = COMPLETE,
  answer: "pending" | "accepted" | "refused" = "pending"
) => ({
  ...base,
  api: {
    ...base.api,
    deleteCustomerAddress:
      answer === "pending"
        ? ("loading" as const)
        : answer === "accepted"
          ? { data: {} }
          : { error: { status: 500, data: { message: "no" } } },
  },
  lang: env.language,
  platform: env.platform ?? "ios",
  route: { name: "ViewAddressScreen", params },
})

const askDelete: Step = (root, env) => pressText(root, copy(env, "delete"))
const yes: Step = (root, env) => pressTitled(root, copy(env, "yes"))
const no: Step = (root, env) => pressTitled(root, copy(env, "no"))

const CASES: { label: string; params?: object; steps?: Step[] }[] = [
  { label: "as opened" },
  { label: "missing values draw dashes", params: BARE },
  { label: "a long name", params: LONG_NAME },
  { label: "delete asked", steps: [askDelete] },
  { label: "delete confirmed, in flight", steps: [askDelete, yes] },
]

describe("ViewAddressScreen", () => {
  it.each(rowsByPlatform(CASES, PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ label, params, steps, env }) => {
      expectParity(
        parityName(label, env),
        await treeAfter(load, optionsFor(env, params), env, steps)
      )
    }
  )
})

describe("ViewAddressScreen presses", () => {
  const envs = rowsByPlatform([{}], PARITY_MATRIX)
  const card = (session: Awaited<ReturnType<typeof openScreen>>) =>
    session.root.findAll(
      (node) =>
        typeof node.type !== "string" &&
        "isVisible" in node.props &&
        "isBtnsTwo" in node.props
    )[0].props
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

  it.each(envs)("Delete asks, No closes the card [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      expect(card(session).isVisible).toBe(false)
      await run(session, env, [askDelete])
      expect(card(session).isVisible).toBe(true)
      await run(session, env, [no])
      expect(card(session).isVisible).toBe(false)
      expect(session.requests().filter((r) => r.type === "mutation")).toEqual([])
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("Yes deletes this address and goes back [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env, COMPLETE, "accepted"))
    try {
      await run(session, env, [askDelete, yes])
      const sent = session.requests().filter((r) => r.endpoint === "deleteCustomerAddress")
      expect(sent).toHaveLength(1)
      expect(JSON.stringify(sent[0].args)).toContain(
        String((COMPLETE as { addressId: number }).addressId)
      )
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({ type: "GO_BACK" }),
      ])
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("a refused delete keeps the card and stays [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env, COMPLETE, "refused"))
    try {
      await run(session, env, [askDelete, yes])
      expect(card(session).isVisible).toBe(true)
      expect(session.navigation.actions).toEqual([])
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("the chevron goes back [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
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
  })
})
