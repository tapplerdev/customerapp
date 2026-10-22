import { describe, it, jest } from "@jest/globals"
import path from "path"
import React from "react"

/*
 * ChipButton (an answer chip in the service questions),
 * pinned to what it drew before its conversion, for every prop set its call
 * site hands it, compact and not.
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/ChipButton.cases.json, and checked to hand it no
 * class. The trees in __parity__ were captured from ChipButton before its
 * conversion (each case names the commit). Both languages, both platforms.
 *
 *   DS_HARVEST=1 jest <this file>              re-harvest (writes the cases)
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

/* eslint-disable global-require, @typescript-eslint/no-var-requires -- a
   jest.mock factory must require lazily: it is hoisted above every import. */
jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)
/* eslint-enable global-require, @typescript-eslint/no-var-requires */

/* eslint-disable import/first */
import {
  PARITY_MATRIX,
  captureCommit,
  expectParity,
  hostTree,
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
import ChipButton from "../ChipButton"
/* eslint-enable import/first */

const FILES = harvestFilesFor(__dirname, "ChipButton")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("ChipButton"),
  props: {
    label: "text",
    isSelected: "bool",
    onPress: "fn",
    className: "class",
    compact: "bool",
    key: "any",
  },
}

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "ChipButton", OPTIONS, captureCommit())
    })
  })
} else {
  const harvested = readHarvest(FILES)

  it("the cases hand it no class, no DmText and no ActionBtn", () => {
    expectClassFree(harvested.cases)
  })

  const { cases } = harvested

  describe("ChipButton draws as before", () => {
    const table = Object.entries(cases).flatMap(([id, entry]) =>
      PARITY_MATRIX.map((env) => ({ id, site: entry.sites[0], entry, env }))
    )
    it.each(table)(
      "$id ($site) [$env.language $env.platform]",
      ({ id, entry, env }) => {
        const { key: _key, ...props } = buildProps(entry.props, {
          opaque: () => undefined,
        })
        expectParity(
          parityName(id, env),
          hostTree(
            <ChipButton
              {...(props as React.ComponentProps<typeof ChipButton>)}
            />,
            env
          )
        )
      }
    )
  })
}
