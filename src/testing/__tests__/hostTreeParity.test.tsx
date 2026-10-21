import { afterEach, describe, expect, it, jest } from "@jest/globals"
import fs from "fs"
import os from "os"
import path from "path"
import React from "react"
import { I18nManager, Platform, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

/*
 * The parity helper itself. What a pass-1 conversion leans on, each checked
 * against a control: the environment switches are real (an Arabic render is
 * Arabic, an Android render reads Android), a conversion that keeps the
 * pixels passes, a 1pt change fails, and a case that was never captured
 * fails instead of capturing itself.
 */

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

// eslint-disable-next-line import/first
import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
// eslint-disable-next-line import/first
import {
  Button as DsButton,
  Text as DsText,
  a,
  px,
} from "@tappler/shared/src/ds"
// eslint-disable-next-line import/first
import i18n from "locales/i18n"
// eslint-disable-next-line import/first
import {
  APP_LATIN_FONT_WEIGHTS,
  PARITY_MATRIX,
  PIXEL_FREE_PROPS,
  captureMode,
  expectParity,
  hostTree,
  isButtonRoot,
  normalizeHostTree,
  withoutAccessibility,
  parityFlags,
  parityName,
  renderParity,
  resolveSafeArea,
  safeAreaEdgeValue,
  withStableShadowIds,
  type HostNode,
} from "../hostTreeParity"

const ROOT = path.resolve(__dirname, "../../..")

// The fixture beside this file holds these four cases, captured from the
// "before" render below with `yarn ds:parity:capture <this file> -t before`.
const before = () => (
  <DmView className="flex-row px-[16] pt-[20]">
    <DmText className="text-15 leading-[19px] font-custom600">
      Account details
    </DmText>
  </DmView>
)

// The same row on tokens: no class name anywhere.
const converted = (padding = 16, leading = px(19)) => (
  <View
    style={[
      a.flex_row,
      { paddingLeft: padding, paddingRight: padding },
      a.pt_20,
    ]}
  >
    <DsText size={15} weight="semibold" leading={leading}>
      Account details
    </DsText>
  </View>
)

const compareOnly = captureMode() === "compare" ? it : it.skip

describe("the captured fixture", () => {
  it.each(PARITY_MATRIX)("the before tree [$language $platform]", (env) => {
    expectParity(parityName("row", env), hostTree(before(), env))
  })

  compareOnly.each(PARITY_MATRIX)(
    "positive control: the token version passes [$language $platform]",
    (env) => {
      expectParity(parityName("row", env), hostTree(converted(), env))
    }
  )

  compareOnly.each(PARITY_MATRIX)(
    "a 1pt padding change fails [$language $platform]",
    (env) => {
      expect(() =>
        expectParity(parityName("row", env), hostTree(converted(17), env))
      ).toThrow(/paddingLeft/)
    }
  )

  compareOnly.each(PARITY_MATRIX)(
    "a 1pt line-height change fails [$language $platform]",
    (env) => {
      expect(() =>
        expectParity(
          parityName("row", env),
          hostTree(converted(16, px(20)), env)
        )
      ).toThrow(/lineHeight/)
    }
  )
})

describe("the environment is the one asked for", () => {
  const text = (tree: HostNode | null) =>
    (tree?.children[0] as HostNode).props.style

  it("English and Arabic resolve DmText's own faces and line heights", () => {
    const en = hostTree(before(), { language: "en" })
    const ar = hostTree(before(), { language: "ar" })
    expect(text(en)).toMatchObject({
      fontFamily: "Poppins-SemiBold",
      lineHeight: 19,
    })
    expect(text(ar)).toMatchObject({
      fontFamily: "TheSans-Bold",
      lineHeight: 19 * 1.32,
    })
  })

  it("Arabic is right-to-left, English isn't, and both are put back", () => {
    const Probe = () => <Text>{I18nManager.isRTL ? "rtl" : "ltr"}</Text>
    expect(hostTree(<Probe />, { language: "ar" })?.children).toEqual(["rtl"])
    expect(hostTree(<Probe />, { language: "en" })?.children).toEqual(["ltr"])
    expect(I18nManager.isRTL).toBe(false)
  })

  it("Android switches Platform.OS and Platform.select, and iOS comes back", () => {
    const Probe = () => (
      <Text>
        {Platform.OS} {Platform.select({ ios: "i", android: "a" })}
      </Text>
    )
    expect(
      hostTree(<Probe />, { language: "en", platform: "android" })?.children
    ).toEqual(["android a"])
    expect(hostTree(<Probe />, { language: "en" })?.children).toEqual(["ios i"])
    expect(Platform.OS).toBe("ios")
  })

  it("puts the language back after the render", () => {
    i18n.changeLanguage("en")
    hostTree(before(), { language: "ar" })
    expect(i18n.language).toBe("en")
  })

  it("serves the insets to useSafeAreaInsets with no provider view", () => {
    const Probe = () => <Text>{useSafeAreaInsets().bottom}</Text>
    const tree = hostTree(<Probe />, {
      language: "en",
      insets: { bottom: 34 },
    })
    expect(tree).toEqual({ type: "Text", props: {}, children: ["34"] })
  })

  it("keeps the environment for a session until unmount", () => {
    const session = renderParity(<View />, {
      language: "ar",
      platform: "android",
    })
    expect([Platform.OS, I18nManager.isRTL, i18n.language]).toEqual([
      "android",
      true,
      "ar",
    ])
    session.unmount()
    expect([Platform.OS, I18nManager.isRTL]).toEqual(["ios", false])
  })

  it("registers the Latin faces index.js registers", () => {
    const entry = fs.readFileSync(path.join(ROOT, "index.js"), "utf8")
    const call = entry.match(/setLatinFontWeights\(\{([\s\S]*?)\}\)/)
    expect(call).not.toBeNull()
    const registered = Object.fromEntries(
      [...call![1].matchAll(/(\d{3}):\s*"([^"]+)"/g)].map((m) => [m[1], m[2]])
    )
    expect(registered).toEqual(
      Object.fromEntries(
        Object.entries(APP_LATIN_FONT_WEIGHTS).map(([k, v]) => [k, v])
      )
    )
  })
})

describe("normalizing", () => {
  it("drops functions and undefined, flattens style, joins text runs, sorts keys", () => {
    const tree = normalizeHostTree({
      type: "View",
      props: {
        onPress: () => undefined,
        testID: "row",
        hitSlop: { top: undefined, bottom: 4 },
        style: [{ padding: 4, margin: undefined }, [{ padding: 6 }], null],
      },
      children: [
        {
          type: "Text",
          props: { style: [undefined, {}] },
          children: ["Hello ", "world"],
        },
      ],
    } as never)
    expect(tree).toEqual({
      type: "View",
      props: {
        hitSlop: { bottom: 4 },
        style: { padding: 6 },
        testID: "row",
      },
      children: [{ type: "Text", props: {}, children: ["Hello world"] }],
    })
    expect(Object.keys(tree!.props)).toEqual(["hitSlop", "style", "testID"])
  })

  it("flattens every style prop, and keeps a string one as it is", () => {
    const tree = normalizeHostTree({
      type: "RCTScrollView",
      props: {
        contentContainerStyle: [{ flexGrow: 1 }, undefined, false],
        indicatorStyle: "black",
      },
      children: [],
    } as never)
    expect(tree!.props).toEqual({
      contentContainerStyle: { flexGrow: 1 },
      indicatorStyle: "black",
    })
  })

  it("leaves out a React element, a ref or a cycle a mock handed a host, and names an instance it can't store", () => {
    const cycle: Record<string, unknown> = { name: "a" }
    cycle.self = cycle
    class Handle {
      self = this
    }
    const tree = normalizeHostTree({
      type: "RCTScrollView",
      props: {
        ListHeaderComponent: <View />,
        scrollableRef: { current: null },
        nested: cycle,
        handle: new Handle(),
        when: new Date(0),
        keep: { current: 1, other: 2 },
      },
      children: [],
    } as never)
    expect(tree!.props).toEqual({
      nested: { name: "a", self: "[Circular]" },
      handle: "[Handle]",
      when: "1970-01-01T00:00:00.000Z",
      keep: { current: 1, other: 2 },
    })
  })

  it("keeps the accessibility props, like every other prop", () => {
    expect(PIXEL_FREE_PROPS).toEqual([
      "accessibilityLabel",
      "accessibilityRole",
      "accessibilityState",
    ])
    const props = {
      accessibilityLabel: "Save",
      accessibilityRole: "button",
      accessibilityState: { busy: true },
      accessible: true,
      focusable: true,
    }
    const tree = normalizeHostTree({
      type: "View",
      props,
      children: [],
    } as never)
    expect(tree!.props).toEqual(props)
    expect(withoutAccessibility(tree)!.props).toEqual({
      accessible: true,
      focusable: true,
    })
  })

  it("compares a stored case through today's rules (one captured before them still matches)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-old-"))
    const file = path.join(dir, "old.json")
    const old = {
      type: "View",
      props: { accessibilityState: {} },
      children: [],
    }
    fs.writeFileSync(
      file,
      JSON.stringify({
        cases: { old: { capturedAt: "x", tree: "h" } },
        trees: { h: old },
      })
    )
    expectParity("old", { type: "View", props: {}, children: [] }, { file })
  })
})

