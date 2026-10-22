import { describe, it, jest } from "@jest/globals"
import path from "path"
import React from "react"

/*
 * ImageWithTextButton's class-name path (an image answer in the service questions), pinned to what it drew
 * before its conversion and its style twin, for every prop set its call
 * site hands it, with and without art.
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/ImageWithTextButton.cases.json; their class strings
 * are written out in __fixtures__/ImageWithTextButton.classes.tsx, imported
 * here so NativeWind compiles them, and checked first. The network is shut
 * (SvgUriContainer's request never answers) and storage is the screen kit's
 * stand-in. The trees in __parity__ were captured from
 * ImageWithTextButton before its conversion (each case names the commit).
 * Both languages, both platforms.
 *
 * ImageWithTextButton.twins.test.tsx draws the same cases through the twin
 * the codemod writes, against these same trees.
 *
 *   DS_HARVEST=1 jest <this file>              re-harvest (writes the cases and classes)
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

/* eslint-disable global-require, @typescript-eslint/no-var-requires -- a
   jest.mock factory must require lazily: it is hoisted above every import. */
jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)
jest.mock("react-native-mmkv", () =>
  require("testing/screenKit/nativeMocks").mmkv()
)
// The answer's art is fetched by SvgUriContainer: the network is shut here,
// as in the screen kit (the request never answers, so the art draws nothing).
global.fetch = jest.fn(() => new Promise<never>(() => undefined)) as never
/* eslint-enable global-require, @typescript-eslint/no-var-requires */

/* eslint-disable import/first */
// The harvested class strings, compiled (see the file).
import "../__fixtures__/ImageWithTextButton.classes"
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
  type HarvestOptions,
} from "testing/harvest"
import { describeCompiledClasses } from "testing/harvest/compiledClasses"
import ImageWithTextButton from "../ImageWithTextButton"
/* eslint-enable import/first */

const FILES = harvestFilesFor(__dirname, "ImageWithTextButton")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("ImageWithTextButton"),
  props: {
    label: "text",
    imageUrl: "any",
    isSelected: "bool",
    onPress: "fn",
    className: "class",
    key: "any",
  },
}

/** The answer's art: an icon url, or none (the grey placeholder). */
let imageUrl = ""

const VARIANTS: Record<string, () => void> = {
  "with art": () => {
    imageUrl = "https://example.com/parity/answer.svg"
  },
  "no art": () => {
    imageUrl = ""
  },
}

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases and the class strings NativeWind has to compile", () => {
      writeHarvest(FILES, "ImageWithTextButton", OPTIONS, captureCommit())
    })
  })
} else {
  const harvested = readHarvest(FILES)
  const { cases } = harvested

  describeCompiledClasses(harvested, FILES, classStringsOf(harvested.cases))

  describe("ImageWithTextButton draws as before", () => {
    const table = Object.entries(cases).flatMap(([id, entry]) =>
      Object.keys(VARIANTS).flatMap((variant) =>
        PARITY_MATRIX.map((env) => ({
          id: `${id} ${variant}`,
          variant,
          site: entry.sites[0],
          entry,
          env,
        }))
      )
    )
    it.each(table)(
      "$id ($site) [$env.language $env.platform]",
      ({ id, variant, entry, env }) => {
        VARIANTS[variant]()
        const { key: _key, ...props } = buildProps(entry.props, {
          opaque: () => imageUrl,
        })
        expectParity(
          parityName(id, env),
          hostTree(
            <ImageWithTextButton
              {...(props as React.ComponentProps<typeof ImageWithTextButton>)}
            />,
            env
          )
        )
      }
    )
  })
}
