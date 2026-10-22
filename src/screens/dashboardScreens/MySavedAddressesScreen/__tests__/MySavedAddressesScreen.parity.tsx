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
import { CUSTOMER, SAVED_HOME, SAVED_WORK } from "testing/screenKit/fixtures/users"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * My saved addresses: the cards (name, street, "city, governorate", the
 * chevron that turns in Arabic), the empty line, the Add row. A loading or
 * failed list draws the empty line, and a sparse address (no street, no city,
 * no governorate) a card with fewer lines. Selection mode draws the data tree
 * and acts differently, so its handler is pressed in the second block.
 */

const load = () => require("../MySavedAddressesScreen")

const SPARSE = {
  id: 503,
  name: "Cottage",
  type: "",
  address: {
    city: "",
    governorate: "",
    location: { lat: 30.1, lng: 31.3 },
  },
}
const ONLY_GOVERNORATE = {
  id: 504,
  name: "Farm",
  type: "other",
  address: {
    streetAddress: "Km 12 Desert Road",
    city: "",
    governorate: "Giza",
    location: { lat: 30.2, lng: 31.1 },
  },
}

const base = screenState("data")
const withAddresses = (addresses: unknown[]) => ({
  ...base,
  api: { ...base.api, getCustomerMe: { data: { ...CUSTOMER, addresses } } },
})

const STATES = {
  data: base,
  empty: withAddresses([]),
  sparse: withAddresses([SPARSE, ONLY_GOVERNORATE, SAVED_HOME]),
}
type StateName = keyof typeof STATES

const optionsFor = (
  env: ParityEnv,
  state: StateName = "data",
  selectionMode = false
) => ({
  ...STATES[state],
  lang: env.language,
  platform: env.platform ?? "ios",
  route: { name: "MySavedAddressesScreen", params: { selectionMode } },
})

// A loading or failed list draws the empty line, and selection mode draws the
// data tree (the compare dropped those rows: same tree as `empty` and `data`).
const CASES: { state: StateName; label: string; selectionMode?: boolean }[] = [
  { state: "data", label: "data" },
  { state: "empty", label: "empty" },
  { state: "sparse", label: "sparse addresses" },
]

describe("MySavedAddressesScreen", () => {
  it.each(rowsByPlatform(CASES, PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ state, label, selectionMode, env }) => {
      expectParity(
        parityName(label, env),
        await treeAfter(load, optionsFor(env, state, selectionMode), env)
      )
    }
  )
})

describe("MySavedAddressesScreen presses", () => {
  const envs = rowsByPlatform([{}], PARITY_MATRIX)

  it.each(envs)("a card opens the address [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      await session.act(() => {
        pressText(session.root, `${SAVED_WORK.name}${SAVED_WORK.address.streetAddress}${SAVED_WORK.address.city}, ${SAVED_WORK.address.governorate}`)
      })
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({
          type: "NAVIGATE",
          payload: expect.objectContaining({
            name: "ViewAddressScreen",
            params: expect.objectContaining({
              addressId: SAVED_WORK.id,
              name: SAVED_WORK.name,
              streetAddress: SAVED_WORK.address.streetAddress,
              city: SAVED_WORK.address.city,
              governorate: SAVED_WORK.address.governorate,
              type: SAVED_WORK.type,
            }),
          }),
        }),
      ])
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("in selection mode a card hands its address to the bus and goes back [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env, "data", true))
    try {
      const { addressEventBus } = require("@tappler/shared/src/events/AddressBus")
      const picked: unknown[] = []
      addressEventBus.on("address:select", (info: unknown) => picked.push(info))
      await session.act(() => {
        pressText(session.root, `${SAVED_HOME.name}${SAVED_HOME.address.streetAddress}${SAVED_HOME.address.city}, ${SAVED_HOME.address.governorate}`)
      })
      expect(picked).toEqual([
        {
          address: SAVED_HOME.address.streetAddress,
          city: SAVED_HOME.address.city,
          governorate: SAVED_HOME.address.governorate,
          coords: {
            lat: SAVED_HOME.address.location.lat,
            lon: SAVED_HOME.address.location.lng,
          },
          savedAddressId: SAVED_HOME.id,
        },
      ])
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({ type: "GO_BACK" }),
      ])
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("Add opens the picker; a picked address opens the form [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      const { addressEventBus } = require("@tappler/shared/src/events/AddressBus")
      await session.act(() => {
        pressText(session.root, `+${copy(env, "add_new_address")}`)
      })
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({
          type: "NAVIGATE",
          payload: expect.objectContaining({ name: "PickAddressScreen" }),
        }),
      ])
      await session.act(() => {
        addressEventBus.emit("address:pick", {
          address: "7 Nile Street",
          city: "Giza",
          governorate: "Giza",
          coords: { lat: 30, lon: 31 },
        })
      }, 1000)
      expect(session.navigation.actions[1]).toEqual(
        expect.objectContaining({
          type: "NAVIGATE",
          payload: expect.objectContaining({
            name: "AddNewAddressScreen",
            params: expect.objectContaining({ address: "7 Nile Street" }),
          }),
        })
      )
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