describe("safe area, as the native view lays it out", () => {
  it("runs the library's own getEdgeValue: off, additive, maximum", () => {
    expect(safeAreaEdgeValue("off", 34, 45)).toBe(45)
    expect(safeAreaEdgeValue("additive", 34, 11)).toBe(45)
    expect(safeAreaEdgeValue("maximum", 34, 45)).toBe(45)
    expect(safeAreaEdgeValue("maximum", 48, 45)).toBe(48)
  })

  it("reads an edge's padding, then its axis, then padding, as valueFromEdges does", () => {
    const node = (style: Record<string, unknown>): HostNode => ({
      type: "RNCSafeAreaView",
      props: {
        edges: { top: "off", right: "off", bottom: "additive", left: "off" },
        style,
      },
      children: [],
    })
    const insets = { top: 0, right: 0, bottom: 10, left: 0 }
    const bottom = (style: Record<string, unknown>) => {
      const resolved = resolveSafeArea(node(style), insets).props
      return (resolved.style as Record<string, number>).paddingBottom
    }
    const all = { paddingBottom: 1, paddingVertical: 2, padding: 3 }
    expect(bottom(all)).toBe(11)
    expect(bottom({ paddingVertical: 2, padding: 3 })).toBe(12)
    expect(bottom({ padding: 3 })).toBe(13)
    expect(bottom({})).toBe(10)
  })

  it("refuses what the model doesn't cover", () => {
    const node: HostNode = {
      type: "RNCSafeAreaView",
      props: {
        edges: { top: "off", right: "off", bottom: "off", left: "off" },
        style: { paddingStart: 4 },
      },
      children: [],
    }
    expect(() =>
      resolveSafeArea(node, { top: 0, right: 0, bottom: 0, left: 0 })
    ).toThrow(/paddingStart/)
  })
})

