/**
 * Jest only. What a customer does to a screen before its tree is read, by
 * what they see rather than by testIDs (a screen has none, and can't get one
 * in pass 1: a testID is a host prop, so the tree would change): the copy in
 * the row's language, a press on a titled control or on a link's words,
 * typing into a field, a native view's callback (a map settling, an
 * animation ending), a sheet closed by a swipe, and the rows a screen's
 * bottom gap needs. treeAfter (index.ts) runs a list of these. proapp's
 * (written for its My Account screens, W2b P3), on customerapp's copy.
 *
 * Each press calls the element's own onPress, as a tap does, and returns
 * nothing: a tap doesn't wait for an async handler, and session.act would
 * (a save whose request never answers would hang the row). The kit's settle
 * after the step runs what the press started. A helper refuses what a customer
 * couldn't do (a disabled control, a field that isn't editable) and what it
 * can't tell apart (two controls with the same words), so a row can't reach
 * a state no customer can. Nothing here imports the app: the kit loads it per
 * platform registry.
 */
import type { ReactTestInstance } from "react-test-renderer"

import type { ParityEnv, ParityLanguage } from "testing/hostTreeParity"
import { userDismiss, type TrueSheetStandIn } from "testing/trueSheet"

import en from "locales/en.json"
import ar from "locales/ar.json"

/**
 * The copy, by language, straight from the app's files (t() draws the
 * same). customerapp's are flat (setupI18n wraps them for i18next).
 */
const COPY: Record<ParityLanguage, Record<string, unknown>> = { en, ar }

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
   * the handler itself, never a step a customer takes.
   */
  allowDisabled?: boolean
}

/**
 * Press the control titled `title` (an ActionBtn, a Button, an account row:
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

export type PressIconOptions = PressOptions & {
  /**
   * A host the control draws: an SVG icon's (`svg:close`, as the kit's svg
   * transformer names each after its file) or any other host type (`Image`,
   * `LottieView`). Without it, every icon-only control counts.
   */
  icon?: string
  /**
   * Which of several (0 for the first, in the screen's order). Without it,
   * more than one throws, listing what each draws.
   */
  nth?: number
}

/** What a control draws, for an error: the hosts that aren't views or text, or how many views. */
const drawnBy = (control: ReactTestInstance) => {
  const hosts = control.findAll((node) => typeof node.type === "string")
  const named = [
    ...new Set(
      hosts
        .map((node) => node.type as unknown as string)
        .filter((type) => type !== "View" && type !== "Text")
    ),
  ]
  return named.length > 0 ? named.join(" ") : `${hosts.length} views`
}

/**
 * Press an icon-only control (one with an onPress that shows no words: a
 * back chevron, a close X, JobDetail's three dots), through its onPress, as
 * pressText does: the innermost element of the chain. Pick it by a host it
 * draws (`icon`), by its place among the screen's icon-only controls
 * (`nth`), or both. Several matches throw, listing what each draws, so a row
 * can't press the wrong one without a word; a disabled one throws, as
 * pressTitled's does, unless `allowDisabled`.
 */
export const pressIcon = (
  root: ReactTestInstance,
  options: PressIconOptions = {}
): void => {
  const { icon, nth } = options
  const what = icon ? `an icon-only control drawing ${icon}` : "an icon-only control"
  // Something on screen to tap (an element that draws no host, a closed
  // modal's say, isn't), with no words, and the icon when one is named.
  const found = root.findAll(
    (node) =>
      takesPress(node) &&
      textOf(node) === "" &&
      node.findAll((inner) => typeof inner.type === "string").length > 0 &&
      (icon === undefined ||
        node.findAll((inner) => (inner.type as unknown) === icon).length > 0)
  )
  const controls = found.filter(
    (node) => !found.some((other) => other !== node && isInside(other, node))
  )
  if (controls.length === 0) throw new Error(`press ${what}: no match`)
  if (nth === undefined && controls.length > 1) {
    throw new Error(
      `press ${what}: ${controls.length} controls (pass { nth } to pick one, in screen order): ${controls
        .map((control, index) => `[${index}] ${drawnBy(control)}`)
        .join(", ")}`
    )
  }
  const control = controls[nth ?? 0]
  if (!control) {
    throw new Error(
      `press ${what}: no control ${String(nth)}, only ${controls.length}`
    )
  }
  if (!options.allowDisabled && refusesTap(control)) {
    throw new Error(refused(nth === undefined ? what : `${what} [${nth}]`))
  }
  control.props.onPress()
}

