/**
 * Jest only (it reads and writes fixture files and drives the test renderer;
 * never import it from app code).
 *
 * Host-tree parity: what a component hands React Native's native views,
 * compared against a JSON fixture captured from the code BEFORE a change. It
 * is the pass-1 proof of the design-system migration: a screen converted from
 * class names to tokens has to give the native views exactly what it gave
 * them before, in English and Arabic, on iOS and Android. customerapp's copy
 * of proapp's (84f2287c, with archive/ds-pass1-tools' normaliser rule).
 *
 * The render is the real one: jest runs NativeWind's Babel step and its
 * runtime, so a className resolves to the style the app gets. What the
 * session sets up, and puts back when it unmounts:
 * - the app's i18next on `en` or `ar` (jest starts it on "en-US", where
 *   DmText resolves no font family at all), and the design system's language
 *   provider on the same value
 * - I18nManager.isRTL for Arabic, as BootstrapScreen's forceRTL does
 * - Platform.OS and Platform.select for iOS or Android. Only values read at
 *   render time follow: a module that captured Platform.OS at import keeps
 *   the platform it was loaded under (the screen kit loads each platform in
 *   a registry of its own for those)
 * - the Latin faces customerapp draws: shared's default, Montserrat, because
 *   its index.js registers none (APP_LATIN_FONT_WEIGHTS, pinned by a test)
 * - safe-area insets through the library's own contexts, so useSafeAreaInsets
 *   works with no provider view in the tree
 *
 * The tree is normalized before it is compared: functions, undefined props and
 * React elements a mock handed a host dropped, every style prop flattened (`style`, `contentContainerStyle`...;
 * an empty, false or null one dropped), an empty class string dropped (both
 * were NativeWind's wrapper's to tidy, and draw nothing either way: see
 * drawsNothing), adjacent text runs joined, keys sorted. Every other
 * prop is kept and compared, the accessibility props included (a conversion
 * that loses an accessibilityLabel fails). A SafeAreaView is resolved by
 * default into the padding its native view lays out with (see
 * resolveSafeArea below), so a screen that moves from today's inset formula
 * to `bottom: 'maximum'` compares by the gap it draws rather than by the
 * props that produce it. At compare time both sides also get the ids a
 * library takes from a counter or a random source numbered or trimmed
 * (withStableIds below), so a row's tree doesn't depend on the rows before it:
 * react-native-shadow-2's gradient ids (when it is installed; customerapp has
 * none today), gesture handler's `handlerTag`, and react-native-screens'
 * `screenId` (a native stack's random route key).
 *
 * jest's ScrollView is React Native's own mock: it hands every prop to the
 * RCTScrollView host and puts the children in a plain View, so a content
 * style is compared as the scroll view's (flattened) contentContainerStyle.
 *
 * The test file must mock react-native-localize before anything reaches the
 * app's i18n, as every test that uses it does:
 *   jest.mock("react-native-localize", () =>
 *     jest.requireActual("react-native-localize/mock")
 *   )
 * A tree with the real scroll wrappers (components/scroll) also needs
 * `jest.mock("@shopify/flash-list", () => ({ FlashList: "FlashList" }))`:
 * that module exports AppFlashList too, and FlashList ships ESM jest doesn't
 * transform. SVG icons: `testing/svgStub`.
 *
 * HOW A CONVERSION USES IT (pass 1)
 * 1. On the commit BEFORE the conversion, write the screen's parity test:
 *    render each state worth keeping (loaded, loading, disabled, a modal
 *    open, long Arabic copy) for every entry of PARITY_MATRIX and call
 *    `expectParity(parityName(state, env), hostTree(<Screen …/>, env))`.
 * 2. Capture: `yarn ds:parity:capture <test file>`. The fixture lands in
 *    `__parity__/<test file>.json` beside the test, each case stamped with
 *    the commit it came from. Commit the test and the fixture together.
 * 3. Convert the screen. Run the test normally: every case must be equal.
 *    A missing case fails (it never captures by itself), and capture refuses
 *    to overwrite a case unless it is run with --force.
 *
 * The comparison is exact. A conversion to the design system's Button may opt
 * into its listed deltas, and only those, with `expectParity(name, tree,
 * { allow: ["buttonHeight", "buttonDisabledView", "buttonAccessibility"] })`
 * (see ParityAllowance below); each is accepted only on a Button's root.
 * Cases captured before the accessibility props were kept (2026-10-21; their
 * fixture entries carry no `a11y` flag) compare as they were captured,
 * without those three props anywhere; recapture one to compare it exactly.
 */
import crypto from "crypto"
import fs from "fs"
import path from "path"
import React, { act } from "react"
import { Dimensions, I18nManager, Platform, StyleSheet } from "react-native"
import TestRenderer, { type ReactTestRendererJSON } from "react-test-renderer"
import { expect } from "@jest/globals"
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  type EdgeInsets,
} from "react-native-safe-area-context"

import {
  getLatinFontWeights,
  setLatinFontWeights,
} from "@tappler/shared/src/helpers/helpers"
import { ThemeLanguageProvider } from "@tappler/shared/src/ds"
import { LABEL_BOX } from "@tappler/shared/src/ds/buttonStyles"

export type ParityLanguage = "en" | "ar"
export type ParityPlatform = "ios" | "android"

export type ParityEnv = {
  language: ParityLanguage
  /** Default `ios`. */
  platform?: ParityPlatform
  /** Default 0 on every edge. */
  insets?: Partial<EdgeInsets>
  /**
   * Default true: every RNCSafeAreaView is replaced by the padding (or
   * margin) its native view lays out with for these insets.
   */
  resolveSafeArea?: boolean
}