describe("fixtures", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-"))
  const file = path.join(dir, "case.json")
  const tree: HostNode = { type: "View", props: {}, children: [] }
  const saved = parityFlags.DS_PARITY_CAPTURE

  afterEach(() => {
    if (saved === undefined) delete parityFlags.DS_PARITY_CAPTURE
    else parityFlags.DS_PARITY_CAPTURE = saved
  })

  it("fails on a case that was never captured, with how to capture it", () => {
    delete parityFlags.DS_PARITY_CAPTURE
    expect(() => expectParity("missing", tree, { file })).toThrow(
      /No parity case "missing".*yarn ds:parity:capture/
    )
    expect(fs.existsSync(file)).toBe(false)
  })

  it("captures in capture mode, then compares", () => {
    parityFlags.DS_PARITY_CAPTURE = "1"
    expectParity("one", tree, { file })
    delete parityFlags.DS_PARITY_CAPTURE
    expectParity("one", tree, { file })
    expect(() =>
      expectParity("one", { ...tree, type: "Text" }, { file })
    ).toThrow()
  })

  it("won't overwrite a captured case unless forced", () => {
    parityFlags.DS_PARITY_CAPTURE = "1"
    expect(() =>
      expectParity("one", { ...tree, type: "Text" }, { file })
    ).toThrow(/already captured/)
    parityFlags.DS_PARITY_CAPTURE = "force"
    expectParity("one", { ...tree, type: "Text" }, { file })
    delete parityFlags.DS_PARITY_CAPTURE
    expectParity("one", { ...tree, type: "Text" }, { file })
  })
})

