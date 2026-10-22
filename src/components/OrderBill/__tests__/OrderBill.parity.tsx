/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, it } from "@jest/globals"
import path from "path"

import { renderScreen, rowsByPlatform } from "testing/screenKit"
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

import { HAND_CASES, JOBS } from "../__fixtures__/OrderBill.handCases"

/*
 * OrderBill's class-name path, pinned to what it drew before its conversion,
 * for the prop set its one call site hands it (MessagesDetailsScreen:858,
 * delivery and pickup, with the screen's `rtlText`, where the `className` it
 * once passed drew nothing and went in W1's prep) over each bill the
 * component draws (JOBS), plus the classes a caller could still pass
 * (OrderBill.handCases.tsx).
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/OrderBill.cases.json. The kit, for the store's
 * `formatMoney` and i18next. The trees in __parity__ were captured from
 * the component before its conversion (each case names the commit).
 *
 * OrderBill.twins.parity.tsx draws the same cases through the twins the
 * codemod writes, against these same trees.
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

const load = () => {
  // The classes in the hand cases compile in this registry.
  require("../__fixtures__/OrderBill.handCases")
  return require("../OrderBill")
}

const FILES = harvestFilesFor(__dirname, "OrderBill")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("OrderBill"),
  props: {
    job: "any",
    isPickup: "bool",
    textStyle: "any",
    className: "class",
  },
}

/** The screen's `rtlText`, the one `textStyle` a caller hands it. */
const RTL_TEXT = { textAlign: "left" }

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases (and an empty classes file)", () => {
      writeHarvest(FILES, "OrderBill", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)
  const sets = Object.entries(cases.cases).flatMap(([id, entry]) =>
    Object.keys(JOBS).map((job) => ({
      name: `${id} ${job}`,
      props: {
        ...buildProps(entry.props, { opaque: () => RTL_TEXT }),
        job: JOBS[job],
      },
    }))
  )
  const hand = HAND_CASES.map(({ name, props }) => ({
    name,
    props: { ...props, job: JOBS[props.job] },
  }))
  const rows = rowsByPlatform([...sets, ...hand], PARITY_MATRIX)

  describe("the class-name path draws as before", () => {
    it.each(rows)("$name [$env.language $env.platform]", async (row) => {
      const tree = await renderScreen(load, {
        lang: row.env.language,
        platform: row.env.platform,
        navigation: "none",
        props: row.props,
      })
      expectParity(parityName(row.name, row.env), tree)
    })
  })
}
