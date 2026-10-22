/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"
import path from "path"

import {
  openScreen,
  renderScreen,
  rowsByPlatform,
  typeInto,
} from "testing/screenKit"
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
 * SearchMessagesComponent as its one call site draws it (MessagesScreen:142),
 * with the field empty and filled (a filled DmInput is the state that draws
 * the field's own face: the font-class bug of proapp's B-wave). The kit, for
 * the form, the icon and i18next.
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/SearchMessagesComponent.cases.json. The trees in
 * __parity__ were captured from the component before its conversion (each
 * case names the commit).
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

const load = () => require("../SearchMessagesComponent")

const FILES = harvestFilesFor(__dirname, "SearchMessagesComponent")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("SearchMessagesComponent"),
  props: {
    searchText: "any",
    onChangeText: "fn",
  },
}

/** What the screen's `searchText` can be: nothing typed, a word, a long Arabic or English query. */
const TEXTS = [
  { name: "empty", text: "" },
  { name: "filled", text: "pipe repair" },
  { name: "filled arabic", text: "إصلاح السباكة" },
]

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "SearchMessagesComponent", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)

  it("the cases hand it no class, no DmText and no ActionBtn", () => {
    expectClassFree(cases.cases)
  })

  const sets = Object.entries(cases.cases).flatMap(([id, entry]) =>
    TEXTS.map(({ name, text }) => ({
      name: `${id} ${name}`,
      props: {
        ...buildProps(entry.props, { opaque: () => undefined }),
        searchText: text,
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

  // The field's handler runs (functions don't show in a tree).
  describe("typing reaches the screen", () => {
    it.each(PARITY_MATRIX)("[$language $platform]", async (env) => {
      const onChangeText = jest.fn()
      const session = await openScreen(load, {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
        props: { searchText: "", onChangeText },
      })
      try {
        await session.act(() => {
          typeInto(session.root, 0, "pipe")
        })
        expect(onChangeText).toHaveBeenCalledWith("pipe")
      } finally {
        session.unmount()
      }
    })
  })
}