describe("react-native-shadow-2's gradient ids, numbered by appearance", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-shadow-"))
  let count = 0
  const captured = (stored: HostNode) => {
    count += 1
    const file = path.join(dir, `case-${count}.json`)
    fs.writeFileSync(
      file,
      JSON.stringify({
        cases: { it: { capturedAt: "test", tree: "h", a11y: true } },
        trees: { h: stored },
      })
    )
    return file
  }

  // One side of a Shadow as react-native-svg draws it (as in My Account's
  // verify screens): the gradient named in its defs, the rect filled with it.
  const side = (gradient: string, filled = gradient): HostNode => ({
    type: "RNSVGSvgView",
    props: { bbWidth: 6 },
    children: [
      {
        type: "RNSVGDefs",
        props: {},
        children: [
          {
            type: "RNSVGLinearGradient",
            props: { name: gradient, x1: "0" },
            children: [],
          },
        ],
      },
      {
        type: "RNSVGRect",
        props: { fill: { brushRef: filled, type: 1 }, width: 5 },
        children: [],
      },
    ],
  })
  // Two Shadows whose suffixes the counter gave as `first` and `first + 1`;
  // `crossed` points the first one's rect at the second one's gradient. The
  // label is a text that reads like an id: drawn, so never renamed.
  const twoShadows = (first: number, crossed = false): HostNode => ({
    type: "View",
    props: {},
    children: [
      side(`start.${first}`, `start.${crossed ? first + 1 : first}`),
      side(`end.${first}`),
      side(`start.${first + 1}`),
      { type: "Text", props: {}, children: ["start.24"] },
    ],
  })

  it("two trees that differ only in the counter compare equal", () => {
    const early = twoShadows(0)
    const late = twoShadows(24)
    expect(late).not.toEqual(early)
    expect(withStableShadowIds(late)).toEqual(withStableShadowIds(early))
    // a fixture captured with raw ids, compared with another run's
    expectParity("it", late, { file: captured(early) })
    expectParity("it", early, { file: captured(late) })
  })

  it("numbers each Shadow's sides and corners alike, and leaves texts and other ids alone", () => {
    const stable = withStableShadowIds({
      ...twoShadows(24),
      props: { mask: "maskInside.31", fill: "url(#topStart.31)", id: "paint0.31" },
    })!
    expect(stable.props).toEqual({
      fill: "url(#topStart.#1)",
      id: "paint0.31",
      mask: "maskInside.#1",
    })
    const [startSide, endSide, second, label] = stable.children as HostNode[]
    expect(JSON.stringify(startSide)).toContain('"name":"start.#2"')
    expect(JSON.stringify(startSide)).toContain('"brushRef":"start.#2"')
    expect(JSON.stringify(endSide)).toContain('"name":"end.#2"')
    expect(JSON.stringify(second)).toContain('"name":"start.#3"')
    expect(label.children).toEqual(["start.24"])
  })

  it("a tree whose rect points at another Shadow's gradient than its fixture's still fails", () => {
    const file = captured(twoShadows(0))
    expect(() => expectParity("it", twoShadows(24, true), { file })).toThrow(
      /brushRef/
    )
    // and so does one with a side's gradient swapped for another side's
    const swapped = twoShadows(24)
    swapped.children[1] = side("start.24")
    expect(() => expectParity("it", swapped, { file })).toThrow(/end\.#1/)
  })
})

