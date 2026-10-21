/**
 * Jest only. A harvested ActionBtn look (../harvest) as the design system's
 * Button props: what a conversion writes, worked out from the call site's
 * classes the way the codemod reads them, through NativeWind's exact
 * resolver (scripts/nw-resolve). It never looks at what ActionBtn drew; the
 * parity test renders Button with these props and compares the trees.
 * (In __fixtures__ with the case modules: the style ratchet doesn't count
 * the px() escapes it writes, which are a conversion's, not app code.)
 *
 * - The container's classes split into the size (h-[n]), the corners
 *   (rounded-N), the padding (px-[n]), the layout keys (margins, width,
 *   flex, self-*: Button's `style`) and the look classes, which together
 *   with ActionBtn's `variant` pick the Button variant (VARIANT_RULES).
 *   The state classes (a grey only while disabled, loading or neither) pick
 *   the disabled look, the loading surface, or `looksDisabled`.
 * - The label is ActionBtn's own label string with the caller's classes
 *   appended, resolved per language as DmText draws it; its size, face, line
 *   height in both languages, tracking, case and offset pick the label props.
 *   Its colour comes from the caller's colour class, when there is one.
 */
import React from "react"
import clsx from "clsx"

import {
  AR_LINE_HEIGHT_RATIO,
  LEADING,
  SPACE_SCALE,
  TEXT_SIZES,
  color,
  controls,
  px,
  type ButtonLeading,
  type DisabledLabelLook,
  type DisabledLook,
  type DsButtonProps,
  type LeadingStep,
  type TextColor,
  type Weight,
} from "@tappler/shared/src/ds"
import {
  VARIANTS,
  legacyLabelLineHeight,
  type ButtonShape,
  type ButtonVariant,
} from "@tappler/shared/src/ds/buttonStyles"
// The Latin faces as tappler-shared holds them right now: what DmText draws.
// customerapp registers none (index.js), so they are shared's Montserrat;
// proapp's translator read the faces its index.js registers (Poppins) from
// the parity kit instead.
import {
  ARABIC_FONT_WEIGHTS,
  getLatinFontWeights,
} from "@tappler/shared/src/helpers/helpers"

import type { ElementSpec, Look, SpecValue } from "../harvest"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nw = require("../../../../scripts/nw-resolve")

type Style = Record<string, unknown>

const resolveClass = (className: string): Style => nw.resolve(className).style

const SHAPES: Record<number, ButtonShape> = {
  28: "pill",
  10: "r10",
  8: "r8",
  5: "r5",
  4: "r4",
  0: "square",
}

const LABEL_PRESETS: Record<number, "sm" | "md" | "lg"> = {
  13: "sm",
  15: "md",
  16: "lg",
}

const LAYOUT_KEYS = new Set([
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "width",
  "minWidth",
  "maxWidth",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
])
const LOOK_KEY =
  /^(backgroundColor|opacity|border(Top|Right|Bottom|Left)?(Width|Color))$/
const RADIUS_KEY = /^border(TopLeft|TopRight|BottomRight|BottomLeft)Radius$/

/** The classes that paint a state rather than a look. */
const STATE_CLASSES = new Set(["bg-grey7", "bg-grey16", "bg-grey4"])

/**
 * ActionBtn's variant and the caller's look classes (sorted) -> Button's
 * variant and hairline. Anything else has no Button variant.
 */
const VARIANT_RULES: Record<
  string,
  { variant: ButtonVariant; hairline?: "brand" | "ink" }
> = {
  "primary|": { variant: "primary" },
  "primary|bg-red": { variant: "primary" },
  "primary|bg-black": { variant: "dark" },
  "primary|bg-grey5": { variant: "silver" },
  "primary|bg-red2": { variant: "rose" },
  "primary|bg-white border-1 border-black": { variant: "outline" },
  "primary|bg-transparent border-1 border-white": { variant: "outlineOnRed" },
  "white|": { variant: "white" },
  "white|border-red": { variant: "white", hairline: "brand" },
  "white|border-0": { variant: "onRed" },
  "white|bg-transparent border-1 border-white": { variant: "outlineOnRed" },
  "bordered|": { variant: "bordered" },
  "bordered|border-black": { variant: "bordered", hairline: "ink" },
  "yellow|": { variant: "yellow" },
  "grey|": { variant: "grey" },
  "lightgrey|": { variant: "lightgrey" },
}

/** ActionBtn's variants; anything else (undefined, "red") draws its default. */
const ACTIONBTN_VARIANTS = new Set([
  "white",
  "bordered",
  "grey",
  "yellow",
  "lightgrey",
])