/** The four environments a pass-1 conversion is proved in. */
export const PARITY_MATRIX: readonly ParityEnv[] = [
  { language: "en", platform: "ios" },
  { language: "ar", platform: "ios" },
  { language: "en", platform: "android" },
  { language: "ar", platform: "android" },
]

/** A case name that carries its environment: `loaded [ar android]`. */
export const parityName = (base: string, env: ParityEnv) =>
  `${base} [${env.language} ${env.platform ?? "ios"}]`

export type HostNode = {
  type: string
  props: Record<string, unknown>
  children: HostChild[]
}
export type HostChild = HostNode | string

/**
 * The Latin faces customerapp draws `font-custom###` and ds Text in:
 * tappler-shared's default (helpers.ts), because customerapp's index.js
 * registers none (proapp's registers Poppins). Pinned against shared's
 * untouched default, against any mention of setLatinFontWeights in index.js
 * or src (hostTreeParity.test.tsx), and against the faces index.js leaves
 * when it loads, with the app, in a registry of its own (App.parity.tsx: an
 * aliased import is caught there), so a Poppins table here fails.
 */
export const APP_LATIN_FONT_WEIGHTS = {
  400: "Montserrat-Regular",
  500: "Montserrat-Medium",
  600: "Montserrat-SemiBold",
  700: "Montserrat-Bold",
} as const

const ZERO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 }

// ---------------------------------------------------------------------------
// Safe area, as the native view computes it

type EdgeMode = "off" | "additive" | "maximum"

const SHADOW_NODE_CPP =
  "common/cpp/react/renderer/components/safeareacontext/RNCSafeAreaViewShadowNode.cpp"

type EdgeValueFn = (mode: string, inset: number, edge: number) => number

let edgeValueFn: EdgeValueFn | null = null

/**
 * The library's own `getEdgeValue`, read out of the installed C++ source
 * (react-native-safe-area-context's Fabric shadow node, which is what lays
 * out a SafeAreaView on the New Architecture) and run as JavaScript. Its body
 * is plain if/else/return over three names and `fmax`, which is valid
 * JavaScript once `fmax` is Math.max; anything else in it fails loudly here,
 * so an upgrade that changes the rule changes this with it or stops the test.
 */
export const safeAreaEdgeValue = (
  mode: string,
  inset: number,
  edge: number
): number => {
  if (!edgeValueFn) {
    const pkg = path.dirname(
      require.resolve("react-native-safe-area-context/package.json")
    )
    const source = fs.readFileSync(path.join(pkg, SHADOW_NODE_CPP), "utf8")
    const match = source.match(
      /getEdgeValue\(\s*std::string (\w+),\s*float (\w+),\s*float (\w+)\)\s*\{([\s\S]*?)\n\}/
    )
    if (!match) {
      throw new Error(`getEdgeValue not found in ${SHADOW_NODE_CPP}`)
    }
    const [, modeName, insetName, edgeName, body] = match
    if (!/^[\s\w(){}=;"+,]*$/.test(body) || !/fmax\(/.test(body)) {
      throw new Error(
        `getEdgeValue's body is not the shape this model runs:\n${body}`
      )
    }
    // eslint-disable-next-line no-new-func
    edgeValueFn = new Function(
      modeName,
      insetName,
      edgeName,
      `const fmax = Math.max;\n${body}`
    ) as EdgeValueFn
  }
  return edgeValueFn(mode, inset, edge)
}

type Side = "Top" | "Right" | "Bottom" | "Left"
const SIDES: Side[] = ["Top", "Right", "Bottom", "Left"]

/**
 * A SafeAreaView's host node as Yoga gets it: the shadow node reads each
 * edge's padding the way `valueFromEdges` does (paddingBottom, else
 * paddingVertical, else padding; percentages unsupported), applies the
 * edge's mode with the insets, and sets all four edges. The `edges` and
 * `mode` props are consumed; the resolved four are written back.
 */
export const resolveSafeArea = (
  node: HostNode,
  insets: EdgeInsets
): HostNode => {
  const { edges, mode, style, ...props } = node.props as {
    edges?: Record<string, EdgeMode>
    mode?: "padding" | "margin"
    style?: Record<string, unknown>
  }
  if (!edges) throw new Error("RNCSafeAreaView without edges")
  const prefix = mode === "margin" ? "margin" : "padding"
  const own: Record<string, unknown> = { ...style }
  ;["Start", "End"].forEach((side) => {
    if (own[`${prefix}${side}`] !== undefined) {
      throw new Error(
        `${prefix}${side} on a SafeAreaView is not modelled (the native code sets left/right only)`
      )
    }
  })
  const read = (side: Side) => {
    const axis = side === "Top" || side === "Bottom" ? "Vertical" : "Horizontal"
    const value =
      own[`${prefix}${side}`] ?? own[`${prefix}${axis}`] ?? own[prefix]
    if (value !== undefined && typeof value !== "number") {
      throw new Error(`${prefix}${side} = ${String(value)} is not points`)
    }
    return (value as number | undefined) ?? 0
  }
  const resolved: Record<string, number> = {}
  SIDES.forEach((side) => {
    const key = side.toLowerCase() as keyof EdgeInsets
    resolved[`${prefix}${side}`] = safeAreaEdgeValue(
      edges[key],
      insets[key],
      read(side)
    )
  })
  ;[prefix, `${prefix}Vertical`, `${prefix}Horizontal`].forEach(
    (key) => delete own[key]
  )
  return {
    ...node,
    props: sortKeys({ ...props, style: sortKeys({ ...own, ...resolved }) }),
  }
}

// ---------------------------------------------------------------------------
// Normalizing

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype

const sortKeys = <T extends Record<string, unknown>>(value: T): T =>
  Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, value[key]])
  ) as T

