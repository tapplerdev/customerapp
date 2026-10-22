import { describe, it, jest } from "@jest/globals"
import path from "path"
import React from "react"

/*
 * MapPinPicker (the centred map pin of the address picker), pinned to what
 * it drew before its conversion, for every prop set its call site hands it
 * and by hand for the sizes and the text no site passes.
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/MapPinPicker.cases.json. The trees in __parity__
 * were captured from MapPinPicker before its conversion (each case names
 * the commit). Both languages, both platforms.
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
  type HarvestedCase,
} from "testing/harvest"
import MapPinPicker from "../MapPinPicker"
/* eslint-enable import/first */

const FILES = harvestFilesFor(__dirname, "MapPinPicker")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("MapPinPicker"),
  props: {
    showInstruction: "bool",
    instructionText: "text",
    pinSize: "value",
    className: "class",
  },
}

type Props = React.ComponentProps<typeof MapPinPicker>

/**
 * By hand: its one site passes the medium pin, with and without the
 * instruction. The other sizes (a 19-string size and colour table sits in
 * the component), its own instruction text and a class have no caller.
 */
const HAND: Record<string, HarvestedCase> = {
  "hand small": { props: { pinSize: "small" }, sites: ["by hand"] },
  "hand large": { props: { pinSize: "large" }, sites: ["by hand"] },
  "hand small, no instruction": {
    props: { pinSize: "small", showInstruction: false },
    sites: ["by hand"],
  },
  "hand large, no instruction": {
    props: { pinSize: "large", showInstruction: false },
    sites: ["by hand"],
  },
  "hand own instruction": {
    props: { instructionText: "Drag the map to your door" },
    sites: ["by hand"],
  },
}

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "MapPinPicker", OPTIONS, captureCommit())
    })
  })
} else {
  const harvested = readHarvest(FILES)

  it("the cases hand it no class, no DmText and no ActionBtn", () => {
    expectClassFree(harvested.cases)
  })

  const cases: Record<string, HarvestedCase> = { ...harvested.cases, ...HAND }

  describe("MapPinPicker draws as before", () => {
    const table = Object.entries(cases).flatMap(([id, entry]) =>
      PARITY_MATRIX.map((env) => ({ id, site: entry.sites[0], entry, env }))
    )
    it.each(table)(
      "$id ($site) [$env.language $env.platform]",
      ({ id, entry, env }) => {
        expectParity(
          parityName(id, env),
          hostTree(
            <MapPinPicker
              {...(buildProps(entry.props, {}) as React.ComponentProps<
                typeof MapPinPicker
              >)}
            />,
            env
          )
        )
      }
    )
  })
}
