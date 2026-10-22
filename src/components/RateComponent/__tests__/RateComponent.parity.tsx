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
 * RateComponent as its call sites draw it (ProCardBase, ProCard, JobDetail,
 * ProProfile: itemSize 11, 12 and 14, the short and the full review text),
 * over the ratings it can be handed: none yet, a part star, whole stars, no
 * count. The kit, for the star icon and i18next. No site passes a class, so the
 * `className` it takes (dead, deleted with its conversion) isn't a case.
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/RateComponent.cases.json. The trees in __parity__
 * were captured from the component before its conversion (each case names the
 * commit).
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

const load = () => require("../RateComponent")

const FILES = harvestFilesFor(__dirname, "RateComponent")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("RateComponent"),
  props: {
    rate: "any",
    reviewsCount: "any",
    itemSize: "value",
    showFullReviewText: "bool",
    className: "class",
  },
}

/** What the sites' `overallScore` and `reviewsCount` can be. */
const RATINGS: { name: string; rate: number; reviewsCount?: number }[] = [
  { name: "no reviews yet", rate: 0, reviewsCount: 0 },
  { name: "4.5 of 12", rate: 4.5, reviewsCount: 12 },
  { name: "5 of 1", rate: 5, reviewsCount: 1 },
  { name: "3.2 of 7", rate: 3.2, reviewsCount: 7 },
  { name: "4.8, no count", rate: 4.8 },
]

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "RateComponent", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)

  it("the cases hand it no class, no DmText and no ActionBtn", () => {
    expectClassFree(cases.cases)
  })

  const sets = Object.entries(cases.cases).flatMap(([id, entry]) =>
    RATINGS.map(({ name, rate, reviewsCount }) => ({
      name: `${id} ${name}`,
      props: {
        ...buildProps(entry.props, { opaque: () => 0 }),
        rate,
        reviewsCount,
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