/**
 * A React element, context, memo or the like: anything React tags with a
 * symbol `$$typeof`. A native view can't receive one; when a host carries
 * one, it is jest's mock handing a prop through (RN's ScrollView mock gives
 * RCTScrollView a FlatList's ListHeaderComponent, which VirtualizedList also
 * renders as a child), so it is left out like a function.
 */
const isReactObject = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { $$typeof?: unknown }).$$typeof === "symbol"

/** A ref object (`{ current }`), which a mock may hand a host as a prop. */
const isRef = (value: unknown) =>
  isPlainObject(value) &&
  Object.keys(value).length === 1 &&
  "current" in (value as object)

const dropped = (value: unknown) =>
  typeof value === "function" ||
  value === undefined ||
  isReactObject(value) ||
  isRef(value)

const clean = (value: unknown, ancestors: unknown[] = []): unknown => {
  // A value that contains itself (a ref, a navigation object a mock handed
  // through) can't be compared or stored; it is named instead.
  if (typeof value === "object" && value !== null && ancestors.includes(value))
    return "[Circular]"
  const inside = [...ancestors, value]
  if (Array.isArray(value)) {
    return value
      .filter((item) => !dropped(item))
      .map((item) => clean(item, inside))
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    Object.keys(value)
      .sort()
      .forEach((key) => {
        const item = value[key]
        if (!dropped(item)) {
          out[key] = clean(item, inside)
        }
      })
    return out
  }
  if (typeof value === "object" && value !== null) {
    // A class instance (a Date serializes; a component instance doesn't).
    try {
      JSON.stringify(value)
    } catch {
      return `[${value.constructor?.name ?? "Object"}]`
    }
  }
  return value
}

/**
 * The accessibility props that draw nothing, where the design system's
 * Button is allowed to be better than ActionBtn (it says it is a button, is
 * busy while loading and is named by its title). They are kept in the tree
 * and compared like every other prop; only a Button's root may differ in
 * them, and only when a case opts in (`buttonAccessibility`). Cases captured
 * before 2026-10-21 left them out everywhere, and still compare that way.
 */
export const PIXEL_FREE_PROPS: readonly string[] = [
  "accessibilityLabel",
  "accessibilityRole",
  "accessibilityState",
]

/** The tree without the three props in PIXEL_FREE_PROPS, on every node (how the old cases were captured). */
export const withoutAccessibility = (
  tree: HostNode | null
): HostNode | null => {
  const strip = (node: HostChild): HostChild => {
    if (typeof node === "string") return node
    const props: Record<string, unknown> = {}
    Object.keys(node.props).forEach((key) => {
      if (!PIXEL_FREE_PROPS.includes(key)) props[key] = node.props[key]
    })
    return { ...node, props, children: node.children.map(strip) }
  }
  return tree === null ? null : (strip(tree) as HostNode)
}

// `style`, `contentContainerStyle` and the like. A string value
// (`indicatorStyle="black"`) is not a style object and is kept as it is.
const isStyleName = (key: string) => key === "style" || key.endsWith("Style")
const isStyleProp = (key: string, value: unknown) =>
  isStyleName(key) && typeof value === "object" && value !== null

// className, a className* slot, a *ClassName slot, and NativeWind's `tw`
// (the style ratchet's family).
const CLASS_FAMILY = /^className|^tw$|ClassName$/

/**
 * What NativeWind's wrapper tidied away on every element it wrapped, and
 * what draws nothing with it or without it: a className-family prop holding
 * an empty string (a passthrough handing on a class it never got), and a
 * `false` or `null` style (`style={cond && x}`, which React Native draws as
 * no style; the wrapper rebuilt it into undefined). Without the plugin both
 * reach the host, so both are left out, on both sides of a comparison. A
 * class string with something in it is kept: a class that stopped drawing
 * still fails.
 */
const drawsNothing = (key: string, value: unknown) =>
  (CLASS_FAMILY.test(key) &&
    typeof value === "string" &&
    value.trim() === "") ||
  (isStyleName(key) && (value === false || value === null))

const normalizeNode = (
  node: ReactTestRendererJSON | string,
  env: Required<Pick<ParityEnv, "resolveSafeArea">> & { insets: EdgeInsets }
): HostChild => {
  if (typeof node === "string") return node
  const props: Record<string, unknown> = {}
  Object.keys(node.props).forEach((key) => {
    const value = node.props[key]
    if (dropped(value) || drawsNothing(key, value)) return
    if (isStyleProp(key, value)) {
      const flat = clean(StyleSheet.flatten(value as never) ?? {}) as Record<
        string,
        unknown
      >
      if (Object.keys(flat).length > 0) props[key] = flat
      return
    }
    props[key] = clean(value)
  })
  const children: HostChild[] = []
  ;(node.children ?? []).forEach((child) => {
    const next = normalizeNode(child, env)
    const last = children[children.length - 1]
    if (typeof next === "string" && typeof last === "string") {
      children[children.length - 1] = last + next
    } else {
      children.push(next)
    }
  })
  const out: HostNode = { type: node.type, props: sortKeys(props), children }
  return env.resolveSafeArea && node.type === "RNCSafeAreaView"
    ? resolveSafeArea(out, env.insets)
    : out
}

/**
 * toJSON() → the comparable tree. Several roots come back as a `#fragment`
 * node; an empty render as null. The JSON round trip makes an in-memory tree
 * identical to one read back from a fixture.
 */
