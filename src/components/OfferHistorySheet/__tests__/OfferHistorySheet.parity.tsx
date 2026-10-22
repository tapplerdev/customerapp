/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, it } from "@jest/globals"
import path from "path"

import { renderScreen, rowsByPlatform } from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { HOURS_AGO } from "testing/screenKit/fixtures/entities"
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
 * OfferHistorySheet as its one call site draws it (MessagesDetailsScreen:1260:
 * the sheet behind the chat header's offer strip, shown and hidden), over what
 * the history query answers: still loading, one offer (current and the
 * first), three that rose and fell (the current chip, the deltas up and
 * down), three at the same rate (no delta, no first-offer label either), and
 * none. The sizes 9.5 and 10.5 (:110, :149) are in the rows with the current
 * chip and the first offer. The kit, for the sheet, the store and the query.
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/OfferHistorySheet.cases.json. The trees in
 * __parity__ were captured from the component before its conversion (each
 * case names the commit).
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

const load = () => require("../OfferHistorySheet")

const FILES = harvestFilesFor(__dirname, "OfferHistorySheet")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("OfferHistorySheet"),
  props: {
    isVisible: "bool",
    onClose: "fn",
    jobId: "any",
    proId: "any",
  },
}

const history = (...rates: number[]) => ({
  data: rates.map((ratePerHour, index) => ({
    id: rates.length - index,
    ratePerHour,
    createdAt: HOURS_AGO(1 + index * 5),
  })),
})
const DATA = screenState("data").api
/** What the history query answers (newest first, as the backend sends). */
const ANSWERS: { name: string; api: Record<string, unknown> }[] = [
  { name: "loading", api: { ...DATA, getOfferHistory: "loading" } },
  {
    name: "one offer",
    api: { ...DATA, getOfferHistory: { data: history(450) } },
  },
  {
    name: "rose and fell",
    api: { ...DATA, getOfferHistory: { data: history(500, 420, 450) } },
  },
  {
    name: "same rate",
    api: { ...DATA, getOfferHistory: { data: history(450, 450) } },
  },
  { name: "none", api: { ...DATA, getOfferHistory: { data: history() } } },
]

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases (and an empty classes file)", () => {
      writeHarvest(FILES, "OfferHistorySheet", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)
  const sets = Object.entries(cases.cases).flatMap(([id, entry]) =>
    (entry.props.isVisible ? ANSWERS : ANSWERS.slice(2, 3)).map(
      ({ name, api }) => ({
        name: `${id} ${entry.props.isVisible ? name : "hidden"}`,
        api,
        props: {
          ...buildProps(entry.props, { opaque: () => undefined }),
          jobId: 8001,
          proId: 9001,
        },
      })
    )
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
