/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import {
  copy,
  fireHost,
  openScreen,
  pressIcon,
  pressText,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  typeInto,
  wait,
  type HttpFixtures,
  type Step,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * The two-page flow's pages, SearchView and MapPickerView. PickAddressScreen
 * stopped drawing them when USE_COMBINED_SEARCH_MAP went true (nothing else
 * imports them), but they are still S4's files and still carry classes, so
 * each is rendered bare (`navigation: "none"`, its props handed in) and
 * driven the way the screen drove it.
 */

const SEARCH = () => require("../components/SearchView")
const MAP = () => require("../components/MapPickerView")

const EGYPT = {
  title: "12 Tahrir Street",
  id: "here:af:1",
  language: "en",
  resultType: "houseNumber",
  houseNumberType: "PA",
  address: {
    label: "12 Tahrir Street, Dokki, Giza, Egypt",
    countryCode: "EGY",
    countryName: "Egypt",
    county: "Giza",
    city: "Dokki",
    district: "Dokki",
    state: "Giza Governorate",
    street: "Tahrir Street",
    postalCode: "12311",
    houseNumber: "12",
  },
  position: { lat: 30.0444, lng: 31.2357 },
  access: [],
  distance: 0,
  mapView: { west: 31.2, south: 30, east: 31.3, north: 30.1 },
}
const SECOND = { ...EGYPT, title: "Nile Corniche, Maadi", id: "here:af:2", position: { lat: 29.96, lng: 31.25 } }

type Here = { reverse?: "loading" | unknown[]; search?: "loading" | unknown[] }
const hereFixtures =
  ({ reverse = [EGYPT], search = [EGYPT, SECOND] }: Here): HttpFixtures =>
  (key) => {
    const answer = key.includes("/revgeocode")
      ? reverse
      : key.includes("/discover")
        ? search
        : undefined
    if (answer === undefined) return undefined
    return answer === "loading" ? "loading" : { json: { items: answer } }
  }

const optionsFor = (
  env: ParityEnv,
  props: Record<string, unknown>,
  here: Here = {},
  location?: object
) => ({
  ...screenState("data"),
  lang: env.language,
  platform: env.platform ?? "ios",
  navigation: "none" as const,
  props,
  http: hereFixtures(here),
  ...(location ? { location } : {}),
})

const POSITION = { lat: 30.0444, lng: 31.2357 }
const REGION = { latitude: 30.05, longitude: 31.24, latitudeDelta: 0.005, longitudeDelta: 0.0025 }

const type = (text: string): Step => (root) => typeInto(root, 0, text)

describe("SearchView", () => {
  const props = () => ({ onClose: () => undefined, onLocationSelect: () => undefined })
  type Case = { label: string; here?: Here; steps?: Step[] }
  const CASES: Case[] = [
    { label: "as opened: use current location" },
    { label: "two letters typed (a spinner)", steps: [type("Ta")] },
    { label: "results pending", here: { search: "loading" }, steps: [type("Tahrir Sq")] },
    { label: "two results", steps: [type("Tahrir Sq"), wait(700)] },
    { label: "nothing found", here: { search: [] }, steps: [type("Zzzz Qqqq"), wait(700)] },
  ]
  it.each(rowsByPlatform(CASES, PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ label, here, steps, env }) => {
      expectParity(
        parityName(label, env),
        await treeAfter(SEARCH, optionsFor(env, props(), here), env, steps)
      )
    }
  )

  it.each(rowsByPlatform([{}], PARITY_MATRIX))(
    "a result, the cross and Use current location are pressed [$env.language $env.platform]",
    async ({ env }) => {
      const onClose = jest.fn()
      const onLocationSelect = jest.fn()
      const session = await openScreen(
        SEARCH,
        optionsFor(env, { onClose, onLocationSelect }, {}, { latitude: 30.06, longitude: 31.22 })
      )
      try {
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:close" })
        })
        expect(onClose).toHaveBeenCalledTimes(1)
        await session.act(() => {
          pressText(session.root, copy(env, "use_current_location"))
        }, 1000)
        expect(onLocationSelect).toHaveBeenCalledTimes(1)
        expect(onLocationSelect.mock.calls[0][1]).toEqual(EGYPT)
        onLocationSelect.mockClear()
        await session.act(() => {
          type("Tahrir Sq")(session.root, env)
        }, 1000)
        await session.act(() => {
          pressText(session.root, SECOND.title)
        })
        expect(onLocationSelect).toHaveBeenCalledWith(SECOND.position, SECOND)
      } finally {
        session.unmount()
      }
    }
  )
})

// MapPickerView's Confirm is an ActionBtn turned into a ds Button by the
// conversion: Button's own height and accessibility props, on every row.
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

describe("MapPickerView", () => {
  const props = (initPosition: object | null = POSITION) => ({
    initPosition: initPosition ?? undefined,
    onClose: () => undefined,
    onSelectedAddress: () => undefined,
  })
  const confirm: Step = (root, env) => pressTitled(root, copy(env, "confirm_my_location"))
  type Case = { label: string; position?: object | null; here?: Here; steps?: Step[] }
  const CASES: Case[] = [
    { label: "as opened: the pin's hint" },
    { label: "no position yet: only Confirm", position: null },
    {
      label: "the map settled: the hint goes",
      steps: [(root) => fireHost(root, "MapView", "onRegionChangeComplete", [REGION, {}])],
    },
    { label: "confirm pending", here: { reverse: "loading" }, steps: [confirm] },
  ]
  it.each(rowsByPlatform(CASES, PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ label, position, here, steps, env }) => {
      expectParity(
        parityName(label, env),
        await treeAfter(
          MAP,
          optionsFor(env, props(position), here),
          env,
          steps
        ),
        { allow: BUTTON }
      )
    }
  )

  it.each(rowsByPlatform([{}], PARITY_MATRIX))(
    "Confirm hands the resolved address over; the cross closes; the map button asks for the fix [$env.language $env.platform]",
    async ({ env }) => {
      const onClose = jest.fn()
      const onSelectedAddress = jest.fn()
      const session = await openScreen(
        MAP,
        optionsFor(env, { initPosition: POSITION, onClose, onSelectedAddress })
      )
      try {
        await session.act(() => {
          confirm(session.root, env)
        }, 1000)
        expect(onSelectedAddress).toHaveBeenCalledWith(EGYPT)
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:close" })
        })
        expect(onClose).toHaveBeenCalledTimes(1)
        const before = JSON.stringify(session.tree())
        const Geolocation = require("@react-native-community/geolocation").default
        const asked = jest.spyOn(Geolocation, "getCurrentPosition")
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:my-location-red" })
        })
        expect(asked).toHaveBeenCalledTimes(1)
        expect(JSON.stringify(session.tree())).toBe(before)
        asked.mockRestore()
      } finally {
        session.unmount()
      }
    }
  )
})