export const normalizeHostTree = (
  json: ReactTestRendererJSON | ReactTestRendererJSON[] | null,
  options: Pick<ParityEnv, "insets" | "resolveSafeArea"> = {}
): HostNode | null => {
  if (json === null) return null
  const env = {
    resolveSafeArea: options.resolveSafeArea ?? true,
    insets: { ...ZERO_INSETS, ...options.insets },
  }
  const root = Array.isArray(json)
    ? ({
        type: "#fragment",
        props: {},
        children: json.map((node) => normalizeNode(node, env)),
      } as HostNode)
    : (normalizeNode(json, env) as HostNode)
  return JSON.parse(JSON.stringify(root))
}

// ---------------------------------------------------------------------------
// react-native-shadow-2's gradient ids

let shadowIdPattern: RegExp | null | undefined

/** Where react-native-shadow-2 is installed, or null: customerapp has none today. */
const shadowPackage = (): string | null => {
  try {
    return path.dirname(require.resolve("react-native-shadow-2/package.json"))
  } catch {
    return null
  }
}

/**
 * The ids react-native-shadow-2 gives a Shadow's gradients and mask, read
 * out of the installed library: `<side or corner>.${idSuffix}`, the suffix a
 * module-level counter (generateGradientIdSuffix), one per Shadow. They show
 * in a host tree as a gradient's `name` and a rect's `fill.brushRef` and
 * `mask` (react-native-svg's own hosts), or as `id` and `url(#…)` where the
 * svg components are stand-ins. A library that names them some other way
 * fails here, loudly, rather than leaving them to the counter. With the
 * library not installed (customerapp, today) no tree can hold one, and the
 * pattern is null: nothing is renamed.
 */
const shadowIds = (): RegExp | null => {
  if (shadowIdPattern === undefined) {
    const pkg = shadowPackage()
    if (pkg === null) {
      shadowIdPattern = null
      return shadowIdPattern
    }
    const { main } = JSON.parse(
      fs.readFileSync(path.join(pkg, "package.json"), "utf8")
    ) as { main: string }
    const source = fs.readFileSync(path.join(pkg, main), "utf8")
    const prefixes = [
      ...new Set(
        [...source.matchAll(/\b([A-Za-z]+)\.\$\{idSuffix\}/g)].map(
          (match) => match[1]
        )
      ),
    ].sort()
    if (prefixes.length === 0) {
      throw new Error(
        `react-native-shadow-2 (${main}) names no id \`<name>.\${idSuffix}\`: its gradient ids changed shape, so withStableShadowIds can't find them`
      )
    }
    shadowIdPattern = new RegExp(
      `^(url\\(#)?(${prefixes.join("|")})\\.(\\d+)(\\))?$`
    )
  }
  return shadowIdPattern
}

/**
 * The tree with react-native-shadow-2's id suffixes numbered in order of
 * first appearance (`start.24` → `start.#1` for the first Shadow the tree
 * names, its other sides and corners too), in every prop that holds one: the
 * gradient's id and each reference to it. The counter behind them runs on
 * across the renders of a module registry, so a row's raw ids depend on how
 * many Shadows mounted before it: run alone (`-t`) or reordered, it would
 * differ for nothing. Numbered by appearance, two trees compare equal when
 * they draw the same Shadows with each reference pointing at the same one.
 * Texts are never touched. expectParity applies it to both sides at compare
 * time, so a fixture captured with raw ids compares as it is.
 */
export const withStableShadowIds = (
  tree: HostNode | null
): HostNode | null => {
  if (tree === null) return null
  const pattern = shadowIds()
  if (pattern === null) return tree
  const order = new Map<string, number>()
  const rename = (value: string) => {
    const match = value.match(pattern)
    if (!match) return value
    const [, url, name, counter, close] = match
    if (!url !== !close) return value
    if (!order.has(counter)) order.set(counter, order.size + 1)
    const id = `${name}.#${order.get(counter)}`
    return url ? `url(#${id})` : id
  }
  const visit = (value: unknown): unknown => {
    if (typeof value === "string") return rename(value)
    if (Array.isArray(value)) return value.map(visit)
    if (isPlainObject(value)) {
      const out: Record<string, unknown> = {}
      Object.keys(value)
        .sort()
        .forEach((key) => {
          out[key] = visit(value[key])
        })
      return out
    }
    return value
  }
  const node = (child: HostChild): HostChild =>
    typeof child === "string"
      ? child
      : {
          type: child.type,
          props: visit(child.props) as Record<string, unknown>,
          children: child.children.map(node),
        }
  return node(tree) as HostNode
}

// ---------------------------------------------------------------------------
// Gesture handler's handler tags, react-native-screens' screen ids

/** Each host's props through `change`, the tree's shape and texts untouched. */
const mapHostProps = (
  tree: HostNode,
  change: (node: HostNode) => Record<string, unknown>
): HostNode => {
  const node = (child: HostChild): HostChild =>
    typeof child === "string"
      ? child
      : {
          type: child.type,
          props: change(child),
          children: child.children.map(node),
        }
  return node(tree) as HostNode
}

/**
 * The tree with gesture handler's `handlerTag`s numbered in order of first
 * appearance (`7` → `"#1"`). Under jest the library hands each wrapped view
 * (its ScrollView, FlatList, Switch, TextInput, a button) the tag it gave the
 * view's handler, from a module-level counter (getNextHandlerTag) that runs
 * on across a registry's renders: a row inserted earlier in a file shifted
 * every later row's tags (proapp's B7). A tag of -1 (a handler not created
 * yet) is kept as it is. Two hosts holding one tag still hold one after.
 * expectParity applies it to both sides at compare time.
 */
