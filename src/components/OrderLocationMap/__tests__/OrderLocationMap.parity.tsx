/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, it } from "@jest/globals"
import path from "path"

import { renderScreen, rowsByPlatform } from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { POINT_AREAS } from "testing/screenKit/fixtures/entities"
import {
  PARITY_MATRIX,
  captureCommit,
  expectParity,
  parityName,
} from "testing/hostTreeParity"
import {
  buildProps,
  componentImport,
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestOptions,
} from "testing/harvest"

/*
 * OrderLocationMap as its two call sites draw it (FoodOrderReviewScreen:155,
 * RequestDetailsScreen:167: `coords` and `isPickup`), over what the area
 * queries answer: a delivery pin (no query), a pickup still resolving its
 * area (the held-height strip, the one class here), the area known and its
 * outline loading, and the outline drawn; and no coordinates at all. The kit,
 * for the store, the queries and the map.
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/OrderLocationMap.cases.json. The trees in
 * __parity__ were captured from the component before its conversion (each
 * case names the commit).
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

const load = () => require("../OrderLocationMap")

const FILES = harvestFilesFor(__dirname, "OrderLocationMap")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("OrderLocationMap"),
  props: {
    coords: "any",
    isPickup: "bool",
  },
}

const COORDS = { lat: 30.0444, lon: 31.2357 }
const DATA = screenState("data").api
// The kit's point answers an "area", which isn't drawn (only a subArea or a
// bigArea is): the outline scenes answer a subArea.
const SUB_AREA = {
  data: {
    ...POINT_AREAS,
    area: { ...POINT_AREAS.area, type: "subArea" },
  },
}

/** What the call sites' `mapCoords` is, and what the two queries answer. */
const SCENES: {
  name: string
  coords: typeof COORDS | null
  api: Record<string, unknown>
}[] = [
  {
    name: "outline drawn",
    coords: COORDS,
    api: { ...DATA, getPointAreas: SUB_AREA },
  },
  { name: "area not drawn", coords: COORDS, api: DATA },
  {
    name: "area resolving",
    coords: COORDS,
    api: { ...DATA, getPointAreas: "loading" },
  },
  {
    name: "outline loading",
    coords: COORDS,
    api: { ...DATA, getPointAreas: SUB_AREA, getAreaGeometry: "loading" },
  },
  { name: "no coordinates", coords: null, api: DATA },
]

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases (and an empty classes file)", () => {
      writeHarvest(FILES, "OrderLocationMap", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)
  const sets = Object.entries(cases.cases).flatMap(([id, entry]) =>
    SCENES.map(({ name, coords, api }) => ({
      name: `${id} ${entry.props.isPickup ? "pickup" : "delivery"}, ${name}`,
      api,
      props: {
        ...buildProps(entry.props, { opaque: () => undefined }),
        coords,
      },
    }))
  )
  const rows = rowsByPlatform(sets, PARITY_MATRIX)

  describe("the class-name path draws as before", () => {
    it.each(rows)("$name [$env.language $env.platform]", async (row) => {
      const tree = await renderScreen(load, {
        ...screenState("data"),
        api: row.api as never,
        lang: row.env.language,
        platform: row.env.platform,
        navigation: "none",
        props: row.props,
      })
      expectParity(parityName(row.name, row.env), tree)
    })
  })
}
