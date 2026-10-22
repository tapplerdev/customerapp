import { describe, expect, it, jest } from "@jest/globals"
import path from "path"
import React from "react"

/*
 * SkeletonLoader's class-name path, pinned to what it drew before its
 * conversion, for every prop set its call sites hand it, plus the class
 * strings W2's callers could pass (the ones its twelve-dead-class sites at
 * JobDetail used to, none of which drew).
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/SkeletonLoader.cases.json; their class strings are
 * written out in __fixtures__/SkeletonLoader.classes.tsx, imported here so
 * NativeWind compiles them, and checked first. The trees in __parity__ were
 * captured from SkeletonLoader before its conversion (each case names the
 * commit). Both languages, both platforms.
 *
 *   DS_HARVEST=1 jest <this file>              re-harvest (writes both files)
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

/* eslint-disable import/first */
// The harvested class strings, compiled (see the file).
import "../__fixtures__/SkeletonLoader.classes"
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
  componentImport,
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestOptions,
} from "testing/harvest"
import { describeCompiledClasses } from "testing/harvest/compiledClasses"
import { ControlText } from "testing/harvest/__fixtures__/classProbes"
import SkeletonLoader from "../SkeletonLoader"
/* eslint-enable import/first */

type Props = React.ComponentProps<typeof SkeletonLoader>

const FILES = harvestFilesFor(__dirname, "SkeletonLoader")

// Its props before the conversion: a site passing a prop not listed stops
// the harvest.
const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("SkeletonLoader"),
  props: {
    width: "value",
    height: "value",
    borderRadius: "value",
    className: "class",
  },
  rewrites: {
    "screens/HomeSkeletonScreen/HomeSkeletonScreen.tsx:17": {
      reason: "SkeletonSection's titleWidth: its four callers' values (:42-78)",
      values: { titleWidth: 'oneOf("50%", "40%", "45%", "55%")' },
    },
    "screens/HomeSkeletonScreen/HomeSkeletonScreen.tsx:19": {
      reason: "SkeletonSection's descWidth: its four callers' values (:42-78)",
      values: { descWidth: 'oneOf("70%", "55%", "65%", "60%")' },
    },
    "screens/dashboardScreens/NotificationsScreen/NotificationsSkeleton.tsx:24":
      {
        reason: "a row's title width from ROWS (:8-14)",
        values: { "row.title": 'oneOf("70%", "60%", "75%", "65%", "80%")' },
      },
    "screens/dashboardScreens/NotificationsScreen/NotificationsSkeleton.tsx:28":
      {
        reason: "a body line's width from ROWS (:8-14)",
        values: {
          width: 'oneOf("95%", "90%", "85%", "92%", "88%", "80%", "75%", "94%")',
        },
      },
    "screens/dashboardScreens/CategoriesScreen/CategoriesScreen.tsx:129": {
      reason: "the row's percentage from the list at :126",
      values: { width: "oneOf(60, 45, 70, 50, 65, 55, 72, 48)" },
    },
    "components/SearchLocationModal/SearchLocationModal.tsx:277": {
      reason: "the row's percentage from the list at :272",
      values: { w: "oneOf(64, 46, 72, 55, 38, 60)" },
    },
    "components/SearchLocationModal/SearchLocationModal.tsx:279": {
      reason: "the second bar: Math.max(24, w - 25) of the same list",
      values: { "Math.max(24, w - 25)": "oneOf(39, 24, 47, 30, 35)" },
    },
  },
}

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases and the class strings NativeWind has to compile", () => {
      writeHarvest(FILES, "SkeletonLoader", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)
  const classes = classStringsOf(cases.cases)

  if (classes.length) describeCompiledClasses(cases, FILES, classes)
  else {
    // No call site passes a class now (the dead ones went in W1's prep):
    // the control alone (NativeWind is on, so the component's own DmView
    // takes a class when a caller gives one).
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
          hostTree(<SkeletonLoader {...(props as Props)} />, env)
        )
      }
    )
  })
}