export const withStableHandlerTags = (
  tree: HostNode | null
): HostNode | null => {
  if (tree === null) return null
  const order = new Map<number, string>()
  return mapHostProps(tree, ({ props }) => {
    const tag = props.handlerTag
    if (typeof tag !== "number" || tag < 1) return props
    if (!order.has(tag)) order.set(tag, `#${order.size + 1}`)
    return { ...props, handlerTag: order.get(tag) }
  })
}

/** React Navigation's route key: the route's name, `-`, a 21-character nanoid. */
const ROUTE_KEY = /^(.+)-[\w-]{21}$/

/**
 * The tree with react-native-screens' `screenId`s cut back to the route's
 * name. A native stack hands each screen its route's key as `screenId`
 * (NativeStackView), and React Navigation makes every key with a fresh random
 * tail (`JobDetailScreen-<nanoid>`), so two renders of the same stack never
 * drew the same tree (proapp's B3 trimmed it in its own test). The name is
 * the part that says which screen it is; a screen id that isn't a route key
 * is kept as it is. expectParity applies it to both sides at compare time.
 */
export const withStableScreenIds = (
  tree: HostNode | null
): HostNode | null => {
  if (tree === null) return null
  return mapHostProps(tree, ({ props }) => {
    const { screenId } = props
    if (typeof screenId !== "string") return props
    const match = screenId.match(ROUTE_KEY)
    return match ? { ...props, screenId: match[1] } : props
  })
}

/**
 * Every id a library takes from a counter or a random source, made stable:
 * shadow-2's gradient ids, gesture handler's tags, a native stack's screen
 * ids. What expectParity compares, on both sides.
 */
export const withStableIds = (tree: HostNode | null): HostNode | null =>
  withStableScreenIds(withStableHandlerTags(withStableShadowIds(tree)))

// ---------------------------------------------------------------------------
// Rendering

type SavedEnv = {
  language: string | undefined
  isRTL: boolean
  os: typeof Platform.OS
  select: typeof Platform.select
  fonts: ReturnType<typeof getLatinFontWeights>
}

const appI18n = () => {
  try {
    // Lazy, so importing this file has no side effects; the test file mocks
    // react-native-localize first (see the header).
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    return require("locales/i18n").default as typeof import("i18next").default
  } catch (error) {
    throw new Error(
      "The app's i18n could not load. Mock react-native-localize in the test file first:\n" +
        `  jest.mock("react-native-localize", () => jest.requireActual("react-native-localize/mock"))\n${String(error)}`
    )
  }
}

const setRTL = (isRTL: boolean) => {
  const manager = I18nManager as { isRTL: boolean }
  manager.isRTL = isRTL
  // getConstants() hands back one shared object; keep it in step.
  ;(I18nManager.getConstants() as { isRTL: boolean }).isRTL = isRTL
}

const enter = (env: ParityEnv): SavedEnv => {
  const i18n = appI18n()
  const platform = Platform as { OS: string; select: typeof Platform.select }
  const saved: SavedEnv = {
    language: i18n.language,
    isRTL: I18nManager.isRTL,
    os: Platform.OS,
    select: Platform.select,
    fonts: getLatinFontWeights(),
  }
  const os = env.platform ?? "ios"
  platform.OS = os
  // Platform.<os>.js hard-codes its own key in select, so it follows OS only
  // if it is swapped too; this is the same lookup, for the chosen platform.
  platform.select = ((spec: Record<string, unknown>) =>
    os in spec
      ? spec[os]
      : "native" in spec
        ? spec.native
        : spec.default) as typeof Platform.select
  setRTL(env.language === "ar")
  setLatinFontWeights({ ...APP_LATIN_FONT_WEIGHTS })
  act(() => {
    i18n.changeLanguage(env.language)
  })
  return saved
}

const leave = (saved: SavedEnv) => {
  const platform = Platform as { OS: string; select: typeof Platform.select }
  platform.OS = saved.os
  platform.select = saved.select
  setRTL(saved.isRTL)
  setLatinFontWeights({ ...saved.fonts })
  if (saved.language) {
    act(() => {
      appI18n().changeLanguage(saved.language)
    })
  }
}

export type ParitySession = {
  renderer: TestRenderer.ReactTestRenderer
  /** The normalized host tree right now. */
  tree: () => HostNode | null
  update: (element: React.ReactElement) => void
  /** Unmounts and puts the environment back. */
  unmount: () => void
}

// Context providers only: none of them adds a host node.
const wrap = (element: React.ReactElement, env: ParityEnv) => {
  const insets = { ...ZERO_INSETS, ...env.insets }
  const { width, height } = Dimensions.get("window")
  return React.createElement(
    SafeAreaFrameContext.Provider,
    { value: { x: 0, y: 0, width, height } },
    React.createElement(
      SafeAreaInsetsContext.Provider,
      { value: insets },
      React.createElement(
        ThemeLanguageProvider,
        { language: env.language },
        element
      )
    )
  )
}

/**
 * Renders in an environment and keeps it until unmount, for a test that has
 * to press or type before it reads the tree.
 */
