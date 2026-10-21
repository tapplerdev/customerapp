/**
 * Jest only. What a pro does to a screen before its tree is read, by what
 * they see rather than by testIDs (a screen has none, and can't get one in
 * pass 1: a testID is a host prop, so the tree would change): the copy in
 * the row's language, a press on a titled control or on a link's words,
 * typing into a field or the code boxes, and the rows a screen's bottom gap
 * needs. treeAfter (index.ts) runs a list of these. Written for My Account's
 * screens (W2b P3) and moved here for every area.
 *
 * Each press calls the element's own onPress, as a tap does, and returns
 * nothing: a tap doesn't wait for an async handler, and session.act would
 * (a save whose request never answers would hang the row). The kit's settle
 * after the step runs what the press started. A helper refuses what a pro
 * couldn't do (a disabled control, a field that isn't editable) and what it
 * can't tell apart (two controls with the same words), so a row can't reach
 * a state no pro can. Nothing here imports the app: the kit loads it per
 * platform registry.
 */
import type { ReactTestInstance } from "react-test-renderer"

import type { ParityEnv, ParityLanguage } from "testing/hostTreeParity"

import en from "locales/en.json"
import ar from "locales/ar.json"

/** The copy, by language, straight from the app's files (t() draws the same). */
const COPY: Record<ParityLanguage, Record<string, unknown>> = {
  en: en.translation,
  ar: ar.translation,
}

/**
 * The translated string for `key` in the row's language, falling back to
 * English as the app's i18next does (fallbackLng "en": ar.json lacks a few
 * keys); throws on a key neither file has.
 */
export const copy = (env: ParityEnv, key: string): string => {
  const value = COPY[env.language][key] ?? COPY.en[key]
  if (typeof value !== "string") {
    throw new Error(`no string "${key}" in ${env.language}.json or en.json`)
  }
  return value
}

/**
 * The bottom insets to add for a screen with today's gap formula
 * (`insets.bottom > 45 ? 0 : 45 - insets.bottom` under a SafeAreaView): no
 * home indicator, and one past the 45 threshold. Each platform's default
 * row already draws its own inset (iOS 34, Android 24), so 34 on iOS would
 * repeat it, and 34 is where an "11 + inset" mistake still draws 45.
 */
export const BOTTOM_GAP_INSETS = [0, 48] as const

/** The outermost element that matches, and only one. */
export const only = (
  root: ReactTestInstance,
  predicate: (node: ReactTestInstance) => boolean,
  what: string
) => {
  const found = root.findAll(predicate, { deep: false })
  if (found.length !== 1) {
    throw new Error(`${what}: ${found.length} matches, expected 1`)
  }
  return found[0]
}

const takesPress = (node: ReactTestInstance) =>
  typeof node.props.onPress === "function"

/** A host that handles a touch itself: a touchable's native view. */
const handlesTouch = (node: ReactTestInstance) =>
  typeof node.type === "string" &&
  ["onClick", "onResponderRelease", "onPress"].some(
    (key) => typeof node.props[key] === "function"
  )

/**
 * The elements a tap on `node` goes through: `node`, and every element on
 * the way down to the first host that handles a touch (a wrapper View on the
 * way is passed through). `node` alone when none does (a press that only JS
 * handles).
 */
const touchPath = (node: ReactTestInstance): ReactTestInstance[] => {
  const walk = (
    at: ReactTestInstance,
    trail: ReactTestInstance[]
  ): ReactTestInstance[] | null => {
    const here = [...trail, at]
    if (handlesTouch(at)) return here
    for (const child of at.children) {
      if (typeof child === "string") continue
      const found = walk(child, here)
      if (found) return found
    }
    return null
  }
  return walk(node, []) ?? [node]
}

/**
 * Whether a control refuses a tap: anything a tap on it goes through
 * (touchPath) says it is disabled: a `disabled` (Button, a row, a
 * TouchableOpacity) or `disable` (ActionBtn) prop, or the touchable's
 * native view's accessibilityState (a loading ActionBtn or Button sets it,
 * and so does a row's own lock on the touchable it draws).
 */
const refusesTap = (node: ReactTestInstance) =>
  touchPath(node).some((at) => {
    const { disabled, disable, accessibilityState } = at.props as {
      disabled?: boolean
      disable?: boolean
      accessibilityState?: { disabled?: boolean }
    }
    return (
      disabled === true ||
      disable === true ||
      accessibilityState?.disabled === true ||
      at.props["aria-disabled"] === true
    )
  })

const refused = (what: string) =>
  `press "${what}": it is disabled, so a tap does nothing (pass { allowDisabled: true } to call its onPress anyway)`

export type PressOptions = {
  /**
   * Press it even though it is disabled (a tap would do nothing): a test of
   * the handler itself, never a step a pro takes.
   */
  allowDisabled?: boolean
}