describe("the Button allowances (opt-in, a Button's root only)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-allow-"))
  let count = 0
  const noop = () => undefined
  const env = { language: "en" } as const

  // A fixture holding `stored` as the captured case, in a file of its own
  // (the helper caches a file by mtime, so each case gets a fresh one),
  // captured as a capture run writes one today (accessibility props kept).
  const captured = (stored: HostNode | null) => {
    count += 1
    const file = path.join(dir, `case-${count}.json`)
    fs.writeFileSync(
      file,
      JSON.stringify({
        cases: { it: { capturedAt: "test", tree: "h", a11y: true } },
        trees: { h: stored },
      })
    )
    return file
  }

  // What ActionBtn drew where Button now draws its root: the same node with
  // `height` for Button's `minHeight` (and, without an onPress, the
  // touchable's `disabled` flag on the View).
  const asActionBtn = (
    tree: HostNode,
    change: (style: Record<string, unknown>) => Record<string, unknown> = (
      style
    ) => {
      const { minHeight, ...rest } = style
      return { ...rest, height: minHeight }
    },
    extra: Record<string, unknown> = {}
  ): HostNode => ({
    ...tree,
    props: {
      ...tree.props,
      ...extra,
      style: change(tree.props.style as Record<string, unknown>),
    },
  })

  const button = (props: { onPress?: () => void; isLoading?: boolean } = {}) =>
    hostTree(<DsButton title="Save" onPress={noop} {...props} />, env)!

  it("finds a button's root (Button's, and ActionBtn's, whose label box Button draws), not a plain view's", () => {
    expect(isButtonRoot(button())).toBe(true)
    expect(isButtonRoot(button({ isLoading: true }))).toBe(true)
    expect(isButtonRoot(button({ onPress: undefined }))).toBe(true)
    const actionBtn = hostTree(<ActionBtn title="Save" onPress={noop} />, env)!
    expect(isButtonRoot(actionBtn)).toBe(true)
    expect(
      isButtonRoot(
        hostTree(
          <View style={{ minHeight: 51 }}>
            <View style={{ flexGrow: 1 }} />
          </View>,
          env
        )!
      )
    ).toBe(false)
    expect(
      isButtonRoot(
        hostTree(
          <View style={{ minHeight: 51 }}>
            <Text>Save</Text>
          </View>,
          env
        )!
      )
    ).toBe(false)
  })

  it("is exact by default: Button's minHeight against a captured height fails", () => {
    const tree = button()
    expect((tree.props.style as Record<string, unknown>).minHeight).toBe(51)
    expect(() =>
      expectParity("it", tree, { file: captured(asActionBtn(tree)) })
    ).toThrow(/minHeight/)
  })

  it("accepts height -> minHeight on a Button's root when asked, and says so", () => {
    const tree = button()
    const { accepted } = expectParity("it", tree, {
      file: captured(asActionBtn(tree)),
      allow: ["buttonHeight"],
    })
    expect(accepted).toEqual([
      { path: "root<View>", what: "height 51 -> minHeight 51 (Button)" },
    ])
  })

  it.each(PARITY_MATRIX)(
    "a real ActionBtn -> Button conversion passes with the height and accessibility allowances [$language $platform]",
    (matrixEnv) => {
      const file = captured(
        hostTree(<ActionBtn title="Save" onPress={noop} />, matrixEnv)
      )
      const tree = hostTree(<DsButton title="Save" onPress={noop} />, matrixEnv)
      expect(() => expectParity("it", tree, { file })).toThrow(/minHeight/)
      expect(() =>
        expectParity("it", tree, { file, allow: ["buttonHeight"] })
      ).toThrow(/accessibilityRole/)
      const { accepted } = expectParity("it", tree, {
        file,
        allow: ["buttonHeight", "buttonAccessibility"],
      })
      expect(accepted.map((delta) => delta.what)).toEqual([
        "height 51 -> minHeight 51 (Button)",
        "accessibilityLabel, accessibilityRole (Button)",
      ])
    }
  )

  it.each(PARITY_MATRIX)(
    "a real ActionBtn without onPress -> Button needs both allowances [$language $platform]",
    (matrixEnv) => {
      // `disable || isLoading` is false here, and ActionBtn hands it on.
      const file = captured(
        hostTree(<ActionBtn title="Save" isLoading={false} />, matrixEnv)
      )
      const tree = hostTree(
        <DsButton title="Save" isLoading={false} />,
        matrixEnv
      )
      expect(() =>
        expectParity("it", tree, { file, allow: ["buttonHeight"] })
      ).toThrow(/disabled/)
      const { accepted } = expectParity("it", tree, {
        file,
        allow: ["buttonHeight", "buttonDisabledView"],
      })
      expect(accepted).toHaveLength(2)
    }
  )

  it("finds a Button's root inside a bigger tree", () => {
    const tree = hostTree(
      <View style={{ padding: 4 }}>
        <Text>Title</Text>
        <DsButton title="Save" onPress={noop} />
      </View>,
      env
    )!
    const stored: HostNode = {
      ...tree,
      children: [tree.children[0], asActionBtn(tree.children[1] as HostNode)],
    }
    const { accepted } = expectParity("it", tree, {
      file: captured(stored),
      allow: ["buttonHeight"],
    })
    expect(accepted.map((delta) => delta.path)).toEqual(["root<View>[1]<View>"])
  })

  it("an accessibility prop lost anywhere but a Button's root fails, even with the allowance", () => {
    const row = (label?: string) =>
      hostTree(
        <View>
          <View accessibilityLabel={label} style={{ padding: 4 }} />
          <DsButton title="Save" onPress={noop} />
        </View>,
        env
      )!
    const file = captured(row("Remove photo"))
    expect(() =>
      expectParity("it", row(undefined), {
        file,
        allow: ["buttonHeight", "buttonDisabledView", "buttonAccessibility"],
      })
    ).toThrow(/accessibilityLabel/)
    expect(expectParity("it", row("Remove photo"), { file })).toEqual({
      accepted: [],
    })
  })

  it("mutant: a Button's label lost inside its root (not on it) fails with the allowance", () => {
    const tree = button()
    const label = (tree.children[0] as HostNode).children[0] as HostNode
    const stored: HostNode = {
      ...tree,
      children: [
        {
          ...(tree.children[0] as HostNode),
          children: [
            {
              ...label,
              props: { ...label.props, accessibilityLabel: "Save" },
            },
          ],
        },
      ],
    }
    expect(() =>
      expectParity("it", tree, {
        file: captured(stored),
        allow: ["buttonAccessibility"],
      })
    ).toThrow(/accessibilityLabel/)
  })

  it("a capture run marks its cases, and they compare the accessibility props", () => {
    const saved = parityFlags.DS_PARITY_CAPTURE
    const file = path.join(dir, "marked.json")
    const view = (label?: string) =>
      hostTree(<View accessibilityLabel={label} />, env)
    try {
      parityFlags.DS_PARITY_CAPTURE = "1"
      expectParity("it", view("Close"), { file })
    } finally {
      if (saved === undefined) delete parityFlags.DS_PARITY_CAPTURE
      else parityFlags.DS_PARITY_CAPTURE = saved
    }
    const written = JSON.parse(fs.readFileSync(file, "utf8"))
    expect(written.cases.it.a11y).toBe(true)
    expect(() => expectParity("it", view(undefined), { file })).toThrow(
      /accessibilityLabel/
    )
    expectParity("it", view("Close"), { file })
  })

  it("mutant: a plain view's height -> minHeight still fails with the allowance", () => {
    const tree = hostTree(
      <View style={{ minHeight: 51 }}>
        <Text>Save</Text>
      </View>,
      env
    )!
    expect(() =>
      expectParity("it", tree, {
        file: captured(asActionBtn(tree)),
        allow: ["buttonHeight", "buttonDisabledView"],
      })
    ).toThrow(/minHeight/)
  })

  it("mutant: another style key changed on the root fails with the allowance", () => {
    const tree = button()
    const stored = asActionBtn(tree, (style) => {
      const { minHeight, ...rest } = style
      return { ...rest, height: minHeight, borderRadius: 4 }
    })
    expect(() =>
      expectParity("it", tree, {
        file: captured(stored),
        allow: ["buttonHeight"],
      })
    ).toThrow(/borderRadius/)
  })

  it("mutant: a minHeight that isn't the captured height fails with the allowance", () => {
    const tree = button()
    const stored = asActionBtn(tree, (style) => {
      const { minHeight, ...rest } = style
      return { ...rest, height: 50 }
    })
    expect(() =>
      expectParity("it", tree, {
        file: captured(stored),
        allow: ["buttonHeight"],
      })
    ).toThrow()
  })

  it("mutant: a captured minHeight (not a height) is not a delta to accept", () => {
    const tree = button()
    const stored = asActionBtn(tree, (style) => ({ ...style, minHeight: 50 }))
    expect(() =>
      expectParity("it", tree, {
        file: captured(stored),
        allow: ["buttonHeight"],
      })
    ).toThrow(/minHeight/)
  })

  it("accepts ActionBtn's `disabled` on a View with no onPress, only when asked", () => {
    const tree = button({ onPress: undefined })
    expect(tree.props.disabled).toBeUndefined()
    expect(tree.props.accessible).toBeUndefined()
    const stored = asActionBtn(tree, undefined, { disabled: false })
    expect(() =>
      expectParity("it", tree, {
        file: captured(stored),
        allow: ["buttonHeight"],
      })
    ).toThrow(/disabled/)
    const { accepted } = expectParity("it", tree, {
      file: captured(stored),
      allow: ["buttonHeight", "buttonDisabledView"],
    })
    expect(accepted.map((delta) => delta.what)).toEqual([
      "height 51 -> minHeight 51 (Button)",
      "disabled=false on a View (ActionBtn without onPress)",
    ])
  })

  it("mutant: `disabled` missing from a touchable Button is not accepted", () => {
    const tree = button()
    expect(tree.props.accessible).toBe(true)
    const stored = asActionBtn(tree, undefined, { disabled: true })
    const { disabled, ...props } = stored.props
    expect(disabled).toBe(true)
    const current: HostNode = { ...tree, props: { ...tree.props } }
    delete current.props.disabled
    expect(() =>
      expectParity("it", current, {
        file: captured({ ...stored, props: { ...props, disabled } }),
        allow: ["buttonHeight", "buttonDisabledView"],
      })
    ).toThrow(/disabled/)
  })

  it("leaves a capture alone (allowances apply to a comparison only)", () => {
    const saved = parityFlags.DS_PARITY_CAPTURE
    parityFlags.DS_PARITY_CAPTURE = "1"
    try {
      const file = path.join(dir, "capture.json")
      const tree = button()
      expect(
        expectParity("it", tree, { file, allow: ["buttonHeight"] })
      ).toEqual({ accepted: [] })
      const written = JSON.parse(fs.readFileSync(file, "utf8"))
      expect(Object.values(written.trees)).toEqual([tree])
    } finally {
      if (saved === undefined) delete parityFlags.DS_PARITY_CAPTURE
      else parityFlags.DS_PARITY_CAPTURE = saved
    }
  })
})