export const renderParity = (
  element: React.ReactElement,
  env: ParityEnv
): ParitySession => {
  const saved = enter(env)
  let renderer!: TestRenderer.ReactTestRenderer
  try {
    act(() => {
      renderer = TestRenderer.create(wrap(element, env))
    })
  } catch (error) {
    leave(saved)
    throw error
  }
  let open = true
  return {
    renderer,
    tree: () => normalizeHostTree(renderer.toJSON(), env),
    update: (next) =>
      act(() => {
        renderer.update(wrap(next, env))
      }),
    unmount: () => {
      if (!open) return
      open = false
      try {
        act(() => renderer.unmount())
      } finally {
        leave(saved)
      }
    },
  }
}

/** Render, read the normalized host tree, unmount. */
export const hostTree = (element: React.ReactElement, env: ParityEnv) => {
  const session = renderParity(element, env)
  try {
    return session.tree()
  } finally {
    session.unmount()
  }
}

// ---------------------------------------------------------------------------
// Fixtures

/**
 * A fixture file holds each case's tree by content hash, so the many cases
 * that draw the same tree (iOS and Android usually do) store it once:
 * `{ "cases": { name: { capturedAt, tree: hash } }, "trees": { hash: tree } }`,
 * one entry per line, so a changed tree is a one-line diff.
 */
/**
 * `a11y`: captured with the accessibility props kept (2026-10-21 on). A case
 * without it was captured without them and compares without them.
 */
type FixtureCase = { capturedAt: string; tree: string | null; a11y?: true }
type FixtureFile = {
  cases: Record<string, FixtureCase>
  trees: Record<string, HostNode>
}

/** `<dir>/__tests__/X.test.tsx` → `<dir>/__tests__/__parity__/X.test.json` */
export const fixtureFileFor = (testPath: string) =>
  path.join(
    path.dirname(testPath),
    "__parity__",
    `${path.basename(testPath).replace(/\.[jt]sx?$/, "")}.json`
  )

const treeHash = (tree: HostNode) =>
  crypto
    .createHash("sha1")
    .update(JSON.stringify(tree))
    .digest("hex")
    .slice(0, 12)

const parsed = new Map<string, { mtime: number; fixtures: FixtureFile }>()

const readFixtures = (file: string): FixtureFile => {
  if (!fs.existsSync(file)) return { cases: {}, trees: {} }
  const mtime = fs.statSync(file).mtimeMs
  const cached = parsed.get(file)
  if (cached && cached.mtime === mtime) return cached.fixtures
  const fixtures = JSON.parse(fs.readFileSync(file, "utf8")) as FixtureFile
  parsed.set(file, { mtime, fixtures })
  return fixtures
}

