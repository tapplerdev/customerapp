/**
 * Jest only. Press the row whose words include `text`: a card or a list row
 * is one pressable around several texts, so the kit's pressText (the whole
 * control's text must equal what you give it) can't name it by one of its
 * lines. Calls the onPress of the innermost element holding the words, as a
 * tap on its touchable does, and returns nothing (see screenKit's presses).
 * Throws on no match, on two separate controls holding the words, and on a
 * disabled one.
 */
import type { ReactTestInstance } from "react-test-renderer"

const textOf = (node: ReactTestInstance): string =>
  node.children
    .map((child) => (typeof child === "string" ? child : textOf(child)))
    .join("")

const isInside = (node: ReactTestInstance, outer: ReactTestInstance) => {
  for (let up = node.parent; up; up = up.parent) if (up === outer) return true
  return false
}

export const pressContaining = (root: ReactTestInstance, text: string): void => {
  const found = root.findAll(
    (node) =>
      typeof node.props.onPress === "function" && textOf(node).includes(text)
  )
  if (found.length === 0) throw new Error(`press a row with "${text}": no match`)
  const controls = found.filter(
    (node) => !found.some((other) => other !== node && isInside(other, node))
  )
  if (controls.length > 1) {
    throw new Error(
      `press a row with "${text}": ${controls.length} controls hold it`
    )
  }
  const [control] = controls
  const { disabled, accessibilityState } = control.props as {
    disabled?: boolean
    accessibilityState?: { disabled?: boolean }
  }
  if (disabled === true || accessibilityState?.disabled === true) {
    throw new Error(`press a row with "${text}": it is disabled`)
  }
  control.props.onPress()
}