const hexToTextColor = (hex: string): TextColor => {
  const found = (Object.keys(color.text) as TextColor[]).find(
    (key) => color.text[key].toUpperCase() === hex.toUpperCase()
  )
  if (!found) throw new Error(`no text colour token for ${hex}`)
  return found
}

const WEIGHTS: Record<Weight, "400" | "500" | "600" | "700"> = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
}

const faceOf = (
  family: "auto" | "latin" | "arabic",
  weight: Weight,
  lang: "en" | "ar"
) => {
  const arabic = family === "auto" ? lang === "ar" : family === "arabic"
  return arabic
    ? ARABIC_FONT_WEIGHTS[WEIGHTS[weight]]
    : getLatinFontWeights()[WEIGHTS[weight]]
}

const close = (left: unknown, right: number) =>
  typeof left === "number" && Math.abs(left - right) < 1e-9

export type Translated = {
  props: DsButtonProps
  /** The props as a conversion would write them, for the report. */
  written: string
}

function fail(look: Look, message: string): never {
  throw new Error(`${message}\n  look: ${JSON.stringify(look)}`)
}

const tokensOf = (value: SpecValue | undefined) =>
  typeof value === "string" ? value.split(/\s+/).filter(Boolean) : []

/** ActionBtn.tsx's label string for this look (its own classes, then the caller's). */
const actionBtnLabel = (look: Look) => {
  const variant = look.variant as string | undefined
  const text = (look.textClassName as string | undefined) ?? ""
  return clsx(
    " text-16 text-white text-center leading-[19px]",
    !text.match(/font/) && "font-custom500",
    { "text-black": variant === "white" || variant === "yellow" },
    { "text-red": variant === "bordered" && !look.disable },
    { "text-grey7": variant === "bordered" && !!look.disable },
    text
  )
}

const writtenValue = (value: unknown): string => {
  if (typeof value === "string") return JSON.stringify(value)
  if (typeof value === "number") return `{${value}}`
  if (typeof value === "boolean") return `{${value}}`
  if (React.isValidElement(value)) return "{<icon />}"
  return `{${JSON.stringify(value)}}`
}

