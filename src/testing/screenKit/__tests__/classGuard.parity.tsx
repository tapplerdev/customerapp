/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the probes are passed as loaders. */
import { describe, expect, it, jest } from "@jest/globals"

import { renderScreen, rowsByPlatform } from "testing/screenKit"
import {
  failOnClassGuardViolations,
  refuseHostClasses,
  takeClassGuardViolations,
} from "testing/classGuard"
import { PARITY_MATRIX, type HostNode } from "testing/hostTreeParity"

/*
 * The kit's class guard (testing/classGuard, installed by setup.ts, W3 plan
 * §5.3, ported from proapp's W3.4), on probe screens
 * (__fixtures__/ClassGuardProbe): one that hands no class, through shared components that hand theirs on as undefined, draws;
 * each one that hands an element a class, or renders DmText or ActionBtn,
 * fails where the element is made, naming the prop, the element and who
 * made it. Each row that expects a refusal takes it from the kept list, so
 * setup.ts's afterEach sees only what a row didn't expect.
 */

type Probe = keyof typeof import("../__fixtures__/ClassGuardProbe")
const probe = (name: Probe) => () =>
  require("../__fixtures__/ClassGuardProbe")[name]

const outcome = async (name: Probe, platform: "ios" | "android" = "ios") => {
  let error: unknown = null
  let tree: HostNode | null = null
  try {
    tree = await renderScreen(probe(name), { platform, navigation: "none" })
  } catch (caught) {
    error = caught
  }
  return {
    tree,
    message: error instanceof Error ? error.message : null,
    kept: takeClassGuardViolations(),
  }
}

describe("the kit's class guard", () => {
  it.each(
    rowsByPlatform(
      [{}],
      PARITY_MATRIX.filter((env) => env.language === "en")
    )
  )(
    "lets a screen with no class draw, shared components' undefined and empty classes included [$env.platform]",
    async ({ env }) => {
      const { tree, message, kept } = await outcome("Clean", env.platform)
      expect(message).toBeNull()
      expect(kept).toEqual([])
      expect(tree).not.toBeNull()
    }
  )

  it.each(
    rowsByPlatform(
      [
        { name: "ClassOnDmView", what: 'className="mt-[4]" reaches <DmView>' },
        {
          name: "RendersDmText",
          what: "<DmText> is rendered: tappler-shared's DmText can't draw in customerapp",
        },
      ] as { name: Probe; what: string }[],
      PARITY_MATRIX.filter((env) => env.language === "en")
    )
  )(
    "refuses $name in every registry [$env.platform]",
    async ({ name, what, env }) => {
      const { message, kept } = await outcome(name, env.platform)
      expect(message).toContain(what)
      expect(message).toContain(`made by <${name}>`)
      expect(kept).toEqual([message])
    }
  )

  it.each([
    ["RendersActionBtn", "<ActionBtn> is rendered", "RendersActionBtn"],
    [
      "ClassThroughCreateElement",
      'className="flex-1 bg-white" reaches <View>',
      "ClassThroughCreateElement",
    ],
    [
      "TwThroughCreateElement",
      'tw="mt-2" reaches <View>',
      "TwThroughCreateElement",
    ],
    [
      "ClassThroughClone",
      'className="px-[16]" reaches <View>',
      "ClassThroughClone",
    ],
    [
      "ClassThroughSpread",
      'titleClassName="text-15" reaches <SkeletonLoader>',
      "ClassThroughSpread",
    ],
  ] as [Probe, string, string][])("refuses %s", async (name, what, maker) => {
    const { message, kept } = await outcome(name)
    expect(message).toContain(what)
    expect(message).toContain(`made by <${maker}>`)
    expect(kept).toEqual([message])
  })

  it("names the components above the one that made it, innermost first", async () => {
    const { message } = await outcome("NestedClass")
    expect(message).toContain('className="mt-[8]" reaches <DmView>')
    expect(message).toContain(
      "made by <Leaf>\n    at Leaf\n    at Branch\n    at NestedClass\n"
    )
  })

  it("fails the test even when an error boundary catches the refusal", async () => {
    // the boundary draws its fallback, so the render itself goes on (quiet:
    // React may log what the boundary caught)
    const quiet = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    let tree: HostNode | null
    try {
      tree = await renderScreen(probe("Swallowed"), { navigation: "none" })
    } finally {
      quiet.mockRestore()
    }
    expect(JSON.stringify(tree)).toContain("Something went wrong")
    // and setup.ts's afterEach fails the test with what it caught
    expect(() => failOnClassGuardViolations()).toThrow(
      /1 refusal\(s\) during this test[^]*className="mt-\[4\]" reaches <DmView>[^]*made by <ClassOnDmView>/
    )
    expect(takeClassGuardViolations()).toEqual([])
  })

  it("fails a host that still carries a class the element check can't read (the tree check)", async () => {
    const { message, kept } = await outcome("ArrayClass")
    expect(message).toContain("a host still carries a class")
    expect(message).toContain('className=["mt-[4]"]')
    expect(kept).toEqual([message])
  })
})

describe("refuseHostClasses", () => {
  const host = (
    type: string,
    props: Record<string, unknown>,
    children: HostNode["children"] = []
  ): HostNode => ({ type, props, children })

  it("hands back a tree with no class", () => {
    const tree = host("View", { style: { flex: 1 } }, ["a", host("Text", {})])
    expect(refuseHostClasses(tree)).toBe(tree)
    expect(refuseHostClasses(null)).toBeNull()
  })

  it("names every host with one, and where it is", () => {
    const tree = host("View", {}, [
      host("Text", { textClassName: "text-14" }),
      host("View", {}, [host("Image", { tw: "w-4" })]),
    ])
    expect(() => refuseHostClasses(tree)).toThrow(
      'root > View[0] > Text: textClassName="text-14"\n  root > View[1] > View[0] > Image: tw="w-4"'
    )
    expect(takeClassGuardViolations()).toHaveLength(1)
  })
})
