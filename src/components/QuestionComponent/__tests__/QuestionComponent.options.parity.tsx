/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"
import path from "path"

import { openScreen, renderScreen, rowsByPlatform } from "testing/screenKit"
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
import type { QuestionAnswerType } from "types/job"
import type { ServiceQuestionType } from "types/cms"

/*
 * QuestionComponent's own drawing: the heading, every option style it lays
 * out itself (chips, the checkmark list, checkbox, radio, and the default a
 * question with no style gets), the answer boxes and the date question, over
 * the three prop sets its call sites hand it (AllQuestionsScreen:234, compact
 * and without borders; QuestionStepScreen:291; ServiceRequestDetailsScreen:353).
 * `compact` is what turns on DmChecbox's `size={20}` (:423, :440, :457: the
 * dynamic size no harvest saw) and the heading's bold weight. The three
 * button kinds (imageWithText, imageWithCheckmark, textWithCheckmark) are the
 * prep rows' (QuestionComponent.buttons.parity.tsx); one of each is drawn here
 * too, compact. The kit, for the icons, the picker and i18next.
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/QuestionComponent.cases.json; the questions and
 * answers are the hand cases below. The trees in __parity__ were captured
 * from the component before its conversion (each case names the commit).
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

const load = () => require("../QuestionComponent")

const FILES = harvestFilesFor(__dirname, "QuestionComponent")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("QuestionComponent"),
  props: {
    key: "any",
    item: "any",
    onChangeAnswer: "fn",
    answers: "any",
    hideBorders: "bool",
    compact: "bool",
    allQuestions: "any",
  },
}

const options = (n: number, icon = true) =>
  [
    { id: 1, label: "Matte", labelAr: "مطفي", value: "Matte", valueAr: "مطفي" },
    {
      id: 2,
      label: "Glossy",
      labelAr: "لامع",
      value: "Glossy",
      valueAr: "لامع",
    },
    {
      id: 3,
      label: "Satin",
      labelAr: "ساتان",
      value: "Satin",
      valueAr: "ساتان",
    },
  ]
    .slice(0, n)
    .map((option) => ({
      ...option,
      icon: icon ? "https://example.com/parity/finish.svg" : "",
    }))

const question = (
  type: ServiceQuestionType["type"],
  extra: Partial<ServiceQuestionType> = {}
): ServiceQuestionType => ({
  id: 910,
  assignee: "customer",
  type,
  text: "Which finish?",
  textAr: "أي تشطيب؟",
  isFilter: false,
  order: 1,
  options: options(3),
  ...extra,
})

const PICK_ONE: QuestionAnswerType[] = [
  { questionId: 910, optionId: 2, answer: "Glossy" },
]
const PICK_TWO: QuestionAnswerType[] = [
  { questionId: 910, optionsIds: [1, 3], answer: "Matte, Satin" },
]

/** What the three call sites' questions can be, with the answer each draws with. */
const VARIANTS: {
  name: string
  item: ServiceQuestionType
  answers?: QuestionAnswerType[]
}[] = [
  ...(["onePerRow", "wrap", "horizontal"] as const).flatMap((layout) => [
    {
      name: `chips ${layout}`,
      item: question("oneChoice", {
        style: "chips",
        layoutQuestionStyle: layout,
      }),
    },
    {
      name: `chips ${layout}, picked`,
      item: question("oneChoice", {
        style: "chips",
        layoutQuestionStyle: layout,
      }),
      answers: PICK_ONE,
    },
  ]),
  {
    name: "checkmark list",
    item: question("oneChoice", { style: "checkmark" }),
  },
  {
    name: "checkmark list, picked",
    item: question("oneChoice", { style: "checkmark" }),
    answers: PICK_ONE,
  },
  {
    name: "checkbox",
    item: question("multipleChoice", { style: "checkbox" }),
    answers: PICK_TWO,
  },
  {
    name: "radio",
    item: question("oneChoice", { style: "radio" }),
    answers: PICK_ONE,
  },
  {
    name: "no style, multiple",
    item: question("multipleChoice"),
    answers: PICK_TWO,
  },
  { name: "no style, one", item: question("oneChoice"), answers: PICK_ONE },
  {
    name: "imageWithText",
    item: question("oneChoice", { style: "imageWithText" }),
    answers: PICK_ONE,
  },
  {
    name: "imageWithCheckmark",
    item: question("oneChoice", { style: "imageWithCheckmark" }),
    answers: PICK_ONE,
  },
  {
    name: "textWithCheckmark",
    item: question("oneChoice", { style: "textWithCheckmark" }),
    answers: PICK_ONE,
  },
  {
    name: "short answer",
    item: question("shortAnswer", { options: undefined }),
  },
  {
    name: "short answer, filled",
    item: question("shortAnswer", { options: undefined }),
    answers: [{ questionId: 910, answer: "Grey, not too glossy" }],
  },
  {
    name: "paragraph, filled",
    item: question("paragraph", { options: undefined }),
    answers: [
      { questionId: 910, answer: "Two coats, please.\nBring dust sheets." },
    ],
  },
  {
    name: "date and time",
    item: question("dateTime", { options: undefined, dateType: "date" }),
  },
]

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases (and an empty classes file)", () => {
      writeHarvest(FILES, "QuestionComponent", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)
  const sets = Object.entries(cases.cases).flatMap(([id, entry]) =>
    VARIANTS.map(({ name, item, answers }) => {
      const { key: _key, ...props } = buildProps(entry.props, {
        opaque: () => undefined,
      })
      return {
        name: `${id} ${name}`,
        props: {
          ...props,
          item,
          answers,
          // No cascade: the harvested lists are screens' own.
          allQuestions: "allQuestions" in entry.props ? [] : undefined,
        },
      }
    })
  )
  const rows = rowsByPlatform(sets, PARITY_MATRIX)

  describe("the class-name path draws as before", () => {
    it.each(rows)("$name [$env.language $env.platform]", async (row) => {
      const tree = await renderScreen(load, {
        lang: row.env.language,
        platform: row.env.platform,
        http: () => ({
          text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#CC0000"/></svg>',
        }),
        navigation: "none",
        props: { onChangeAnswer: () => {}, ...row.props },
      })
      expectParity(parityName(row.name, row.env), tree)
    })
  })

  // The converted answer box's handler runs (functions don't show in a tree).
  describe("typing in the answer box reaches the screen", () => {
    it.each(PARITY_MATRIX)("[$language $platform]", async (env) => {
      const onChangeAnswer = jest.fn()
      const session = await openScreen(load, {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
        props: {
          item: question("shortAnswer", { options: undefined }),
          onChangeAnswer,
          answers: [],
        },
      })
      try {
        const input = session.root.findByType("TextInput" as never)
        await session.act(() => {
          input.props.onChangeText("Grey")
        })
        expect(onChangeAnswer).toHaveBeenCalledWith({
          questionId: 910,
          answer: "Grey",
        })
      } finally {
        session.unmount()
      }
    })
  })
}
