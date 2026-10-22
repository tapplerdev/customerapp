import { describe, expect, it, jest } from "@jest/globals"
import type React from "react"

/*
 * The freeze (W3.1 only: W3.4 deletes this test with freezeTwins and the
 * codemod): how a prop set becomes a synthetic call site, what the freeze
 * refuses, and one site through the codemod each way.
 */

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

/* eslint-disable import/first */
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import type { TwinSpec } from "testing/harvest"
import { convertCase, refusalsOf, siteFor } from "testing/harvest/freezeTwins"
/* eslint-enable import/first */

const SPEC: TwinSpec = {
  source: "components/HelpCard",
  tag: "HelpCard",
  build: {
    elements: {
      DmText: DmText as React.ComponentType<object>,
      DmView: DmView as React.ComponentType<object>,
    },
  },
}

describe("the synthetic site", () => {
  it("writes literals as literals and everything else through __twin_site__", () => {
    const { code, specs } = siteFor(
      { ...SPEC, build: {} },
      { title: "t:help", showChevron: true, onPress: { $fn: true } }
    )
    expect(code).toBe(
      [
        'import React from "react"',
        'import HelpCard from "components/HelpCard"',
        'import __twin from "__twin_site__"',
        "",
        'export default <HelpCard title={"t:help"} showChevron={true} onPress={__twin.values[0]} />',
        "",
      ].join("\n")
    )
    expect(specs).toEqual([{ $fn: true }])
  })

  it("writes an element the test builds as DmText or DmView as JSX, a stand-in as a value", () => {
    const { code, specs } = siteFor(SPEC, {
      Icon: {
        $el: "DmView",
        props: { className: "mt-[4]", style: { width: 18 } },
        children: [
          { $el: "ChevronIcon", props: { width: 18 } },
          { $el: "DmText", props: { className: "text-12" }, children: "t:go" },
        ],
      },
    })
    expect(code).toContain(
      'import { DmText, DmView } from "@tappler/shared/src/components/UI"'
    )
    expect(code).toContain(
      'Icon={<DmView className={"mt-[4]"} style={{"width":18}}>{__twin.values[0]}<DmText className={"text-12"}>{"t:go"}</DmText></DmView>}'
    )
    expect(specs).toEqual([{ $el: "ChevronIcon", props: { width: 18 } }])
  })

  it("keeps an element the test doesn't build as a real component a value", () => {
    const { code } = siteFor(
      { ...SPEC, build: {} },
      { Icon: { $el: "DmView", props: { className: "mt-[4]" } } }
    )
    expect(code).toContain("Icon={__twin.values[0]}")
  })
})

describe("what the freeze refuses", () => {
  it("a class left on any element, even an empty one, and a DmText or ActionBtn", () => {
    expect(
      refusalsOf(
        'export default <X className="" a={<DmText titleClassName="b" />} c={<ActionBtn />} />',
        [],
        {}
      )
    ).toEqual([
      "<X> keeps className",
      "it renders <DmText>",
      "<DmText> keeps titleClassName",
      "it renders <ActionBtn>",
    ])
  })

  it("a DmText, or a real component with a class, inside a value the codemod never saw", () => {
    expect(
      refusalsOf(
        "export default <X />",
        [
          {
            $el: "Stand",
            children: [
              { $el: "DmText", children: "x" },
              { $el: "DmView", props: { className: "mt-[4]" } },
            ],
          },
          { $el: "Stand", props: { className: "recorded, not drawn" } },
        ],
        SPEC.build!
      )
    ).toEqual([
      "value 0 builds a <DmText>",
      "value 0 builds a <DmView> with className",
    ])
  })
})

describe("one site through the codemod", () => {
  it("converts a DmView's class inside an element value", () => {
    const out = convertCase(SPEC, {
      Icon: { $el: "DmView", props: { className: "mt-[4] items-center" } },
      title: "t:help",
      descr: "t:descr",
    })
    expect(out.refusals).toEqual([])
    expect(out.code).toContain(
      "Icon={<DmView style={[a.mt_4, a.items_center]} />}"
    )
  })

  it("refuses a DmText it leaves (font-semibold sets fontWeight, which ds Text leaves to the face)", () => {
    const out = convertCase(SPEC, {
      Icon: {
        $el: "DmText",
        props: { className: "text-12 font-semibold" },
        children: "x",
      },
      title: "t:help",
      descr: "t:descr",
    })
    expect(out.left).toEqual([
      expect.objectContaining({ attr: "className", tag: "DmText" }),
    ])
    expect(out.refusals).toEqual(
      expect.arrayContaining(["it renders <DmText>"])
    )
  })
})
