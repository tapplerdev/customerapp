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
  expectClassFree,
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestOptions,
} from "testing/harvest"

/*
 * OfferUpdateCard as its one call site draws it (MessageComponent:245, the
 * pro's revised price as an incoming bubble: the old rate struck through, the
 * new one in emphasis), over a rise and a fall, with and without the message
 * time. The tail corner and the arrow follow the language. The kit, for
 * i18next.
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/OfferUpdateCard.cases.json. The trees in __parity__
 * were captured from the component before its conversion (each case names
 * the commit).
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

const load = () => require("../OfferUpdateCard")

const FILES = harvestFilesFor(__dirname, "OfferUpdateCard")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("OfferUpdateCard"),
  props: {
    previous: "any",
    next: "any",
    time: "any",
  },
}

/** What the call site's `offerUpdate` and `time` can be. */
const UPDATES = [
  { name: "a rise, with time", previous: 450, next: 500, time: "10:30 AM" },
  { name: "a fall, no time", previous: 500, next: 450, time: undefined },
  {
    name: "four digits, with time",
    previous: 1200,
    next: 1250,
    time: "9:05 PM",
  },
]

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "OfferUpdateCard", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)

  it("the cases hand it no class, no DmText and no ActionBtn", () => {
    expectClassFree(cases.cases)
  })

  const sets = Object.entries(cases.cases).flatMap(([id, entry]) =>
    UPDATES.map(({ name, ...values }) => ({
      name: `${id} ${name}`,
      props: {
        ...buildProps(entry.props, { opaque: () => undefined }),
        ...values,
      },
    }))
  )
  const rows = rowsByPlatform(sets, PARITY_MATRIX)

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
