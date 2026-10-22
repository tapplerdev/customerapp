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
 * Pick address, the combined search-and-map picker (USE_COMBINED_SEARCH_MAP
 * is true: the screen's two-page branch, its SafeAreaView and
 * AnimatedScrollView, never draws and is not reachable from a test). The
 * floating pill (a shadowed DropShadow, the placeholder that turns into the
 * resolved address, grey while detecting), the map host with its pin and
 * the my-location button (hidden while searching), Confirm (grey spinner
 * while it works) with the bottom gap that follows the inset, and the
 * search panel (empty, typed, loading, results, none). The map and the
 * search are driven the way the device drives them: the map host's region
 * callbacks, the input's focus and typing, HERE's answers by URL.
 */

const load = () => require("../PickAddressScreen")

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
const SECOND = {
  ...EGYPT,
  title: "Nile Corniche, Maadi",
  id: "here:af:2",
  address: { ...EGYPT.address, street: "Nile Corniche", houseNumber: "", label: "Nile Corniche, Maadi, Cairo, Egypt", city: "Maadi" },
  position: { lat: 29.96, lng: 31.25 },
}
const ABROAD = { ...EGYPT, address: { ...EGYPT.address, countryCode: "USA" } }

type Here = {
  reverse?: "loading" | unknown[]
  search?: "loading" | unknown[]
}
const hereFixtures = ({ reverse = [EGYPT], search = [EGYPT, SECOND] }: Here): HttpFixtures =>
  (key) => {
    const answer = key.includes("/revgeocode") ? reverse : key.includes("/discover") ? search : undefined
    if (answer === undefined) return undefined
    return answer === "loading" ? "loading" : { json: { items: answer } }
  }

const optionsFor = (
  env: ParityEnv,
  here: Here = {},
  extra: { insets?: object; location?: object } = {}
) => ({
  ...screenState("data"),
  lang: env.language,
  platform: env.platform ?? "ios",
  route: { name: "PickAddressScreen" },
  http: hereFixtures(here),
  ...extra,
})

const REGION = {
  latitude: 30.05,
  longitude: 31.24,
  latitudeDelta: 0.004,
  longitudeDelta: 0.002,
}
const moving: Step = (root) => fireHost(root, "MapView", "onRegionChange", [REGION])
const settled: Step = (root) =>
  fireHost(root, "MapView", "onRegionChangeComplete", [REGION, { isGesture: false }])
const focusSearch: Step = (root) => fireHost(root, "TextInput", "onFocus")
const search = (text: string): Step => (root) => typeInto(root, 0, text)
const confirm: Step = (root, env) => pressTitled(root, copy(env, "confirm_my_location"))

// Confirm is an ActionBtn turned into a ds Button by the conversion: Button's
// own height and accessibility props, on the rows that draw it (the search
// panel, which covers it, is the rows that start with "search").
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

type Case = {
  label: string
  here?: Here
  extra?: { insets?: object; location?: object }
  steps?: Step[]
}
const CASES: Case[] = [
  { label: "as opened" },
  { label: "as opened, no home indicator", extra: { insets: { top: 20, bottom: 0 } } },
  { label: "pin moving: detecting the location", steps: [moving] },
  { label: "pin settled: the address in the pill", steps: [moving, settled, wait(700)] },
  { label: "search opened", steps: [focusSearch] },
  { label: "search: two letters (a spinner)", steps: [focusSearch, search("Ta")] },
  { label: "search: results pending", here: { search: "loading" }, steps: [focusSearch, search("Tahrir Sq")] },
  { label: "search: two results", steps: [focusSearch, search("Tahrir Sq"), wait(700)] },
  { label: "search: nothing found", here: { search: [] }, steps: [focusSearch, search("Zzzz Qqqq"), wait(700)] },
  {
    label: "the second result picked: the pill shows it",
    steps: [focusSearch, search("Tahrir Sq"), wait(700), (root) => pressText(root, SECOND.title)],
  },
  { label: "confirm pending", here: { reverse: "loading" }, steps: [confirm] },
]

describe("PickAddressScreen", () => {
  it.each(rowsByPlatform(CASES, PARITY_MATRIX))(
    "$label [$env.language $env.platform]",
    async ({ label, here, extra, steps, env }) => {
      expectParity(
        parityName(label, env),
        await treeAfter(load, optionsFor(env, here, extra), env, steps),
        { allow: label.startsWith("search") ? undefined : BUTTON }
      )
    }
  )
})

describe("PickAddressScreen presses", () => {
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
      }, step.settleMs)
    }
  }

  it.each(envs)("Confirm resolves the pin's address, tells the bus and goes back [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      const { addressEventBus } = require("@tappler/shared/src/events/AddressBus")
      const picked: unknown[] = []
      addressEventBus.on("address:pick", (info: unknown) => picked.push(info))
      await run(session, env, [settled, confirm, wait(1000)])
      expect(picked).toEqual([
        {
          address: "12 Tahrir Street",
          city: "Dokki",
          governorate: "Giza",
          coords: { lat: 30.0444, lon: 31.2357 },
        },
      ])
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({ type: "GO_BACK" }),
      ])
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("Confirm outside Egypt alerts and does not leave [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env, { reverse: [ABROAD] }))
    try {
      const { Alert } = require("react-native")
      const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined)
      await run(session, env, [confirm, wait(1000)])
      expect(alert).toHaveBeenCalledWith(copy(env, "your_location_is_outside"))
      expect(session.navigation.actions).toEqual([])
      alert.mockRestore()
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("the cross clears the text, then leaves the search, then closes the screen [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(load, optionsFor(env))
    try {
      const opened = JSON.stringify(session.tree())
      await run(session, env, [focusSearch])
      const searching = JSON.stringify(session.tree())
      expect(searching).not.toBe(opened)
      await run(session, env, [search("Tahrir Sq"), wait(700)])
      const typed = JSON.stringify(session.tree())
      const cross: Step = (root) => pressIcon(root, { icon: "svg:close" })
      await run(session, env, [cross])
      const cleared = JSON.stringify(session.tree())
      expect(cleared).not.toBe(typed)
      expect(cleared).toBe(searching)
      await run(session, env, [cross])
      expect(JSON.stringify(session.tree())).toBe(opened)
      expect(session.navigation.actions).toEqual([])
      await run(session, env, [cross])
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({ type: "GO_BACK" }),
      ])
    } finally {
      session.unmount()
    }
  })

  it.each(envs)("Use current location leaves the search; the map button needs a fix [$env.language $env.platform]", async ({ env }) => {
    const session = await openScreen(
      load,
      optionsFor(env, {}, { location: { latitude: 30.06, longitude: 31.22 } })
    )
    try {
      const opened = JSON.stringify(session.tree())
      await run(session, env, [focusSearch])
      expect(JSON.stringify(session.tree())).not.toBe(opened)
      await run(session, env, [(root) => pressText(root, copy(env, "use_current_location"))])
      expect(JSON.stringify(session.tree())).toBe(opened)
      // The map button asks for the fix (it never moves a mock map).
      await run(session, env, [(root) => pressIcon(root, { icon: "svg:my-location-red" })])
      expect(JSON.stringify(session.tree())).toBe(opened)
    } finally {
      session.unmount()
    }
  })
})