export const translate = (
  look: Look,
  buildNode: (spec: ElementSpec) => React.ReactNode
): Translated => {
  const props: Record<string, unknown> = {
    title: look.title,
  }
  const pxValues = new Set<string>()
  const pxOf = (value: number, name: string) => {
    pxValues.add(name)
    return px(value)
  }

  if (look.onPress) props.onPress = () => undefined
  const disable = look.disable as boolean | undefined
  const loading = look.isLoading as boolean | undefined
  if ("disable" in look) props.disabled = disable
  if ("isLoading" in look) props.isLoading = loading

  // --- the container ---------------------------------------------------
  const container = tokensOf(look.className)
  const layout: string[] = []
  const lookClasses: string[] = []
  const stateClasses: string[] = []
  let height: number | undefined
  let corner: number | undefined
  let paddingX: number | undefined
  container.forEach((token) => {
    const style = resolveClass(token)
    const keys = Object.keys(style)
    // A class NativeWind draws nothing for leaves ActionBtn's own value in
    // place, so it takes no prop: rounded-[12], a bare radius
    // (RequestSummary:467), keeps ActionBtn's 28 corners (skeptic H4). A
    // font class on the container draws nothing there either.
    if (keys.length === 0) return
    if (STATE_CLASSES.has(token)) {
      stateClasses.push(token)
    } else if (keys.length === 1 && keys[0] === "height") {
      height = style.height as number
    } else if (keys.length > 0 && keys.every((key) => RADIUS_KEY.test(key))) {
      corner = style.borderTopLeftRadius as number
    } else if (
      keys.length === 2 &&
      "paddingLeft" in style &&
      "paddingRight" in style &&
      style.paddingLeft === style.paddingRight
    ) {
      paddingX = style.paddingLeft as number
    } else if (keys.length > 0 && keys.every((key) => LAYOUT_KEYS.has(key))) {
      layout.push(token)
    } else if (keys.length > 0 && keys.every((key) => LOOK_KEY.test(key))) {
      lookClasses.push(token)
    } else {
      fail(look, `a container class Button has no prop for: ${token}`)
    }
  })

  if (height !== undefined && height !== controls.button.xl) {
    const token = (
      Object.keys(controls.button) as (keyof typeof controls.button)[]
    ).find((name) => controls.button[name] === height)
    props.size = token ?? pxOf(height, "size")
  }
  if (corner !== undefined && corner !== 28) {
    props.shape = SHAPES[corner] ?? pxOf(corner, "shape")
  }
  const onScale = (value: number) =>
    (SPACE_SCALE as readonly number[]).includes(value)
  if (paddingX !== undefined) {
    props.paddingX = onScale(paddingX) ? paddingX : pxOf(paddingX, "paddingX")
  }
  if (layout.length) props.style = resolveClass(layout.join(" "))

  const actionVariant = ACTIONBTN_VARIANTS.has(look.variant as string)
    ? (look.variant as string)
    : "primary"
  const ruleKey = `${actionVariant}|${[...lookClasses].sort().join(" ")}`
  const rule = VARIANT_RULES[ruleKey]
  if (!rule) fail(look, `no Button variant for ${ruleKey}`)
  if (rule.variant !== "primary") props.variant = rule.variant
  if (rule.hairline) props.hairline = rule.hairline
  const variantLabel = VARIANTS[rule.variant].label
  // Only primary and yellow take a state's fill; every other variant keeps
  // its own surface when disabled and under the spinner (Button's types
  // refuse a fill there), so a fill class has no prop on it.
  const takesDisabledFill = VARIANTS[rule.variant].disabled === "fill"
  const takesLoadingFill = VARIANTS[rule.variant].loading === "fill"
  // ActionBtn's grey state fill comes before the caller's classes in its
  // clsx, so a caller's background still draws while disabled or loading:
  // red under the spinner at AddNewAddress:234, GateRegister:222 and
  // Register:326 (CA-W0-B). Where Button puts a state fill instead, the
  // look has no spelling.
  const state = loading ? "loading" : disable ? "disabled" : null
  const fillsState =
    state === "loading" ? takesLoadingFill : state === "disabled" && takesDisabledFill
  const paints = lookClasses.filter(
    (token) => "backgroundColor" in resolveClass(token)
  )
  if (fillsState && paints.length)
    fail(
      look,
      `${paints.join(" ")} draws over ActionBtn's ${state} fill (the caller's classes come last), where Button draws its ${state} fill`
    )

  // --- the state classes ------------------------------------------------
  let surface = "legacy" as "legacy" | "design" | "shade"
  const disabledFill = (fill: "design" | "shade", token: string) => {
    if (!takesDisabledFill)
      fail(
        look,
        `${token} while disabled on ${rule.variant}, which keeps its own surface`
      )
    surface = fill
  }
  stateClasses.forEach((token) => {
    if (token === "bg-grey16") {
      if (!disable || loading)
        fail(look, "bg-grey16 outside the disabled state")
      disabledFill("design", token)
    } else if (token === "bg-grey4") {
      if (loading) {
        if (!takesLoadingFill)
          fail(
            look,
            `bg-grey4 while loading on ${rule.variant}, which keeps its own surface`
          )
        props.loadingSurface = "shade"
      } else if (disable) disabledFill("shade", token)
      else fail(look, "bg-grey4 on an enabled button")
    } else if (token === "bg-grey7") {
      if (!disable && !loading) props.looksDisabled = true
    }
  })

  // --- the label -----------------------------------------------------------
  const labelString = actionBtnLabel(look)
  const en: Style = nw.resolveDmText(labelString, { lang: "en" }).style
  const ar: Style = nw.resolveDmText(labelString, { lang: "ar" }).style
  const known = new Set([
    "fontSize",
    "lineHeight",
    "fontFamily",
    "color",
    "textAlign",
    "letterSpacing",
    "textTransform",
    "marginTop",
  ])
  Object.keys(en).forEach((key) => {
    if (!known.has(key))
      fail(look, `a label key Button has no prop for: ${key}`)
  })
  if (en.textAlign !== "center") fail(look, "a label not centred")

  const size = en.fontSize as number
  if (size !== 16) {
    props.label =
      LABEL_PRESETS[size] ??
      ((TEXT_SIZES as readonly number[]).includes(size)
        ? size
        : pxOf(size, "label"))
  }

  // The face: the language's own first, then one pinned for both.
  // TheSans has one bold for 600 and 700, so the weight the classes name
  // is tried first.
  const families = ["auto", "latin", "arabic"] as const
  const named = [
    ...labelString.matchAll(/font-(?:custom|montserrat|sans)(\d{3})/g),
  ]
    .map((match) => match[1])
    .pop()
  const weights = (Object.keys(WEIGHTS) as Weight[]).sort(
    (left, right) =>
      Number(WEIGHTS[right] === named) - Number(WEIGHTS[left] === named)
  )
  let face: { family: (typeof families)[number]; weight: Weight } | undefined
  families.some((family) =>
    weights.some((weight) => {
      if (
        faceOf(family, weight, "en") === en.fontFamily &&
        faceOf(family, weight, "ar") === ar.fontFamily
      ) {
        face = { family, weight }
        return true
      }
      return false
    })
  )
  if (!face) fail(look, `no face draws ${en.fontFamily} / ${ar.fontFamily}`)
  if (face.weight !== "medium") props.labelWeight = face.weight
  if (face.family !== "auto") props.labelFamily = face.family

  // The line height in both languages, by the first leading that draws it.
  // (A step, or one for any size: the label's size is only known per look.)
  type Leading = LeadingStep | ButtonLeading
  const steps = (LEADING as Record<number, Record<string, number>>)[size] ?? {}
  const lastLeading = [
    ...labelString.matchAll(/leading-\[(\d{1,2})px\]/g),
  ].pop()
  const candidates: [Leading, number, number][] = [
    ...Object.entries(steps).map(
      ([step, value]) =>
        [step, value, value * AR_LINE_HEIGHT_RATIO] as [Leading, number, number]
    ),
    ["legacy", legacyLabelLineHeight(size), 19 * AR_LINE_HEIGHT_RATIO],
  ]
  if (lastLeading && Number(lastLeading[1]) !== 19) {
    const base = Number(lastLeading[1])
    const english = legacyLabelLineHeight(size, base)
    // A size the config gives no line height keeps `base` in English too:
    // that is px(base), the plainer spelling, below.
    if (english !== base) {
      candidates.push([
        { legacy: px(base) },
        english,
        base * AR_LINE_HEIGHT_RATIO,
      ])
    }
  }
  candidates.push([
    px(en.lineHeight as number),
    en.lineHeight as number,
    (en.lineHeight as number) * AR_LINE_HEIGHT_RATIO,
  ])
  const leading = candidates.find(
    ([, enValue, arValue]) =>
      close(en.lineHeight, enValue) && close(ar.lineHeight, arValue)
  )
  if (!leading) {
    fail(look, `no leading draws ${en.lineHeight} / ${ar.lineHeight}`)
  }
  const [chosen] = leading
  if (chosen !== "tight") {
    if (typeof chosen === "number") pxValues.add("labelLeading")
    props.labelLeading = chosen
  }

  if (en.letterSpacing !== undefined) {
    props.labelTracking = pxOf(en.letterSpacing as number, "labelTracking")
  }
  if (en.textTransform !== undefined) {
    if (en.textTransform !== "uppercase") {
      fail(look, `a label case Button has no prop for: ${en.textTransform}`)
    }
    props.labelCase = "upper"
  }
  if (en.marginTop !== undefined) {
    props.labelOffset = pxOf(en.marginTop as number, "labelOffset")
  }

  // The colour: the caller's colour class, if there is one.
  let callerColor: TextColor | undefined
  tokensOf(look.textClassName).forEach((token) => {
    const style = resolveClass(token)
    if (typeof style.color === "string")
      callerColor = hexToTextColor(style.color)
  })
  let label: "inverse" | "muted" = "inverse"
  if (callerColor === "disabledButton" && (disable || props.looksDisabled)) {
    label = "muted"
  } else if (callerColor && callerColor !== variantLabel) {
    props.labelColor = callerColor
  }

  // On a variant that keeps its own surface, the look is its label half.
  const disabledLook: DisabledLook | DisabledLabelLook | undefined =
    surface === "legacy" && label === "inverse"
      ? undefined
      : !takesDisabledFill
        ? { label }
        : surface === "design" && label === "muted"
          ? "design"
          : { surface, label }
  if (disabledLook) props.disabledLook = disabledLook

  // --- content -----------------------------------------------------------
  if (look.Icon) props.icon = buildNode(look.Icon as ElementSpec)
  if (look.isIconRight) props.iconAt = "end"
  if (look.IconNearTitle) {
    props.titleIcon = buildNode(look.IconNearTitle as ElementSpec)
  }
  if (look.titleSecond) props.secondTitle = look.titleSecond
  if (look.descr) props.description = look.descr
  if (look.reverseItems) props.reverse = true
  if (look.classNameTextWrapper) {
    const style = resolveClass(look.classNameTextWrapper as string)
    const keys = Object.keys(style).sort()
    if (
      keys.join(",") !== "marginLeft,marginRight" ||
      style.marginLeft !== style.marginRight
    ) {
      fail(
        look,
        `a label box class Button has no prop for: ${look.classNameTextWrapper}`
      )
    }
    const inset = style.marginLeft as number
    props.labelInset = onScale(inset) ? inset : pxOf(inset, "labelInset")
  }
  if (look.classNameIcon) fail(look, "classNameIcon has no Button prop")

  const written = Object.entries(props)
    .filter(([key]) => key !== "title" && key !== "onPress")
    .map(([key, value]) => {
      if (pxValues.has(key) && typeof value === "number") {
        return `${key}={px(${value})}`
      }
      if (key === "style") return `style={${JSON.stringify(value)}}`
      if (value === true) return key
      return `${key}=${writtenValue(value)}`
    })
    .join(" ")

  return { props: props as DsButtonProps, written: written || "(defaults)" }
}
