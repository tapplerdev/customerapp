import { StyleSheet } from "react-native"

import {
  LOADING_DOTS_BOX,
  color,
  type ButtonHairline,
  type ButtonStateFill,
  type ButtonVariant,
} from "@tappler/shared/src/ds"
import {
  DIMMED,
  FADED,
  HAIRLINE,
  STATE_FILL,
  VARIANTS,
} from "@tappler/shared/src/ds/buttonStyles"

/*
 * Jest only.
 *
 * A loading button draws LoadingDots now (tappler-shared's ds, the owner's
 * hopping-dots loader): three dots in the label's colour, in a box hidden from
 * screen readers, where ActivityIndicator drew a white spinner. That is
 * Button's `isLoading`, RectButton's (MainModal's button, BtnsRentangle's Yes)
 * and the apps' own buttons that drew a spinner.
 *
 * The frozen proofs captured before it (here, the four real ActionBtn trees
 * in `__tests__/__parity__/hostTreeParity.test.json`; in proapp, ActionBtn's
 * looks, the twins' class-name trees and shared's fixtures) still hold the
 * spinner, and are never edited or recaptured. So a frozen row compares its
 * tree with the spinner put back where the dots are drawn: every other node
 * still has to match the frozen tree. The swap returns how many it put back,
 * which the row checks against the loading buttons it draws, so a button that
 * stops drawing the dots fails; what the dots draw (count, size, colour, the
 * hidden box) is proapp's ds/LoadingDots.test.tsx's (shared's ds tests live
 * there). This file is proapp's testing/frozenSpinner.ts, as the two apps'
 * parity tools are kept alike.
 *
 * A loading button also keeps its own colour now (the owner's call): primary
 * stays red under white dots, yellow yellow, and no variant takes its disabled
 * look while it loads. ActionBtn drew a loading button in its disabled look
 * (ActionBtn's grey, the disabled look's fill, a faded or greyed outline), so
 * the swap can also put that look back on the loading root (`loadingLook`,
 * worked out from the button's props by `actionBtnLoadingLook`, never read
 * from the frozen file), and says on how many roots it changed anything
 * (`restyled`), which a row checks too.
 *
 * Screen and component parity fixtures that capture a loading button are not
 * frozen: their loading states were captured again with the dots.
 */

type Node = { type: string; props: Record<string, unknown>; children: unknown }

/** The spinner every frozen loading button holds: white, the small size. */
export const FROZEN_SPINNER = Object.freeze({
  type: "ActivityIndicator",
  props: Object.freeze({ color: color.text.inverse }),
  children: Object.freeze([]),
})

const isNode = (value: unknown): value is Node =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Node).type === "string" &&
  typeof (value as Node).props === "object"

const BOX_KEYS = JSON.stringify(Object.entries(LOADING_DOTS_BOX).sort())

/** LoadingDots' box, in any host tree: hidden from screen readers, the box's style, three dots. */
export const isLoadingDots = (value: unknown): value is Node => {
  if (!isNode(value) || value.type !== "View") return false
  const { props } = value
  if (props.accessibilityElementsHidden !== true) return false
  if (props.importantForAccessibility !== "no-hide-descendants") return false
  const style = (StyleSheet.flatten(props.style as never) ?? {}) as object
  if (JSON.stringify(Object.entries(style).sort()) !== BOX_KEYS) return false
  return Array.isArray(value.children) && value.children.length === 3
}

export type SpinnerOptions = {
  /**
   * Also takes off the `accessibilityLabel` the dots' parent says while it
   * loads, which ActionBtn-era RectButton never said (it names itself by its
   * title now that its label leaves the tree; MainModal's and BtnsRentangle's
   * frozen rows).
   */
  dropLoadingName?: boolean
  /**
   * Style keys put back on each loading root (the dots' parent, its style
   * flattened): the look ActionBtn drew a loading button in, where Button
   * keeps its own (`actionBtnLoadingLook`; RectButton's grey for MainModal's
   * and BtnsRentangle's rows).
   */
  loadingLook?: Readonly<Record<string, unknown>>
}

/**
 * `tree` (a host tree, an array of them, or null) with FROZEN_SPINNER where
 * each LoadingDots box is, and how many it put back; with `loadingLook`, also
 * that look on each loading root, and on how many roots it changed a value.
 */
