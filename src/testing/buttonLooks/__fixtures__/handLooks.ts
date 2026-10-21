/**
 * Jest only. ActionBtn looks no customerapp site draws today, so the harvest
 * (../harvest) can't find them, but which Button has a prop for: every variant
 * in every state (enabled, disabled, loading, both), with and without
 * onPress, and the content props no site passes yet (titleSecond, descr,
 * reverseItems) on the variants whose colours they follow. Each is an
 * ActionBtn prop set like a harvested look, captured from ActionBtn and
 * compared the same way.
 */
import type { Look } from "../harvest"

const FN = { $fn: true as const }

/** How each Button variant is written on ActionBtn: its variant and the classes that make it. */
export const RECIPES: Readonly<Record<string, Look>> = {
  primary: {},
  white: { variant: "white" },
  bordered: { variant: "bordered" },
  yellow: { variant: "yellow" },
  grey: { variant: "grey" },
  lightgrey: { variant: "lightgrey" },
  dark: { className: "bg-black" },
  onRed: {
    variant: "white",
    className: "border-0",
    textClassName: "text-red",
  },
  outlineOnRed: {
    variant: "white",
    className: "bg-transparent border-1 border-white",
    textClassName: "text-white",
  },
  silver: { className: "bg-grey5", textClassName: "text-black" },
  rose: { className: "bg-red2", textClassName: "text-white" },
  outline: {
    className: "border-1 border-black bg-white",
    textClassName: "text-black",
  },
  whiteRedHairline: { variant: "white", className: "border-red" },
  borderedBlack: {
    variant: "bordered",
    className: "border-black",
    textClassName: "text-black",
  },
}

const STATES: Record<string, Look> = {
  enabled: {},
  disabled: { disable: true },
  loading: { isLoading: true },
  "disabled loading": { disable: true, isLoading: true },
}

const join = (...parts: (string | undefined)[]) =>
  parts.filter(Boolean).join(" ")

/** The recipe on a form button (47, corners 5, 13/16 semibold), as most sites write it. */
const lookOf = (recipe: Look, extra: Look = {}): Look => {
  const { className, textClassName, ...rest } = recipe
  const { className: extraClass, textClassName: extraText, ...more } = extra
  return {
    title: "Button title",
    ...rest,
    className: join(
      "h-[47] rounded-5",
      className as string,
      extraClass as string
    ),
    textClassName: join(
      "text-13 leading-[16px] font-custom600",
      textClassName as string,
      extraText as string
    ),
    ...more,
  }
}

const looks: Record<string, Look> = {}

Object.entries(RECIPES).forEach(([name, recipe]) => {
  Object.entries(STATES).forEach(([state, flags]) => {
    looks[`hand ${name} ${state}`] = lookOf(recipe, { onPress: FN, ...flags })
  })
  looks[`hand ${name} no onPress`] = lookOf(recipe)
  looks[`hand ${name} no onPress disabled`] = lookOf(recipe, { disable: true })
})

// The content props no site passes, on the variants whose colours they
// follow (ActionBtn's second title stays white on yellow) and in the states
// that recolour them.
const GLYPH = { $el: "Glyph" }
const CONTENT: Record<string, Look> = {
  "second title": { titleSecond: "Second title" },
  description: { descr: "Description" },
  "reversed, icon near the title": {
    reverseItems: true,
    IconNearTitle: GLYPH,
  },
  "reversed second title": { reverseItems: true, titleSecond: "Second title" },
  "icon at the start, second title, description": {
    Icon: GLYPH,
    titleSecond: "Second title",
    descr: "Description",
  },
  "icon at the end, icon near the title": {
    Icon: GLYPH,
    isIconRight: true,
    IconNearTitle: GLYPH,
  },
}

;[
  "primary",
  "white",
  "bordered",
  "yellow",
  "lightgrey",
  "borderedBlack",
].forEach((name) => {
  Object.entries(CONTENT).forEach(([content, extra]) => {
    looks[`hand ${name} ${content}`] = lookOf(RECIPES[name], {
      onPress: FN,
      ...extra,
    })
    looks[`hand ${name} ${content} disabled`] = lookOf(RECIPES[name], {
      onPress: FN,
      disable: true,
      ...extra,
    })
  })
})

// An icon while loading: ActionBtn drops the icon row and the icons.
looks["hand primary icon loading"] = lookOf(RECIPES.primary, {
  onPress: FN,
  isLoading: true,
  Icon: GLYPH,
})
looks["hand white icon at the end disabled"] = lookOf(RECIPES.white, {
  onPress: FN,
  disable: true,
  Icon: GLYPH,
  isIconRight: true,
})

export const HAND_LOOKS: Readonly<Record<string, Look>> = Object.freeze(looks)
