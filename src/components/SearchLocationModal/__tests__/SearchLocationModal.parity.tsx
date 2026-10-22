/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"
import path from "path"

import {
  copy,
  openScreen,
  pressText,
  renderScreen,
  rowsByPlatform,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
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
 * SearchLocationModal as its one call site draws it (ProsListingScreen:1005:
 * a sheet over the category list, the field starting with the category
 * already picked, the address as a line under it), over what the services
 * query answers (the list, still loading: the skeleton rows, nothing) and
 * what the field holds (no filter, a match, no match). The kit, for the
 * sheet, the store, i18next and the query. The Platform branches the
 * StyleSheet reads at import are each platform's registry's.
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/SearchLocationModal.cases.json. The trees in
 * __parity__ were captured from the component before its conversion (each
 * case names the commit).
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

const load = () => require("../SearchLocationModal")

const FILES = harvestFilesFor(__dirname, "SearchLocationModal")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("SearchLocationModal"),
  props: {
    isVisible: "bool",
    currentCategoryName: "any",
    currentAddress: "any",
    onSelectService: "fn",
    onChangeLocation: "fn",
    onClose: "fn",
  },
}

const ADDRESS = {
  address: "12 Nile Street",
  city: "Cairo",
  governorate: "Cairo",
}
const GOV_ONLY = { address: "5 Tahrir Square", governorate: "Giza" }

/** What the field holds when the sheet opens (the category the screen picked). */
const FIELDS = [
  { name: "all categories", category: "", address: ADDRESS },
  { name: "a match", category: "Plumb", address: GOV_ONLY },
  { name: "no match", category: "zzz", address: undefined },
]

const ANSWERS = [
  { name: "loaded", api: screenState("data").api },
  { name: "loading", api: {} },
]

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "SearchLocationModal", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)

  it("the cases hand it no class, no DmText and no ActionBtn", () => {
    expectClassFree(cases.cases)
  })

  const shown = Object.entries(cases.cases).filter(
    ([, entry]) => entry.props.isVisible
  )
  const hidden = Object.entries(cases.cases).filter(
    ([, entry]) => !entry.props.isVisible
  )
  const sets = [
    ...shown.flatMap(([id, entry]) =>
      FIELDS.flatMap((field) =>
        ANSWERS.map((answer) => ({
          name: `${id} ${field.name}, ${answer.name}`,
          api: answer.api,
          props: {
            ...buildProps(entry.props, { opaque: () => undefined }),
            currentCategoryName: field.category,
            currentAddress: field.address,
          },
        }))
      )
    ),
    ...hidden.map(([id, entry]) => ({
      name: `${id} hidden`,
      api: ANSWERS[0].api,
      props: {
        ...buildProps(entry.props, { opaque: () => undefined }),
        currentCategoryName: "",
      },
    })),
  ]
  const rows = rowsByPlatform(sets, PARITY_MATRIX)

  describe("the class-name path draws as before", () => {
    it.each(rows)("$name [$env.language $env.platform]", async (row) => {
      const tree = await renderScreen(load, {
        ...screenState("data"),
        api: row.api,
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
  describe("the sheet's controls take a press", () => {
    it.each(PARITY_MATRIX)("[$language $platform]", async (env) => {
      const handlers = {
        onSelectService: jest.fn(),
        onChangeLocation: jest.fn(),
        onClose: jest.fn(),
      }
      const open = () =>
        openScreen(load, {
          ...screenState("data"),
          lang: env.language,
          platform: env.platform,
          navigation: "none",
          props: {
            isVisible: true,
            currentCategoryName: "",
            currentAddress: ADDRESS,
            ...handlers,
          },
        })
      let session = await open()
      try {
        await session.act(() => {
          pressText(session.root, copy(env, "cancel"))
        })
        expect(handlers.onClose).toHaveBeenCalledTimes(1)
        await session.act(() => {
          pressText(session.root, copy(env, "search"))
        })
        expect(handlers.onClose).toHaveBeenCalledTimes(2)
        await session.act(() => {
          pressText(session.root, "12 Nile Street • Cairo")
        })
        expect(handlers.onChangeLocation).toHaveBeenCalledTimes(1)
        expect(handlers.onClose).toHaveBeenCalledTimes(3)
        await session.act(() => {
          // The result row is a pressable view around two texts: its first
          // pressable ancestor of the name.
          const name = env.language === "ar" ? "السباكة" : "Plumbing"
          const row = session.root.findAll(
            (node) =>
              typeof node.props.onPress === "function" &&
              node.findAll((child) => child.children.includes(name)).length > 0
          )[0]
          row.props.onPress()
        })
        expect(handlers.onSelectService).toHaveBeenCalledWith(
          301,
          env.language === "ar" ? "السباكة" : "Plumbing",
          201
        )
        expect(handlers.onClose).toHaveBeenCalledTimes(4)
      } finally {
        session.unmount()
      }
    })
  })
}
