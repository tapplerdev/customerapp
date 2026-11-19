import { StyleSheet } from "react-native"
import { RULE_WEIGHT } from "@tappler/shared/src/ds"

/*
 * Jest only.
 *
 * A rule (a divider, a field's underline) is drawn now as a filled View
 * RULE_WEIGHT tall, tappler-shared's half a point in whole device pixels
 * (ds/rule.ts), where it was a 0.5 border on an empty View. Such a border drew
 * a different number of pixel rows, or none, by where the View sat (measured
 * on the iPhone 16 Pro Max, 2026-11-18): tappler-shared and the apps'
 * fix/rule-pixel-snap.
 *
 * The frozen proofs captured before it (the twins' class-name trees, shared's
 * `__fixtures__`) still hold the border, and are never edited or recaptured.
 * So a frozen row compares its tree with the border put back where a filled
 * rule is drawn, every other node still equal, as the spinner is put back
 * (frozenSpinner.ts). The swap returns how many it put back, which the row
 * checks against the rules it draws, so a rule that goes back to a border (or
 * goes missing) fails. DmAuthInput's rule has its own swap
 * (frozenAuthInput.ts), which knows its lift too.
 *
 * Screen and component parity fixtures that capture a rule are not frozen:
 * their states were captured again with the filled View.
 *
 * The same went for every other thin line that was a fractional literal
 * (0.3, 0.4, 0.7, 0.75, hairlineWidth): the apps draw RULE_WEIGHT now, one
 * weight everywhere (a border on a box is `borderWidth: RULE_WEIGHT`, a line
 * is a filled View RULE_WEIGHT tall). A frozen proof still holds the old
 * number, so `withFrozenWidths` puts it back where the tree draws
 * RULE_WEIGHT, node by node, and says how many nodes it changed.
 */

type Node = { type: string; props: Record<string, unknown>; children: unknown }

const isNode = (value: unknown): value is Node =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Node).type === "string" &&
  typeof (value as Node).props === "object"

const flat = (style: unknown) =>
  (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>

/** A rule as it is drawn now: an empty View RULE_WEIGHT tall with a fill. */
export const isFilledRule = (value: unknown): boolean => {
  if (!isNode(value) || value.type !== "View") return false
  if (Array.isArray(value.children) && value.children.length > 0) return false
  const style = flat(value.props.style)
  return (
    style.height === RULE_WEIGHT && typeof style.backgroundColor === "string"
  )
}

/** The border a frozen proof holds for a rule filled with `fill`. */
export type FrozenBorder = (fill: string) => Record<string, unknown>

/** A 0.5 bottom border in the rule's colour, the most common frozen rule. */
export const FROZEN_BOTTOM_RULE: FrozenBorder = (fill) => ({
  borderBottomWidth: 0.5,
  borderBottomColor: fill,
})

/** A 0.5 top border in the rule's colour. */
export const FROZEN_TOP_RULE: FrozenBorder = (fill) => ({
  borderTopWidth: 0.5,
  borderTopColor: fill,
})

/**
 * `tree` (a host tree, an array of them, or null) with `border` put back in
 * place of each filled rule's height and fill, and how many it put back.
 */
export const withFrozenRules = <T>(
  tree: T,
  border: FrozenBorder
): { tree: T; swapped: number } => {
  let swapped = 0
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk)
    if (!isNode(value)) return value
    if (isFilledRule(value)) {
      const {
        height: _height,
        backgroundColor,
        ...rest
      } = flat(value.props.style)
      swapped += 1
      return {
        ...value,
        props: {
          ...value.props,
          style: { ...rest, ...border(backgroundColor as string) },
        },
      }
    }
    const children = Array.isArray(value.children)
      ? value.children.map(walk)
      : value.children
    return { ...value, children }
  }
  return { tree: walk(tree) as T, swapped }
}

const WIDTH_KEY =
  /^(?:border(?:Top|Right|Bottom|Left|Start|End)?Width|height|width)$/

/**
 * The width a frozen proof holds for a style key that is RULE_WEIGHT now, or
 * undefined to leave it (a node whose RULE_WEIGHT was never a fractional
 * literal). `style` is the node's flattened style.
 */
export type FrozenWidth = (
  style: Record<string, unknown>,
  key: string
) => number | undefined

/** Every border width of a node, as `width` (a box's outline). */
export const FROZEN_BORDERS =
  (width: number): FrozenWidth =>
  (_style, key) =>
    key.startsWith("border") ? width : undefined

/**
 * `tree` (a host tree, an array of them, or null) with each style key that
 * is RULE_WEIGHT put back to what `frozen` says the proof holds, and how many
 * nodes it changed (a row checks it against the lines it draws).
 */
export const withFrozenWidths = <T>(
  tree: T,
  frozen: FrozenWidth
): { tree: T; swapped: number } => {
  let swapped = 0
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk)
    if (!isNode(value)) return value
    const style = flat(value.props.style)
    const put: Record<string, number> = {}
    for (const key of Object.keys(style)) {
      if (!WIDTH_KEY.test(key) || style[key] !== RULE_WEIGHT) continue
      const width = frozen(style, key)
      if (width !== undefined) put[key] = width
    }
    const children = Array.isArray(value.children)
      ? value.children.map(walk)
      : value.children
    if (Object.keys(put).length === 0) return { ...value, children }
    swapped += 1
    return {
      ...value,
      props: { ...value.props, style: { ...style, ...put } },
      children,
    }
  }
  return { tree: walk(tree) as T, swapped }
}