const writeFixtures = (file: string, fixtures: FixtureFile) => {
  // Keep only the trees some case still points at (a forced recapture can
  // leave one behind).
  const used = new Set(Object.values(fixtures.cases).map((entry) => entry.tree))
  const lines = (record: Record<string, unknown>, keep = (_: string) => true) =>
    Object.keys(record)
      .sort()
      .filter(keep)
      .map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(record[key])}`)
      .join(",\n")
  const text =
    `{\n "cases": {\n${lines(fixtures.cases)}\n },\n` +
    ` "trees": {\n${lines(fixtures.trees, (hash) => used.has(hash))}\n }\n}\n`
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  parsed.delete(file)
}

const ROOT = path.resolve(__dirname, "../..")
const rel = (file: string) => path.relative(ROOT, file)

/**
 * The capture flags, read through a variable on purpose. babel.config.js
 * runs react-native-dotenv, which replaces `process.env.NAME` with the value
 * it has when the file is TRANSFORMED, and jest caches the transform: written
 * the plain way, one capture run bakes "capture" into the cached module and
 * every later run captures again (seen here, 2026-10-20). Set them the same
 * way in a test (`parityFlags.DS_PARITY_CAPTURE = "1"`).
 */
export const parityFlags: Record<
  "DS_PARITY_CAPTURE" | "DS_PARITY_COMMIT",
  string | undefined
> = process.env as never

/** Which mode the run is in: `yarn ds:parity:capture` sets it. */
export const captureMode = () => {
  const mode = parityFlags.DS_PARITY_CAPTURE
  return mode === "force" ? "force" : mode ? "capture" : "compare"
}

/** The commit a capture run stamps its cases with. */
export const captureCommit = () => parityFlags.DS_PARITY_COMMIT ?? "unknown"

// ---------------------------------------------------------------------------
// Allowances: the listed pass-1 deltas, opt-in per call

/**
 * A difference a conversion may opt into. Each one draws nothing different,
 * and each is accepted only where it applies, so opting in can't hide
 * anything else:
 * - `buttonHeight`: the design system's Button sets `minHeight` where
 *   ActionBtn set `height` (they lay out alike while the label fits, which it
 *   does at the default text size). Accepted only on a Button's root (see
 *   isButtonRoot) whose captured style has `height` N and no `minHeight`,
 *   where the new style has `minHeight` N and no `height`, every other style
 *   key equal. A height turned minHeight anywhere else is still a difference.
 * - `buttonDisabledView`: ActionBtn without an onPress draws a View that
 *   still carries the touchable's `disabled` flag, a prop a View doesn't
 *   have; Button's View carries none. Accepted only on a Button's root that
 *   isn't a touchable (no `accessible`), for a captured View.
 * - `buttonAccessibility`: Button names itself, says it is a button and is
 *   busy while loading (PIXEL_FREE_PROPS); ActionBtn said none of it.
 *   Accepted only on a Button's root, for those three props, and only when
 *   they are Button's own (buttonSaysOf): the label its label box draws,
 *   role "button", ActionBtn's touchable state plus busy while it loads. A
 *   Button root saying anything else throws. An accessibility prop anywhere
 *   else must match.
 *
 * The rules are the codemod comparer's (scripts/ds-codemod/parity/
 * compare.js: allowButtonHeight), so a site the codemod accepted passes here.
 */
export type ParityAllowance =
  | "buttonHeight"
  | "buttonDisabledView"
  | "buttonAccessibility"

/** One accepted delta: where it was, and what was accepted. */
export type AcceptedDelta = { path: string; what: string }

export type ParityOptions = {
  /** The fixture file; default `__parity__/<test file>.json` beside the test. */
  file?: string
  /** The deltas this case may show (default none: the trees must be equal). */
  allow?: readonly ParityAllowance[]
}

const styleOf = (node: HostNode) =>
  (node.props.style ?? {}) as Record<string, unknown>

const sameEntries = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  JSON.stringify(Object.entries(a).sort()) ===
  JSON.stringify(Object.entries(b).sort())

const isLabelBox = (child: HostChild) => {
  if (typeof child === "string" || child.type !== "View") return false
  const { marginLeft, marginRight, ...rest } = styleOf(child)
  const {
    marginLeft: _left,
    marginRight: _right,
    ...box
  } = LABEL_BOX as Record<string, unknown>
  return marginLeft === marginRight && sameEntries(rest, box)
}

/**
 * A button's root as a host tree shows it: among at most three children (an
 * icon at either end), Button's label box (LABEL_BOX, read from
 * tappler-shared; `labelInset` may change its side margins), or only the
 * spinner while it loads. ActionBtn's root matches too, since Button draws
 * ActionBtn's label box exactly; a plain view doesn't.
 */
export const isButtonRoot = (node: HostNode) => {
  const kids = node.children
  if (kids.length === 0 || kids.length > 3) return false
  const [only] = kids
  if (kids.length === 1 && typeof only !== "string") {
    if (only.type === "ActivityIndicator") return true
  }
  return kids.some(isLabelBox)
}

type Allowed = { props: Record<string, unknown>; what: string }

const allowButtonHeight = (
  stored: HostNode,
  node: HostNode
): Allowed | null => {
  const before = styleOf(stored)
  const after = styleOf(node)
  if (typeof before.height !== "number" || before.minHeight !== undefined) {
    return null
  }
  if (after.height !== undefined || after.minHeight !== before.height) {
    return null
  }
  const { height, ...beforeRest } = before
  const { minHeight: _minHeight, ...afterRest } = after
  if (!sameEntries(beforeRest, afterRest)) return null
  return {
    props: { ...node.props, style: sortKeys({ ...afterRest, height }) },
    what: `height ${String(height)} -> minHeight ${String(height)} (Button)`,
  }
}

const allowDisabledView = (
  stored: HostNode,
  node: HostNode
): Allowed | null => {
  if (stored.type !== "View" || node.type !== "View") return null
  if (!("disabled" in stored.props) || "disabled" in node.props) return null
  if ("accessible" in node.props) return null
  return {
    props: sortKeys({ ...node.props, disabled: stored.props.disabled }),
    what: `disabled=${String(stored.props.disabled)} on a View (ActionBtn without onPress)`,
  }
}

/** A host node's text: its strings and its children's, in order. */
const drawnText = (node: HostChild): string =>
  typeof node === "string" ? node : node.children.map(drawnText).join("")

/**
 * What Button's root says of itself (the touchable in Button.tsx), read off
 * what the root draws and what ActionBtn's root said in its place:
 * - its label: the texts its label box draws (the title and the second
 *   title in the label row, the description under it), joined with ", " as
 *   Button joins them. While it loads only the spinner is drawn, so there is
 *   no text to read it from: then any non-empty label is Button's (`null`).
 * - its role: "button".
 * - its state: the touchable's, which ActionBtn's root had too (each passes
 *   `disabled` or `disable`, or-ed with isLoading), and `busy` while it loads.
 */
const buttonSaysOf = (stored: HostNode, node: HostNode) => {
  const [first] = node.children
  const loading =
    node.children.length === 1 &&
    typeof first !== "string" &&
    first.type === "ActivityIndicator"
  const texts: string[] = []
  const box = node.children.find(isLabelBox)
  if (box && typeof box !== "string") {
    box.children.forEach((child) => {
      if (typeof child === "string") return
      if (child.type === "Text") {
        texts.push(drawnText(child))
        return
      }
      child.children.forEach((inner) => {
        if (typeof inner !== "string" && inner.type === "Text") {
          texts.push(drawnText(inner))
        }
      })
    })
  }
  const { busy: _busy, ...state } = (stored.props.accessibilityState ??
    {}) as Record<string, unknown>
  return {
    label: loading ? null : texts.filter(Boolean).join(", "),
    role: "button",
    state: sortKeys(loading ? { ...state, busy: true } : state),
  }
}

/**
 * Button's three accessibility props in ActionBtn's place, required to be
 * Button's own (review M4: copying ActionBtn's over any value let a busy
 * while disabled, a disabled while enabled, a wrong label and a loading
 * button without busy through). A root that says nothing of a Button (no
 * role, no label) is left for the comparison to report.
 */
const allowAccessibility = (
  stored: HostNode,
  node: HostNode
): Allowed | null => {
  const props: Record<string, unknown> = { ...node.props }
  const changed = PIXEL_FREE_PROPS.filter(
    (key) => JSON.stringify(stored.props[key]) !== JSON.stringify(props[key])
  )
  if (changed.length === 0) return null
  const {
    accessibilityLabel: label,
    accessibilityRole: role,
    accessibilityState: state,
  } = props
  if (role !== "button" && label === undefined) return null
  const own = buttonSaysOf(stored, node)
  const wrong: string[] = []
  if (
    own.label === null
      ? !(typeof label === "string" && label.length > 0)
      : label !== own.label
  ) {
    wrong.push(
      `accessibilityLabel ${JSON.stringify(label)}, not ${
        own.label === null ? "a name" : JSON.stringify(own.label)
      }`
    )
  }
  if (role !== own.role) {
    wrong.push(`accessibilityRole ${JSON.stringify(role)}, not "button"`)
  }
  if (JSON.stringify(state ?? {}) !== JSON.stringify(own.state)) {
    wrong.push(
      `accessibilityState ${JSON.stringify(state ?? {})}, not ${JSON.stringify(own.state)}`
    )
  }
  if (wrong.length > 0) {
    throw new Error(
      `Button's root says ${wrong.join("; ")}. Button names itself by what its label box draws ` +
        '(title, second title, description, joined with ", "), says it is a button, and keeps the touchable\'s ' +
        "state (disabled while disabled or loading), busy while it loads (Button.tsx)"
    )
  }
  changed.forEach((key) => {
    const before = stored.props[key]
    if (before === undefined) delete props[key]
    else props[key] = before
  })
  return {
    props: sortKeys(props),
    what: `${changed.join(", ")} (Button)`,
  }
}

