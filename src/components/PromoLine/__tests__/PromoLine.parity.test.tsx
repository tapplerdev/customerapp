import { describe, expect, it, jest } from "@jest/globals"
import path from "path"
import React from "react"

/*
 * PromoLine's class-name path, pinned to what it drew before its conversion,
 * for every prop set its call sites hand it.
 *
 * Only customerapp's wrapper is harvested (an import of components/PromoLine),
 * not tappler-shared's banner it draws. Its three callers pass no class now
 * (the two at ProCard:274 and ProCardBase:219 drew nothing and went in W1's
 * prep), so the cases hold the bare banner; the class path is pinned beside
 * them by hand (CLASSES), which is what a caller's className still draws.
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/PromoLine.cases.json; their class strings are
 * written out in __fixtures__/PromoLine.classes.tsx, imported here so
 * NativeWind compiles them, and checked first. The trees in __parity__ were
 * captured from PromoLine before its conversion (each case names the
 * commit). Both languages, both platforms.
 *
 * PromoLine.twins.test.tsx draws the same cases through the twins the
 * codemod writes, against these same trees.
 *
 *   DS_HARVEST=1 jest <this file>              re-harvest (writes both files)
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

/* eslint-disable import/first */
// The harvested class strings, compiled (see the file).
import "../__fixtures__/PromoLine.classes"
import {
  PARITY_MATRIX,
  captureCommit,
  expectParity,
  hostTree,
  parityName,
} from "testing/hostTreeParity"
import {
  buildProps,
  classStringsOf,
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestOptions,
} from "testing/harvest"
import { describeCompiledClasses } from "testing/harvest/compiledClasses"
import { ControlText } from "testing/harvest/__fixtures__/classProbes"
import PromoLine from "../PromoLine"
/* eslint-enable import/first */

type Props = React.ComponentProps<typeof PromoLine>

const FILES = harvestFilesFor(__dirname, "PromoLine")

// Its props before the conversion: a site passing a prop not listed stops
// the harvest.
const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  // Not componentImport(): that would also take tappler-shared's own banner.
  importFrom: /^components\/PromoLine(\/PromoLine)?$/,
  props: {
    promoMessage: "text",
    className: "class",
  },
}

/**
 * The class strings a caller could still hand it (the two dead sites passed
 * "mt-[6]"-like spacing that drew nothing; a live caller's would draw).
 *
 */
const CLASSES: Record<string, Props> = {
  "class mt-[6]": { promoMessage: "{promo}", className: "mt-[6]" },
  "class mx-[10] mb-[8]": {
    promoMessage: "{promo}",
    className: "mx-[10] mb-[8]",
  },
}

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases and the class strings NativeWind has to compile", () => {
      writeHarvest(FILES, "PromoLine", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)
  const classes = classStringsOf(cases.cases)

  if (classes.length) describeCompiledClasses(cases, FILES, classes)
  else {
    // No call site passes a class: the control alone (NativeWind is on).
    it("control: NativeWind compiles a class this run loads", () => {
      expect(
        hostTree(<ControlText />, { language: "en" })?.props.style
      ).toMatchObject({ fontSize: 20 })
    })
  }

  describe("the class-name path draws as before", () => {
    const table = Object.entries(cases.cases).flatMap(([id, entry]) =>
      PARITY_MATRIX.map((env) => ({ id, site: entry.sites[0], entry, env }))
    )
    it.each(table)(
      "$id ($site) [$env.language $env.platform]",
      ({ id, entry, env }) => {
        const props = buildProps(entry.props)
        expectParity(
          parityName(id, env),
          hostTree(<PromoLine {...(props as Props)} />, env)
        )
      }
    )
  })

  describe("a caller's className still draws", () => {
    const table = Object.entries(CLASSES).flatMap(([name, props]) =>
      PARITY_MATRIX.map((env) => ({ name, props, env }))
    )
    it.each(table)("$name [$env.language $env.platform]", ({ name, props, env }) => {
      expectParity(
        parityName(name, env),
        hostTree(<PromoLine {...props} />, env)
      )
    })
  })
}
