/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"
import path from "path"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
  renderScreen,
  rowsByPlatform,
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
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestOptions,
} from "testing/harvest"

/*
 * SearchBar as its two call sites draw it (HomeScreen:65 with its two press
 * handlers: a pressable bar; HomeSkeletonScreen:37 with none: a field), plus
 * the typed field with a value and a placeholder of its own (the props the
 * component takes that no site passes). The kit, for the icons and i18next.
 * No site passes the `className` the component takes (dead, deleted with its
 * conversion).
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/SearchBar.cases.json. The trees in __parity__ were
 * captured from the component before its conversion (each case names the
 * commit).
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

const load = () => require("../SearchBar")

const FILES = harvestFilesFor(__dirname, "SearchBar")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("SearchBar"),
  props: {
    value: "any",
    onChangeText: "fn",
    onSubmit: "fn",
    onPress: "fn",
    onFilterPress: "fn",
    placeholder: "text",
    className: "class",
  },
}

type Case = { name: string; props: Record<string, unknown> }

const HAND: Case[] = [
  { name: "field with a value", props: { value: "plumber" } },
  {
    name: "field with a placeholder",
    props: { placeholder: "Find a cleaner", value: "" },
  },
  {
    name: "bar with a placeholder",
    props: { placeholder: "Find a cleaner", onPress: () => {} },
  },
]

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases (and an empty classes file)", () => {
      writeHarvest(FILES, "SearchBar", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)
  const harvested: Case[] = Object.entries(cases.cases).map(([id, entry]) => ({
    name: `${id} (${entry.sites[0]})`,
    props: buildProps(entry.props),
  }))
  const rows = rowsByPlatform([...harvested, ...HAND], PARITY_MATRIX)

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

  // The converted views' handlers run (a handler lost in the conversion
  // draws the same tree: functions don't show in it).
  describe("the bar and the filter icon take a press", () => {
    it.each(PARITY_MATRIX)("[$language $platform]", async (env) => {
      const onPress = jest.fn()
      const onFilterPress = jest.fn()
      const session = await openScreen(load, {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
        props: { onPress, onFilterPress },
      })
      try {
        await session.act(() => {
          pressText(session.root, copy(env, "search_for_a_service"))
        })
        expect(onPress).toHaveBeenCalledTimes(1)
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:categories" })
        })
        expect(onFilterPress).toHaveBeenCalledTimes(1)
        expect(onPress).toHaveBeenCalledTimes(1)
      } finally {
        session.unmount()
      }
    })
  })
}
