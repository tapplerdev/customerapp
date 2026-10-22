import { describe, it } from "@jest/globals"
import path from "path"

/*
 * AddressSelectionModal (the service address sheet), pinned to what it drew
 * before its conversion, for every prop set its call sites hand it: for a
 * signed-in customer (their two saved addresses, with the last-used address
 * among them, elsewhere, or none; still loading) and for a guest (a last-used
 * address with and without its city, or no location).
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/AddressSelectionModal.cases.json; the sites pass no
 * class names. The sheet is the kit's stand-in for the native sheet. The
 * trees in __parity__ were captured from AddressSelectionModal before its
 * conversion (each case names the commit). Both languages, both platforms.
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest (writes the cases)
 *   yarn ds:parity:capture <this file> --force                recapture, on the old code only
 */

/* eslint-disable import/first */
import { renderScreen, rowsByPlatform } from "testing/screenKit"
import {
  PARITY_MATRIX,
  captureCommit,
  expectParity,
  parityName,
} from "testing/hostTreeParity"
import {
  componentImport,
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestedCase,
  type HarvestOptions,
} from "testing/harvest"
import { guestState, screenState } from "testing/screenKit/states"
import { GUEST_LOCATION } from "testing/screenKit/fixtures/users"
/* eslint-enable import/first */

const FILES = harvestFilesFor(__dirname, "AddressSelectionModal")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("AddressSelectionModal"),
  props: {
    isVisible: "bool",
    onClose: "fn",
    onSelectAddress: "fn",
    onSelectNewLocation: "fn",
    onViewAllAddresses: "fn",
  },
}

/** Who is choosing: a signed-in customer (two saved addresses), a guest, with and without a last-used address. */
const SIGNED_IN = screenState("data")
const GUEST = guestState("data")
const GUEST_ADDRESS = GUEST_LOCATION!.address!
const VARIANTS: Record<string, Record<string, unknown>> = {
  "signed in, saved addresses": SIGNED_IN,
  "signed in, last used is a saved one": {
    ...SIGNED_IN,
    state: { auth: { ...SIGNED_IN.state.auth, guestLocation: GUEST_LOCATION } },
  },
  "signed in, last used elsewhere": {
    ...SIGNED_IN,
    state: {
      auth: {
        ...SIGNED_IN.state.auth,
        guestLocation: {
          coords: { lat: 29.9792, lng: 31.1342 },
          address: {
            address: "The Pyramids Road",
            city: "Giza",
            governorate: "Giza",
            coords: { lat: 29.9792, lon: 31.1342 },
          },
        },
      },
    },
  },
  "signed in, loading": { state: SIGNED_IN.state, api: {} },
  "guest, last used": GUEST,
  "guest, last used without a city": {
    ...GUEST,
    state: {
      auth: {
        ...GUEST.state.auth,
        guestLocation: {
          coords: GUEST_LOCATION!.coords,
          address: {
            ...GUEST_ADDRESS,
            city: undefined,
            governorate: undefined,
          },
        },
      },
    },
  },
  "guest, no location": {
    ...GUEST,
    state: {
      auth: {
        ...GUEST.state.auth,
        guestLocation: { coords: null, address: null },
      },
    },
  },
}

/** A row's component, loaded in the row's own registry (the kit's rule). */
const loaderFor =
  (entry: HarvestedCase, variant = "") =>
  () => {
    /* eslint-disable global-require, @typescript-eslint/no-var-requires */
    const React = require("react") as typeof import("react")
    const { buildProps } =
      require("testing/harvest") as typeof import("testing/harvest")
    const Component = require("../AddressSelectionModal").default
    /* eslint-enable global-require, @typescript-eslint/no-var-requires */
    const Harness = () =>
      React.createElement(Component, buildProps(entry.props, {}))
    return { default: Harness }
  }

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "AddressSelectionModal", OPTIONS, captureCommit())
    })
  })
} else {
  const harvested = readHarvest(FILES)
  const cases: Record<string, HarvestedCase> = harvested.cases
  const rows = rowsByPlatform(
    Object.entries(cases).flatMap(([id, entry]) =>
      Object.keys(VARIANTS).map((variant) => ({
        id: `${id} ${variant}`,
        site: entry.sites[0],
        entry,
        variant,
      }))
    ),
    PARITY_MATRIX
  )
  describe("AddressSelectionModal draws as before", () => {
    it.each(rows)("$id ($site) [$env.language $env.platform]", async (row) => {
      const { id, entry, env } = row
      const tree = await renderScreen(loaderFor(entry, row.variant), {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
        ...VARIANTS[row.variant],
      })
      expectParity(parityName(id, env), tree)
    })
  })
}
