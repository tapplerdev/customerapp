import { describe, it, jest } from "@jest/globals"
import path from "path"
import React from "react"

/*
 * AnimatedSelectCategory's class-name path (the food menu's section tabs),
 * pinned to what it drew before its conversion and its text's twins, for
 * every prop set its call site hands it.
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/AnimatedSelectCategory.cases.json; their class
 * strings are written out in __fixtures__/AnimatedSelectCategory.classes.tsx,
 * imported here so NativeWind compiles them, and checked first. The site's
 * computed section titles are four made-up ones. Reanimated is the screen
 * kit's stand-in (the underline's style is drawn as computed). The trees in
 * __parity__ were captured from AnimatedSelectCategory before its
 * conversion (each case names the commit). Both languages, both platforms.
 *
 * AnimatedSelectCategory.twins.test.tsx draws the same cases through the
 * twins the codemod writes, against these same trees.
 *
 *   DS_HARVEST=1 jest <this file>              re-harvest (writes the cases and classes)
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

/* eslint-disable global-require, @typescript-eslint/no-var-requires -- a
   jest.mock factory must require lazily: it is hoisted above every import. */
jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)
jest.mock("react-native-reanimated", () =>
  require("testing/screenKit/nativeMocks").reanimated()
)
// The scroll module exports AppFlashList too: FlashList ships ESM jest
// doesn't transform, and nothing here renders it.
jest.mock("@shopify/flash-list", () => ({ FlashList: "FlashList" }))
// The scroll module also exports AppKeyboardAwareScrollView: its library ships ESM jest
// doesn't transform, and nothing here renders it.
jest.mock("react-native-keyboard-aware-scroll-view", () => ({
  KeyboardAwareScrollView: "KeyboardAwareScrollView",
}))
/* eslint-enable global-require, @typescript-eslint/no-var-requires */

/* eslint-disable import/first */
// The harvested class strings, compiled (see the file).
import "../__fixtures__/AnimatedSelectCategory.classes"
import {
  PARITY_MATRIX,
  captureCommit,
  expectParity,
  hostTree,
  parityName,
} from "testing/hostTreeParity"
import {
  componentImport,
  buildProps,
  classStringsOf,
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestedCase,
  type HarvestOptions,
} from "testing/harvest"
import { describeCompiledClasses } from "testing/harvest/compiledClasses"
import AnimatedSelectCategory from "../AnimatedSelectCategory"
/* eslint-enable import/first */

/** The menu's section titles, which FoodMenuScreen computes. */
const SECTION_TITLES = ["Main dishes", "Desserts", "Drinks", "Salads"]

const FILES = harvestFilesFor(__dirname, "AnimatedSelectCategory")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("AnimatedSelectCategory"),
  props: {
    categories: "any",
    setSelectedCategory: "fn",
    className: "class",
    textClassName: "class",
    showLines: "bool",
  },
}

/**
 * By hand: the one site passes the food menu's own title class and the
 * default lines, so no harvested row draws the tabs' own title type (11,
 * semibold, centred, leading 14), nor the strip without its moving bar.
 */
const HAND: Record<string, HarvestedCase> = {
  "hand the tabs' own title type": {
    props: {
      categories: { $opaque: "sections" },
      setSelectedCategory: { $fn: true },
    },
    sites: ["by hand"],
  },
  "hand no lines": {
    props: {
      categories: { $opaque: "sections" },
      setSelectedCategory: { $fn: true },
      textClassName: "text-13 leading-[16px] font-custom500 text-center",
      showLines: false,
    },
    sites: ["by hand"],
  },
}

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases and the class strings NativeWind has to compile", () => {
      writeHarvest(FILES, "AnimatedSelectCategory", OPTIONS, captureCommit())
    })
  })
} else {
  const harvested = readHarvest(FILES)
  const cases: Record<string, HarvestedCase> = { ...harvested.cases, ...HAND }

  describeCompiledClasses(harvested, FILES, classStringsOf(harvested.cases))

  describe("AnimatedSelectCategory draws as before", () => {
    const table = Object.entries(cases).flatMap(([id, entry]) =>
      PARITY_MATRIX.map((env) => ({ id, site: entry.sites[0], entry, env }))
    )
    it.each(table)(
      "$id ($site) [$env.language $env.platform]",
      ({ id, entry, env }) => {
        expectParity(
          parityName(id, env),
          hostTree(
            <AnimatedSelectCategory
              {...(buildProps(entry.props, {
                opaque: () => SECTION_TITLES,
              }) as React.ComponentProps<typeof AnimatedSelectCategory>)}
            />,
            env
          )
        )
      }
    )
  })
}