/**
 * Press the control titled `title` (an ActionBtn, a Button, a My Account row:
 * each takes `title` and `onPress`), through its onPress, as a tap does.
 * What the handler returns is dropped: a tap doesn't wait for an async
 * handler (a save whose request never answers would hang the step), the
 * kit's settle after the step runs what it starts. A disabled control
 * throws (a tap does nothing there), unless `allowDisabled`.
 */
export const pressTitled = (
  root: ReactTestInstance,
  title: string,
  options: PressOptions = {}
): void => {
  const control = only(
    root,
    (node) => node.props.title === title && takesPress(node),
    `press "${title}"`
  )
  if (!options.allowDisabled && refusesTap(control)) {
    throw new Error(refused(title))
  }
  control.props.onPress()
}

/** Every text node's string children joined, for finding a press target by its words. */
const textOf = (node: ReactTestInstance): string =>
  node.children
    .map((child) => (typeof child === "string" ? child : textOf(child)))
    .join("")

const isInside = (node: ReactTestInstance, outer: ReactTestInstance) => {
  for (let up = node.parent; up; up = up.parent) if (up === outer) return true
  return false
}

export type PressTextOptions = PressOptions & {
  /**
   * Which of several controls showing the same words (0 for the first, in
   * the screen's order). Without it, more than one throws.
   */
  nth?: number
}

/**
 * Press the control whose text is `text` (a link drawn as a pressable view
 * around a text), through the innermost element with an onPress that shows
 * it: one control can be a chain of them (the view, its touchable), each
 * inside the last. Two separate controls with those words throw, unless
 * `nth` picks one, so a row can't press the wrong one without a word. A
 * disabled one throws, as pressTitled's does, unless `allowDisabled`.
 */
export const pressText = (
  root: ReactTestInstance,
  text: string,
  options: PressTextOptions = {}
): void => {
  const found = root.findAll(
    (node) => takesPress(node) && textOf(node) === text
  )
  if (found.length === 0) throw new Error(`press "${text}": no match`)
  // Each chain's innermost: a match with no other match inside it.
  const controls = found.filter(
    (node) => !found.some((other) => other !== node && isInside(other, node))
  )
  const { nth } = options
  if (nth === undefined && controls.length > 1) {
    throw new Error(
      `press "${text}": ${controls.length} controls show it (pass { nth } to pick one)`
    )
  }
  const control = controls[nth ?? 0]
  if (!control) {
    throw new Error(
      `press "${text}": no control ${String(nth)}, only ${controls.length}`
    )
  }
  if (!options.allowDisabled && refusesTap(control)) {
    throw new Error(refused(text))
  }
  control.props.onPress()
}

/** The fields (DmInput, PhoneInput) that take text, outermost first, in order. */
export const fields = (root: ReactTestInstance) =>
  root.findAll(
    (node) =>
      typeof node.props.onChangeText === "function" &&
      typeof node.type !== "string",
    { deep: false }
  )

/**
 * Type `text` into the `index`th field (as fields() orders them) the way a
 * keyboard does: through the onChangeText of the TextInput the field draws,
 * as fireEvent.changeText does, so the field's own handler runs on the way
 * (DmInput's and PhoneInput's fromArabic for digits). A field that draws no
 * TextInput (a DmInput with onPress) or one that isn't editable throws.
 */
export const typeInto = (
  root: ReactTestInstance,
  index: number,
  text: string
): void => {
  const all = fields(root)
  const field = all[index]
  if (!field) {
    throw new Error(`type into field ${index}: only ${all.length} fields`)
  }
  // The host TextInput React Native's mock draws (a string type, which
  // ElementType doesn't spell).
  const inputs = field.findAll(
    (node) =>
      (node.type as unknown) === "TextInput" &&
      typeof node.props.onChangeText === "function"
  )
  if (inputs.length !== 1) {
    throw new Error(
      `type into field ${index}: it draws ${inputs.length} text inputs, expected 1`
    )
  }
  const [input] = inputs
  if (input.props.editable === false) {
    throw new Error(`type into field ${index}: its text input isn't editable`)
  }
  input.props.onChangeText(text)
}

/**
 * Type a code into VerifyCodeInput's hidden field (the one the boxes draw
 * from), through its onChangeText, as the keyboard does.
 */
export const enterCode = (root: ReactTestInstance, code: string): void => {
  only(
    root,
    (node) =>
      typeof node.type !== "string" &&
      node.props.autoComplete === "one-time-code" &&
      typeof node.props.onChangeText === "function",
    "the code field"
  ).props.onChangeText(code)
}

/**
 * Something the pro does before the tree is read: a press, typing. The kit
 * settles 500 ms after each; `settleMs` gives a step longer (a card's close,
 * whose present on iOS ends on a 2 s backstop under jest: the Modal stand-in
 * reports a dismissal, not a present).
 */
export type Step = ((
  root: ReactTestInstance,
  env: ParityEnv
) => void | Promise<void>) & { settleMs?: number }

/** A step that does nothing but let `ms` pass. */
export const wait = (ms: number): Step =>
  Object.assign(() => undefined, { settleMs: ms })
