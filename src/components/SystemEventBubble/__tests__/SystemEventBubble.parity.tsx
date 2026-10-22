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

/*
 * SystemEventBubble as its one call site draws it (MessageComponent:224:
 * either side, either tone), over the two kinds of event key (an alert, a
 * food-progress step) and with and without the time line. The tail corner
 * follows the side and the language, so the four languages and platforms all
 * count. The kit, for i18next.
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/SystemEventBubble.cases.json. The trees in
 * __parity__ were captured from the component before its conversion (each
 * case names the commit).
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

const load = () => require("../SystemEventBubble")

const FILES = harvestFilesFor(__dirname, "SystemEventBubble")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("SystemEventBubble"),
  props: {
    textKey: "any",
    time: "any",
    incoming: "bool",
    tone: "value",
  },
}

/** What the call site's `eventTextKey` and `time` can be. */
const EVENTS = [
  { name: "alert key, with time", textKey: "job_expired", time: "10:30 AM" },
  { name: "alert key, no time", textKey: "job_expired", time: undefined },
  {
    name: "progress key, with time",
    textKey: "food_order_preparing",
    time: "10:30 AM",
  },
]

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases (and an empty classes file)", () => {
      writeHarvest(FILES, "SystemEventBubble", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)
  const sets = Object.entries(cases.cases).flatMap(([id, entry]) =>
    EVENTS.map(({ name, textKey, time }) => ({
      name: `${id} ${name}`,
      props: {
        ...buildProps(entry.props, { opaque: () => undefined }),
        textKey,
        time,
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