describe("the capture flags survive the app's Babel config", () => {
  // babel.config.js runs react-native-dotenv, which swaps `process.env.NAME`
  // for the value it sees at transform time, and jest caches transforms. A
  // flag read that way is baked into the cache by the first capture run.
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const babel = require("@babel/core")
  const transform = (code: string, file: string) =>
    babel.transformSync(code, {
      filename: file,
      cwd: ROOT,
      root: ROOT,
      configFile: path.join(ROOT, "babel.config.js"),
      babelrc: false,
      caller: { name: "metro", bundler: "metro", platform: "ios" },
    }).code as string
  const flags = process.env as Record<string, string | undefined>
  const saved = flags.DS_PARITY_CAPTURE

  afterEach(() => {
    if (saved === undefined) delete flags.DS_PARITY_CAPTURE
    else flags.DS_PARITY_CAPTURE = saved
  })

  it("inlines a plain process.env read (control: the trap is real)", () => {
    flags.DS_PARITY_CAPTURE = "sentinel-7f3a"
    const out = transform(
      "export const mode = process.env.DS_PARITY_CAPTURE\n",
      path.join(ROOT, "src/testing/probe.ts")
    )
    expect(out).toContain("sentinel-7f3a")
  })

  it("leaves the helper's own read alone", () => {
    flags.DS_PARITY_CAPTURE = "sentinel-7f3a"
    const file = path.join(ROOT, "src/testing/hostTreeParity.ts")
    const out = transform(fs.readFileSync(file, "utf8"), file)
    expect(out).not.toContain("sentinel-7f3a")
  })
})
