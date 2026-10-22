/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, it } from "@jest/globals"

import { renderScreen, rowsByPlatform } from "testing/screenKit"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"
import type { QuestionStyleType, QuestionLayoutStyleType } from "types/cms"

/*
 * QuestionComponent's three button kinds (imageWithText, imageWithCheckmark,
 * textWithCheckmark) in each layout, nothing picked and one picked. Each
 * kind is imported by file path, so the layout `className` the question gave
 * it (:306, :336, :365) reached the button as a style it never read:
 * captured before W1's prep deleted them.
 */

const load = () => require("../QuestionComponent")

// The option art the screen fetches: a plain rectangle, so the icons draw.
const SVG_ART =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#CC0000"/></svg>'

const STYLES: QuestionStyleType[] = [
  "imageWithText",
  "imageWithCheckmark",
  "textWithCheckmark",
]
const LAYOUTS: QuestionLayoutStyleType[] = ["onePerRow", "wrap", "horizontal"]

const question = (
  style: QuestionStyleType,
  layoutQuestionStyle: QuestionLayoutStyleType
) => ({
  id: 910,
  assignee: "customer",
  type: "oneChoice",
  style,
  layoutQuestionStyle,
  text: "Which finish?",
  textAr: "أي تشطيب؟",
  isFilter: false,
  order: 1,
  options: [
    {
      id: 9101,
      label: "Matte",
      labelAr: "مطفي",
      value: "Matte",
      valueAr: "مطفي",
      icon: "https://example.com/parity/matte.svg",
    },
    {
      id: 9102,
      label: "Glossy",
      labelAr: "لامع",
      value: "Glossy",
      valueAr: "لامع",
      icon: "",
    },
    {
      id: 9103,
      label: "Satin",
      labelAr: "ساتان",
      value: "Satin",
      valueAr: "ساتان",
      icon: "https://example.com/parity/satin.svg",
    },
  ],
})

const CASES = STYLES.flatMap((style) =>
  LAYOUTS.flatMap((layout) =>
    [false, true].map((picked) => ({
      name: `${style}, ${layout}${picked ? ", Glossy picked" : ""}`,
      style,
      layout,
      picked,
    }))
  )
)
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("QuestionComponent buttons, captured before the dead classNames went", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (row) => {
    const tree = await renderScreen(load, {
      lang: row.env.language,
      platform: row.env.platform,
      http: () => ({ text: SVG_ART }),
      navigation: "none",
      props: {
        item: question(row.style, row.layout),
        onChangeAnswer: () => {},
        answers: row.picked
          ? [{ questionId: 910, optionId: 9102, answer: "Glossy" }]
          : [],
      },
    })
    expectParity(parityName(row.name, row.env), tree)
  })
})