/** The fields (DmInput, DmAuthInput) that take text, outermost first, in order. */
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
 * (DmInput's fromArabic for digits). A field that draws no
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

export type FireOptions = {
  /** Which of several such views (0 for the first, in screen order). */
  nth?: number
}

/**
 * Call the `prop` callback a native view's stand-in was handed, as the
 * device calls it: a host named `type` (nativeMocks' MapView and its
 * onRegionChangeComplete, LottieView's onAnimationFinish, Video's onLoad...)
 * with `args`. Several such views throw unless `nth` picks one; none
 * holding the callback throws too. Returns nothing, as a press does.
 */
export const fireHost = (
  root: ReactTestInstance,
  type: string,
  prop: string,
  args: unknown[] = [],
  options: FireOptions = {}
): void => {
  const found = root.findAll(
    (node) =>
      (node.type as unknown) === type &&
      typeof node.props[prop] === "function"
  )
  const what = `${type}'s ${prop}`
  if (found.length === 0) throw new Error(`fire ${what}: no ${type} holds it`)
  const { nth } = options
  if (nth === undefined && found.length > 1) {
    throw new Error(
      `fire ${what}: ${found.length} views hold it (pass { nth } to pick one)`
    )
  }
  const host = found[nth ?? 0]
  if (!host) {
    throw new Error(`fire ${what}: no view ${String(nth)}, only ${found.length}`)
  }
  host.props[prop](...args)
}

/** The presented sheets (testing/trueSheet's instances), in screen order. */
export const presentedSheets = (root: ReactTestInstance) =>
  root
    .findAll(
      (node) =>
        node.instance !== null &&
        typeof node.instance === "object" &&
        typeof (node.instance as { present?: unknown }).present ===
          "function" &&
        (node.instance as { state?: { presented?: boolean } }).state
          ?.presented === true,
      { deep: true }
    )
    .map((node) => node.instance as TrueSheetStandIn)

export type CloseSheetOptions = FireOptions & {
  /**
   * Swipe a sheet that isn't dismissible anyway, to draw the refused swipe:
   * the sheet stays up and the library reports onDismissAttempt. Never a
   * way to close it.
   */
  refused?: boolean
}

/**
 * Close a presented sheet the way a customer does, with a swipe or a tap on
 * the dim: the sheet reports its dismissal with nobody's dismiss() behind
 * it, so shared's NativeSheet calls onDismissed (a programmatic close calls
 * only onClosed). Several presented sheets throw unless `nth` picks one.
 *
 * A sheet that isn't dismissible throws (review M5): the device refuses the
 * swipe, and the dim's tap does nothing, so no customer closes it this way.
 * shared's NativeSheet hands true-sheet `dismissible={false}` for
 * `dismissable={false}` and for every `interceptBackPress` sheet
 * (NativeSheet.tsx:514), QuestionFlowSheet's among them. Close such a sheet
 * with its own controls; `{ refused: true }` draws the refused swipe.
 */
export const closeSheetAsUser = (
  root: ReactTestInstance,
  options: CloseSheetOptions = {}
): void => {
  const sheets = presentedSheets(root)
  if (sheets.length === 0) throw new Error("close a sheet: none is presented")
  const { nth } = options
  if (nth === undefined && sheets.length > 1) {
    throw new Error(
      `close a sheet: ${sheets.length} are presented (pass { nth } to pick one)`
    )
  }
  const sheet = sheets[nth ?? 0]
  if (!sheet) throw new Error(`close a sheet: no sheet ${String(nth)}`)
  const dismissible = sheet.props.dismissible !== false
  if (!dismissible && !options.refused) {
    throw new Error(
      "close a sheet: it isn't dismissible (dismissible={false}: shared's NativeSheet passes that for " +
        "dismissable={false} and for every interceptBackPress sheet), so the device refuses a customer's swipe: " +
        "the sheet stays up and reports onDismissAttempt, and a tap on the dim does nothing. Close it with its own " +
        "controls (pressTitled, pressText, pressIcon), or pass { refused: true } to draw the refused swipe."
    )
  }
  if (dismissible && options.refused) {
    throw new Error(
      "close a sheet: it is dismissible, so a customer's swipe closes it (drop { refused: true })"
    )
  }
  userDismiss(sheet)
}

/**
 * Something the customer does before the tree is read: a press, typing. The kit
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