export const withFrozenSpinner = <T>(
  tree: T,
  options: SpinnerOptions = {}
): { tree: T; swapped: number; restyled: number } => {
  let swapped = 0
  let restyled = 0
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk)
    if (!isNode(value)) return value
    if (!Array.isArray(value.children)) return value
    let holdsDots = false
    const children = value.children.map((child) => {
      if (isLoadingDots(child)) {
        swapped += 1
        holdsDots = true
        return {
          ...FROZEN_SPINNER,
          props: { ...FROZEN_SPINNER.props },
          children: [],
        }
      }
      return walk(child)
    })
    let { props } = value
    if (holdsDots && options.dropLoadingName && "accessibilityLabel" in props) {
      props = Object.fromEntries(
        Object.entries(props).filter(([key]) => key !== "accessibilityLabel")
      )
    }
    if (holdsDots && options.loadingLook) {
      const style = (StyleSheet.flatten(props.style as never) ?? {}) as Record<
        string,
        unknown
      >
      const look = options.loadingLook
      if (Object.keys(look).some((key) => style[key] !== look[key])) {
        restyled += 1
      }
      props = { ...props, style: { ...style, ...look } }
    }
    return { ...value, props, children }
  }
  return { tree: walk(tree) as T, swapped, restyled }
}

/** The props of a Button that decide its surface while it loads. */
export type LoadingLookProps = {
  variant?: ButtonVariant
  disabled?: boolean
  looksDisabled?: boolean
  disabledLook?: unknown
  loadingSurface?: ButtonStateFill
  hairline?: ButtonHairline
  dim?: boolean
}

/** The keys a button's state changes on its root. */
const STATE_KEY =
  /^(backgroundColor|opacity|border(Top|Right|Bottom|Left)(Color|Width))$/

const stateKeysOf = (styles: unknown[]) =>
  Object.fromEntries(
    Object.entries(
      (StyleSheet.flatten(styles as never) ?? {}) as Record<string, unknown>
    ).filter(([key]) => STATE_KEY.test(key))
  )

/** A disabled look's fill: its `surface`, ActionBtn's grey when it names none. */
const lookSurfaceOf = (disabledLook: unknown): ButtonStateFill => {
  if (disabledLook === "design") return "design"
  if (
    typeof disabledLook === "object" &&
    disabledLook !== null &&
    typeof (disabledLook as { surface?: unknown }).surface === "string"
  ) {
    return (disabledLook as { surface: ButtonStateFill }).surface
  }
  return "legacy"
}

/**
 * The state keys of the root ActionBtn drew a loading button with (and
 * Button, until the owner's call): primary and yellow under the loading fill
 * (the caller's `loadingSurface`, else the disabled look's fill, ActionBtn's
 * grey by default); the others in their disabled look when disabled (a faded
 * white or on-red button, a bordered one's grey outline), their own surface
 * otherwise; a hairline and `dim` over either. The rule ActionBtn followed,
 * read from the ds tables, never from a frozen file.
 */
export const actionBtnLoadingLook = (props: LoadingLookProps) => {
  const spec = VARIANTS[props.variant ?? "primary"]
  const dimmed = !!(props.disabled || props.looksDisabled)
  let { surface }: { surface: unknown } = spec
  if (spec.loading === "fill") {
    surface =
      STATE_FILL[props.loadingSurface ?? lookSurfaceOf(props.disabledLook)]
  } else if (dimmed && typeof spec.disabled === "object") {
    surface = spec.disabled.surface
  }
  return stateKeysOf([
    surface,
    props.hairline && spec.hairline ? HAIRLINE[props.hairline] : undefined,
    dimmed && spec.disabled === "fade" ? FADED : undefined,
    props.dim ? DIMMED : undefined,
  ])
}

/**
 * The state keys of the root Button draws a loading button with: its enabled
 * look (its own surface, a hairline and `dim` over it), or a primary or
 * yellow button's chosen `loadingSurface`. With actionBtnLoadingLook, what a
 * row expects `restyled` to be: 1 where they differ.
 */
export const ownLoadingLook = (props: LoadingLookProps) => {
  const spec = VARIANTS[props.variant ?? "primary"]
  const chosen =
    spec.loading === "fill" && props.loadingSurface !== undefined
      ? STATE_FILL[props.loadingSurface]
      : undefined
  return stateKeysOf([
    chosen ?? spec.surface,
    props.hairline && spec.hairline ? HAIRLINE[props.hairline] : undefined,
    props.dim ? DIMMED : undefined,
  ])
}

/** Whether ActionBtn's loading look and Button's differ for these props. */
export const loadingLookChanged = (props: LoadingLookProps) => {
  const before = actionBtnLoadingLook(props)
  const after = ownLoadingLook(props)
  return Object.keys(before).some((key) => before[key] !== after[key])
}

/**
 * How many frozen loading buttons' spinners a stored tree holds: the nodes
 * that are FROZEN_SPINNER exactly (a page or list spinner names its size or
 * another colour), for a row to check its swap against.
 */
export const frozenSpinnersIn = (tree: unknown): number => {
  if (Array.isArray(tree)) {
    return tree.reduce((sum: number, node) => sum + frozenSpinnersIn(node), 0)
  }
  if (!isNode(tree)) return 0
  const own =
    tree.type === FROZEN_SPINNER.type &&
    JSON.stringify(tree.props) === JSON.stringify(FROZEN_SPINNER.props)
      ? 1
      : 0
  return (
    own + (Array.isArray(tree.children) ? frozenSpinnersIn(tree.children) : 0)
  )
}
