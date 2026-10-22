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
 *
 * The fixture beside this file was captured from a class-name row and a real
 * ActionBtn, with NativeWind on; this file compares the token row and ds
 * Button with it, and needs no NativeWind. The live half that drew the
 * class-name and ActionBtn sides (hostTreeParity.pass1.test.tsx) went in W3.4
 * and lives on at the archive tag archive/ca-pass1-tools.
 */

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

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
  withStableHandlerTags,
  withStableIds,
  withStableScreenIds,
  withStableShadowIds,
  type HostNode,
  type ParityAllowance,
} from "../hostTreeParity"

const ROOT = path.resolve(__dirname, "../../..")
const FIXTURE = path.join(__dirname, "__parity__", "hostTreeParity.test.json")

/** A case's stored tree, as the fixture holds it. */
const stored = (name: string) => {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as {
    cases: Record<string, { tree: string }>
    trees: Record<string, HostNode>
  }
  return fixture.trees[fixture.cases[name].tree]
}

// The fixture's "row" cases were captured from a class-name row (DmView
// flex-row px-[16] pt-[20] around a DmText text-15 leading-[19px]
// font-custom600, as hostTreeParity.pass1.test.tsx drew it), and its "actionBtn" ones
// from a real ActionBtn with and without onPress, disabled and loading. The
// same row on tokens: no class name anywhere.
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
  it("holds the class-name row and the four ActionBtns, in every row", () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as {
      cases: Record<string, unknown>
    }
    expect(Object.keys(fixture.cases).sort()).toEqual(
      [
        "row",
        "actionBtn",
        "actionBtn without onPress",
        "actionBtn disabled",
        "actionBtn loading",
      ]
        .flatMap((base) => PARITY_MATRIX.map((env) => parityName(base, env)))
        .sort()
    )
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

  it("English and Arabic resolve ds Text's faces and line heights", () => {
    const en = hostTree(converted(), { language: "en" })
    const ar = hostTree(converted(), { language: "ar" })
    expect(text(en)).toMatchObject({
      fontFamily: "Montserrat-SemiBold",
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
    hostTree(converted(), { language: "ar" })
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

  // customerapp registers no Latin faces (proapp's index.js registers
  // Poppins), so it draws tappler-shared's default. Both halves are pinned:
  // any other table in APP_LATIN_FONT_WEIGHTS (Poppins, say) fails the
  // first, and a registration added to the app fails the second, which is
  // the day the kit's table has to follow it. The second looks for the
  // name, so an aliased import (`{ setLatinFontWeights as register }`) or a
  // namespace's member is found too; App.parity.tsx loads index.js itself,
  // in a registry of its own, and reads the faces it leaves.
  it("draws shared's default Latin faces, Montserrat, as an app that registers none does", () => {
    let defaults: unknown
    jest.isolateModules(() => {
      // A fresh copy of the helpers: the faces before anything registered.
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      const helpers = require("@tappler/shared/src/helpers/helpers") as {
        getLatinFontWeights: () => Record<string, string>
      }
      defaults = { ...helpers.getLatinFontWeights() }
    })
    expect(defaults).toEqual({
      400: "Montserrat-Regular",
      500: "Montserrat-Medium",
      600: "Montserrat-SemiBold",
      700: "Montserrat-Bold",
    })
    expect({ ...APP_LATIN_FONT_WEIGHTS }).toEqual(defaults)
  })

  it("index.js and the app's sources register no Latin faces", () => {
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          return full === path.join(ROOT, "src", "testing") ? [] : walk(full)
        }
        return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [full] : []
      })
    const files = [path.join(ROOT, "index.js"), ...walk(path.join(ROOT, "src"))]
    expect(files.length).toBeGreaterThan(100)
    const registering = files.filter((file) =>
      /\bsetLatinFontWeights\b/.test(fs.readFileSync(file, "utf8"))
    )
    expect(registering.map((file) => path.relative(ROOT, file))).toEqual([])
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

  // proapp's W3.1b rule. Without the plugin no wrapper strips className or
  // rebuilds style, so a passthrough's "" and a `style={cond && x}` reach the
  // host. Neither draws anything with NativeWind or without it, so each
  // compares as absent, on the stored side too (it is normalized again at
  // compare time).
  const storedAs = (props: Record<string, unknown>, type = "View") => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-absent-"))
    const file = path.join(dir, "stored.json")
    fs.writeFileSync(
      file,
      JSON.stringify({
        cases: { it: { capturedAt: "x", tree: "h", a11y: true } },
        trees: { h: { type, props, children: [] } },
      })
    )
    return file
  }
  const bare = (props: Record<string, unknown> = {}, type = "View") =>
    ({ type, props, children: [] }) as HostNode

  it("reads a falsy style (false, null, undefined) as no style, on both sides", () => {
    expect(
      normalizeHostTree({
        type: "View",
        props: {
          style: false,
          contentContainerStyle: null,
          imageStyle: undefined,
          testID: "row",
        },
        children: [],
      } as never)!.props
    ).toEqual({ testID: "row" })
    // a stored false or null style against none, and none against them
    expectParity("it", bare(), { file: storedAs({ style: false }) })
    expectParity("it", bare(), { file: storedAs({ style: null }) })
    expectParity(
      "it",
      normalizeHostTree({
        type: "View",
        props: { style: false },
        children: [],
      } as never),
      { file: storedAs({}) }
    )
    // a string style-named prop is no style object: kept as it is
    expect(
      normalizeHostTree({
        type: "RCTScrollView",
        props: { indicatorStyle: "" },
        children: [],
      } as never)!.props
    ).toEqual({ indicatorStyle: "" })
  })

  it('reads className: "" (any className-family prop, blank) as no className, on both sides', () => {
    expect(
      normalizeHostTree({
        type: "View",
        props: {
          className: "",
          textClassName: "  ",
          classNameTitle: "",
          tw: "",
          testID: "row",
        },
        children: [],
      } as never)!.props
    ).toEqual({ testID: "row" })
    expectParity("it", bare(), { file: storedAs({ className: "" }) })
    expectParity(
      "it",
      normalizeHostTree({
        type: "View",
        props: { className: "" },
        children: [],
      } as never),
      { file: storedAs({}) }
    )
  })

  it("still tells a non-empty className on a host apart, both ways", () => {
    expect(
      normalizeHostTree({
        type: "View",
        props: { className: "px-[4]", tw: "mt-[2]" },
        children: [],
      } as never)!.props
    ).toEqual({ className: "px-[4]", tw: "mt-[2]" })
    expect(() =>
      expectParity("it", bare({ className: "px-[4]" }), {
        file: storedAs({ className: "" }),
      })
    ).toThrow(/className/)
    expect(() =>
      expectParity("it", bare(), { file: storedAs({ className: "px-[4]" }) })
    ).toThrow(/className/)
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

describe("ids from a counter or a random source, made stable on both sides", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "parity-ids-"))
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

  // proapp's shadow-2 cases need the library to read its id shape from;
  // customerapp has none, so nothing can draw one. The day it is installed
  // this fails, and proapp's cases (84f2287c, hostTreeParity.test.tsx) come
  // back with it.
  it("renames nothing for react-native-shadow-2, which customerapp doesn't install", () => {
    expect(() =>
      require.resolve("react-native-shadow-2/package.json")
    ).toThrow()
    const tree: HostNode = {
      type: "RNSVGLinearGradient",
      props: { name: "start.24", fill: "url(#start.24)" },
      children: [],
    }
    expect(withStableShadowIds(tree)).toBe(tree)
  })

  // Gesture handler's wrapped views as they reach a host under jest: each
  // carries the tag the library's counter gave its handler, or -1 before
  // one was made. `first` is where the counter stood for this row.
  const scrollers = (first: number, crossed = false): HostNode => ({
    type: "View",
    props: {},
    children: [
      {
        type: "RCTScrollView",
        props: { handlerTag: first, handlerType: "NativeViewGestureHandler" },
        children: [],
      },
      {
        type: "RCTScrollView",
        props: {
          handlerTag: crossed ? first : first + 1,
          handlerType: "NativeViewGestureHandler",
        },
        children: [],
      },
      { type: "View", props: { handlerTag: -1 }, children: [] },
      { type: "Text", props: {}, children: ["7"] },
    ],
  })

  it("numbers gesture handler's tags by appearance, keeping -1 and texts as they are", () => {
    const stable = withStableHandlerTags(scrollers(7))!
    expect(
      (stable.children as HostNode[]).map((child) => child.props.handlerTag)
    ).toEqual(["#1", "#2", -1, undefined])
    expect((stable.children[3] as HostNode).children).toEqual(["7"])
    expect(withStableHandlerTags(scrollers(31))).toEqual(stable)
  })

  it("compares a row whose counter stood elsewhere as the captured one, and still tells two handlers from one", () => {
    const file = captured(scrollers(3))
    expectParity("it", scrollers(40), { file })
    expect(() => expectParity("it", scrollers(40, true), { file })).toThrow(
      /#2/
    )
  })

  // A native stack's screens as react-native-screens draws them: screenId
  // is the route's key, the name and a fresh 21-character nanoid.
  const stack = (keys: string[]): HostNode => ({
    type: "RNSScreenStack",
    props: {},
    children: keys.map((screenId) => ({
      type: "RNSScreen",
      props: { activityState: 2, screenId },
      children: [],
    })),
  })

  it("cuts a native stack's screen ids back to the route name", () => {
    const first = stack([
      "HomeTabs-6PjhPrDyFXkMzD0rRM-4t",
      "JobDetailScreen-a_9x-Lq3RkTn0pWs2eYuV",
    ])
    const again = stack([
      "HomeTabs-Zx81Lmq0-pQrStUvWxYzA",
      "JobDetailScreen-0000000000000000000ab",
    ])
    expect(again).not.toEqual(first)
    expect(
      (withStableScreenIds(first)!.children as HostNode[]).map(
        (screen) => screen.props.screenId
      )
    ).toEqual(["HomeTabs", "JobDetailScreen"])
    expect(withStableScreenIds(again)).toEqual(withStableScreenIds(first))
    expectParity("it", again, { file: captured(first) })
  })

  it("still fails on another route, and keeps an id that isn't a route key", () => {
    const file = captured(stack(["HomeTabs-6PjhPrDyFXkMzD0rRM-4t"]))
    expect(() =>
      expectParity("it", stack(["AccountScreen-6PjhPrDyFXkMzD0rRM-4t"]), {
        file,
      })
    ).toThrow(/AccountScreen/)
    expect(
      withStableScreenIds(stack(["home"]))!.children[0] as HostNode
    ).toMatchObject({ props: { screenId: "home" } })
  })

  it("withStableIds is all of them, and what expectParity applies", () => {
    const tree: HostNode = {
      type: "View",
      props: {},
      children: [scrollers(9), stack(["HomeTabs-6PjhPrDyFXkMzD0rRM-4t"])],
    }
    expect(withStableIds(tree)).toEqual(
      withStableScreenIds(withStableHandlerTags(tree))
    )
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
    // a real ActionBtn's, as the fixture holds it
    expect(isButtonRoot(stored(parityName("actionBtn", env)))).toBe(true)
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
      const name = parityName("actionBtn", matrixEnv)
      const file = FIXTURE
      const tree = hostTree(<DsButton title="Save" onPress={noop} />, matrixEnv)
      expect(() => expectParity(name, tree, { file })).toThrow(/minHeight/)
      expect(() =>
        expectParity(name, tree, { file, allow: ["buttonHeight"] })
      ).toThrow(/accessibilityRole/)
      const { accepted } = expectParity(name, tree, {
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
      // `disable || isLoading` is false there, and ActionBtn hands it on.
      const name = parityName("actionBtn without onPress", matrixEnv)
      const file = FIXTURE
      const tree = hostTree(
        <DsButton title="Save" isLoading={false} />,
        matrixEnv
      )
      expect(() =>
        expectParity(name, tree, { file, allow: ["buttonHeight"] })
      ).toThrow(/disabled/)
      const { accepted } = expectParity(name, tree, {
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

  // Button says what it is (Button.tsx's touchable): named by what its label
  // box draws (title, second title, description, joined with ", "), a
  // button, and the touchable's state (disabled while disabled or loading),
  // busy while the spinner shows. The allowance requires those values, not
  // any (review M4). The mutants are the review's (B's mutants.py: A1-A3,
  // R3), on the host tree such a Button draws.
  const ALLOW_BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]
  const saying = (tree: HostNode, props: Record<string, unknown>): HostNode => ({
    ...tree,
    props: { ...tree.props, ...props },
  })

  it.each(PARITY_MATRIX)(
    "a real disabled, and a real loading, ActionBtn -> Button pass with Button's own state [$language $platform]",
    (matrixEnv) => {
      // a real ActionBtn's, as the fixture holds them
      const disabled = expectParity(
        "it",
        hostTree(<DsButton title="Save" onPress={noop} disabled />, matrixEnv),
        {
          file: captured(stored(parityName("actionBtn disabled", matrixEnv))),
          allow: ALLOW_BUTTON,
        }
      )
      const loading = expectParity(
        "it",
        hostTree(<DsButton title="Save" onPress={noop} isLoading />, matrixEnv),
        {
          file: captured(stored(parityName("actionBtn loading", matrixEnv))),
          allow: ALLOW_BUTTON,
        }
      )
      expect([disabled, loading].map(({ accepted }) => accepted[1].what)).toEqual([
        "accessibilityLabel, accessibilityRole (Button)",
        "accessibilityLabel, accessibilityRole, accessibilityState (Button)",
      ])
    }
  )

  it.each([
    [
      "A1 busy while disabled",
      <DsButton title="Save" onPress={noop} disabled />,
      "actionBtn disabled",
      { accessibilityState: { busy: true, disabled: true } },
      /accessibilityState \{"busy":true,"disabled":true\}, not \{"disabled":true\}/,
    ],
    [
      "A2 says disabled when enabled",
      <DsButton title="Save" onPress={noop} />,
      "actionBtn",
      { accessibilityState: { disabled: true } },
      /accessibilityState \{"disabled":true\}, not \{\}/,
    ],
    [
      "A3 a wrong label",
      <DsButton title="Save" onPress={noop} />,
      "actionBtn",
      { accessibilityLabel: "Save button" },
      /accessibilityLabel "Save button", not "Save"/,
    ],
    [
      "R3 loading without busy",
      <DsButton title="Save" onPress={noop} isLoading />,
      "actionBtn loading",
      { accessibilityState: { disabled: true } },
      /accessibilityState \{"disabled":true\}, not \{"busy":true,"disabled":true\}/,
    ],
    [
      "another role",
      <DsButton title="Save" onPress={noop} />,
      "actionBtn",
      { accessibilityRole: "link" },
      /accessibilityRole "link", not "button"/,
    ],
    [
      "no name while loading",
      <DsButton title="Save" onPress={noop} isLoading />,
      "actionBtn loading",
      { accessibilityLabel: "" },
      /accessibilityLabel "", not a name/,
    ],
  ])(
    "mutant: Button's root saying something Button doesn't fails with the allowance: %s",
    (_label, after, before, says, message) => {
      const tree = saying(hostTree(after, env)!, says)
      // `before` names the ActionBtn tree the fixture holds
      const file = captured(stored(parityName(before as string, env)))
      expect(() => expectParity("it", tree, { file, allow: ALLOW_BUTTON })).toThrow(
        message
      )
    }
  )

  it("names a Button by its title, second title and description, as Button does", () => {
    const tree = hostTree(
      <DsButton
        title="Save"
        secondTitle="20 EGP"
        description="Pay on delivery"
        onPress={noop}
      />,
      env
    )!
    expect(tree.props.accessibilityLabel).toBe("Save, 20 EGP, Pay on delivery")
    // What ActionBtn said of the same button: no name, no role.
    const { accessibilityLabel, accessibilityRole, ...actionBtn } = tree.props
    expect([accessibilityLabel, accessibilityRole]).toEqual([
      "Save, 20 EGP, Pay on delivery",
      "button",
    ])
    const file = captured({ ...tree, props: actionBtn })
    expect(
      expectParity("it", tree, { file, allow: ["buttonAccessibility"] }).accepted
    ).toEqual([
      { path: "root<View>", what: "accessibilityLabel, accessibilityRole (Button)" },
    ])
    expect(() =>
      expectParity("it", saying(tree, { accessibilityLabel: "Save" }), {
        file,
        allow: ["buttonAccessibility"],
      })
    ).toThrow(/accessibilityLabel "Save", not "Save, 20 EGP, Pay on delivery"/)
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
