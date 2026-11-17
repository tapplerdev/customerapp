import { StyleSheet } from "react-native"

import { LOADING_DOTS_BOX, color } from "@tappler/shared/src/ds"

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
}

/**
 * `tree` (a host tree, an array of them, or null) with FROZEN_SPINNER where
 * each LoadingDots box is, and how many it put back.
 */
export const withFrozenSpinner = <T>(
  tree: T,
  options: SpinnerOptions = {}
): { tree: T; swapped: number } => {
  let swapped = 0
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
    return { ...value, props, children }
  }
  return { tree: walk(tree) as T, swapped }
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