const ALLOWANCES: Record<
  ParityAllowance,
  (stored: HostNode, node: HostNode) => Allowed | null
> = {
  buttonHeight: allowButtonHeight,
  buttonDisabledView: allowDisabledView,
  buttonAccessibility: allowAccessibility,
}

/**
 * `tree` with each allowed delta put back to what `stored` has, walking the
 * two side by side, plus the list of what was accepted. Only a node that is
 * a Button's root (in `tree`, the converted side) is ever changed; a pair
 * that differs in any other way is left for the comparison to report.
 */
export const applyAllowances = (
  tree: HostNode | null,
  stored: HostNode | null,
  allow: readonly ParityAllowance[]
): { tree: HostNode | null; accepted: AcceptedDelta[] } => {
  const accepted: AcceptedDelta[] = []
  const walk = (node: HostChild, before: HostChild, at: string): HostChild => {
    if (typeof node === "string" || typeof before === "string") return node
    if (node.type !== before.type) return node
    const here = `${at}<${node.type}>`
    let { props } = node
    if (isButtonRoot(node)) {
      allow.forEach((name) => {
        let result: Allowed | null
        try {
          result = ALLOWANCES[name](before, { ...node, props })
        } catch (error) {
          throw new Error(
            `${name} at ${here}: ${error instanceof Error ? error.message : String(error)}`
          )
        }
        if (result) {
          props = result.props
          accepted.push({ path: here, what: result.what })
        }
      })
    }
    return {
      ...node,
      props,
      children: node.children.map((child, index) =>
        index < before.children.length
          ? walk(child, before.children[index], `${here}[${index}]`)
          : child
      ),
    }
  }
  if (tree === null || stored === null || allow.length === 0) {
    return { tree, accepted }
  }
  return { tree: walk(tree, stored, "root") as HostNode, accepted }
}

/**
 * Compare a tree with its captured case, or capture it when the run is a
 * capture. A case that is not in the fixture fails: it never captures by
 * itself, so a test can't pass against a fixture taken from the new code.
 * Returns the deltas it accepted (`options.allow`), for a test to pin.
 */
export const expectParity = (
  name: string,
  tree: HostNode | null,
  options: ParityOptions = {}
): { accepted: AcceptedDelta[] } => {
  const testPath = expect.getState().testPath ?? ""
  const file = options.file ?? fixtureFileFor(testPath)
  const fixtures = readFixtures(file)
  const mode = captureMode()
  const captured = fixtures.cases[name]
  if (mode !== "compare") {
    if (captured && mode !== "force") {
      throw new Error(
        `Parity case "${name}" is already captured in ${rel(file)} (${captured.capturedAt}). ` +
          "Recapture only from the code BEFORE the change, with --force."
      )
    }
    const hash = tree === null ? null : treeHash(tree)
    writeFixtures(file, {
      cases: {
        ...fixtures.cases,
        [name]: {
          capturedAt: captureCommit(),
          tree: hash,
          a11y: true,
        },
      },
      trees:
        hash === null ? fixtures.trees : { ...fixtures.trees, [hash]: tree! },
    })
    return { accepted: [] }
  }
  if (!captured) {
    throw new Error(
      `No parity case "${name}" in ${rel(file)}. Capture it from the code BEFORE the change: ` +
        `yarn ds:parity:capture ${rel(testPath)}`
    )
  }
  // The stored tree goes through today's normalizing too (safe areas were
  // resolved when it was captured), so a case captured before a change to
  // the rules above still compares like for like.
  const raw = captured.tree === null ? null : fixtures.trees[captured.tree]
  if (raw === undefined) {
    throw new Error(
      `Parity case "${name}" in ${rel(file)} points at tree ${captured.tree}, which the file doesn't hold`
    )
  }
  const normalized =
    raw === null
      ? null
      : normalizeHostTree(raw as never, { resolveSafeArea: false })
  // A case from before the accessibility props were kept compares without
  // them on either side, as it was captured. Counter and random ids are
  // numbered or trimmed on both sides (withStableIds).
  const stored = withStableIds(
    captured.a11y ? normalized : withoutAccessibility(normalized)
  )
  const current = withStableIds(
    captured.a11y ? tree : withoutAccessibility(tree)
  )
  const { tree: compared, accepted } = applyAllowances(
    current,
    stored,
    options.allow ?? []
  )
  expect(compared).toEqual(stored)
  return { accepted }
}
