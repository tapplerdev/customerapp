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
 * RenderTabBarIcon as HomeTabs draws it (the four tabs, focused and not; the
 * messages tab's badge is the unread count), over the badges it can show: none
 * (undefined), zero, a count, the last count before the cap and past it. The
 * kit, for the icons.
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/RenderTabBarIcon.cases.json. The trees in __parity__
 * were captured from the component before its conversion (each case names the
 * commit).
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

const load = () => require("../RenderTabBarIcon")

const FILES = harvestFilesFor(__dirname, "RenderTabBarIcon")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("RenderTabBarIcon"),
  props: {
    type: "value",
    focused: "bool",
    badge: "any",
  },
}

/** What HomeTabs' `totalUnread` can be (only the messages tab passes it). */
const BADGES = [
  { name: "no badge", badge: undefined },
  { name: "badge 0", badge: 0 },
  { name: "badge 5", badge: 5 },
  { name: "badge 99", badge: 99 },
  { name: "badge 150", badge: 150 },
]

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases (and an empty classes file)", () => {
      writeHarvest(FILES, "RenderTabBarIcon", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)
  const sets = Object.entries(cases.cases).flatMap(([id, entry]) =>
    // Only the messages tab passes a badge; the others are drawn without.
    (entry.props.type === "messages" ? BADGES : BADGES.slice(0, 1)).map(
      ({ name, badge }) => ({
        name: `${id} ${entry.props.type} ${
          entry.props.focused ? "focused" : "idle"
        }, ${name}`,
        props: {
          ...buildProps(entry.props, { opaque: () => undefined }),
          badge,
        },
      })
    )
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
