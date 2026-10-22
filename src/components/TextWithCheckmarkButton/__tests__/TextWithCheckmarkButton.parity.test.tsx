import { describe, expect, it, jest } from "@jest/globals"
import path from "path"
import React from "react"

/*
 * TextWithCheckmarkButton's class-name path, pinned to what it drew before
 * its conversion, for every prop set its call site hands it (QuestionComponent
 * :350, where the layout `className` it once passed drew nothing and went in
 * W1's prep), picked and not, plus the classes a caller could still pass
 * (__fixtures__/TextWithCheckmarkButton.handCases.tsx).
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/TextWithCheckmarkButton.cases.json. No call site
 * passes a class, so the generated classes file is empty; the hand cases'
 * classes are compiled by their own file, and the twin test checks each
 * draws something. The trees in __parity__ were captured from the component
 * before its conversion (each case names the commit). Both languages, both
 * platforms. The check mark is the kit's SVG stand-in (a host named after
 * the file), as in the screen kit.
 *
 * TextWithCheckmarkButton.twins.test.tsx draws the same cases through the
 * twins the codemod writes, against these same trees.
 *
 *   DS_HARVEST=1 jest <this file>              re-harvest (writes both files)
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)
jest.mock("assets/icons/check-mark.svg", () => {
  const { createElement } = jest.requireActual("react") as typeof React
  return {
    __esModule: true,
    default: (props: object) => createElement("svg:check-mark", props),
  }
})

/* eslint-disable import/first */
// The harvested class strings and the hand cases', compiled (see the files).
import "../__fixtures__/TextWithCheckmarkButton.classes"
import { HAND_CASES } from "../__fixtures__/TextWithCheckmarkButton.handCases"
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
import TextWithCheckmarkButton from "../TextWithCheckmarkButton"
/* eslint-enable import/first */

type Props = React.ComponentProps<typeof TextWithCheckmarkButton>

const FILES = harvestFilesFor(__dirname, "TextWithCheckmarkButton")

// Its props before the conversion: a site passing a prop not listed stops
// the harvest. `key` is React's, read and dropped before the render.
const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("TextWithCheckmarkButton"),
  props: {
    label: "text",
    isSelected: "bool",
    onPress: "fn",
    className: "class",
    key: "any",
  },
}

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases and the class strings NativeWind has to compile", () => {
      writeHarvest(FILES, "TextWithCheckmarkButton", OPTIONS, captureCommit())
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
        const { key: _key, ...props } = buildProps(entry.props, {
          opaque: () => 0,
        })
        expectParity(
          parityName(id, env),
          hostTree(<TextWithCheckmarkButton {...(props as Props)} />, env)
        )
      }
    )
  })

  describe("a caller's className still draws", () => {
    const table = HAND_CASES.flatMap(({ name, props }) =>
      PARITY_MATRIX.map((env) => ({ name, props, env }))
    )
    it.each(table)(
      "$name [$env.language $env.platform]",
      ({ name, props, env }) => {
        expectParity(
          parityName(name, env),
          hostTree(
            <TextWithCheckmarkButton onPress={() => undefined} {...props} />,
            env
          )
        )
      }
    )
  })
}
