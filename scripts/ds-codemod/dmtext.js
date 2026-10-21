/**
 * Rule 1: <DmText className="..."> -> the design system's <Text size weight
 * leading color align family style>.
 *
 * Every combination of the className's conditions is resolved the way
 * DmText renders it (nw-resolve --dmtext: the guard prefix, NativeWind, then
 * takeFontStyles per language) in English and Arabic. The Text props that
 * give exactly that (fontSize, lineHeight, fontFamily, colour, alignment)
 * are found against the real token table, and the remaining keys go to
 * style. The whole result is then checked per combination and language
 * against DmText's, before anything is written.
 *
 * A style with typography in it (textstyle.js) is DmText's middle layer:
 * classes, then style, then the font layer. Its typography joins the props
 * and the rest of it stays the style; a typography key the font layer draws
 * over is reported, since it renders nothing today.
 */
const { NwResolveError, resolveDmText, shippedFaces } = require("../nw-resolve")
const { assignments, atomsOf, evaluate } = require("./classexpr")
const { Unconvertible, styleFromIR } = require("./plain")
const { deepEqual, evalStyle, flatten, staticExpr } = require("./styles")

const WEIGHTS = ["regular", "medium", "semibold", "bold"]
const FAMILIES = ["auto", "latin", "arabic", "system"]
const STEPS = ["tight", "normal", "loose"]
const ALIGN = { start: "left", center: "center", end: "right" }
const ALIGN_OF = { left: "start", center: "center", right: "end" }
const TYPO_KEYS = ["fontSize", "lineHeight", "fontFamily", "fontWeight"]
// Props of the design system's Text that DmText doesn't have: a call site
// passing one of them can't keep it.
const TEXT_PROPS = ["size", "weight", "leading", "color", "align", "family"]

// A size on the scale defaults to its normal step (tight where it has none);
// an off-scale px() size has no steps and defaults to legacy.
const onScale = (ds, size) => ds.TEXT_SIZES.includes(size)
const defaultStep = (ds, size) =>
  !onScale(ds, size)
    ? "legacy"
    : "normal" in ds.LEADING[size]
      ? "normal"
      : "tight"

// The codemod's px() leading is { px: n }; Text's own objects ({ fixed: n },
// { legacy: n }) are passed as they are.
const leadingValue = (leading) =>
  leading && typeof leading === "object" && "px" in leading
    ? leading.px
    : leading

/** What the token table gives for these props in `lang`. */
const textTypography = (ds, lang, p) =>
  ds.textStyle(lang, p.size, p.weight, leadingValue(p.leading), p.family)

/** The flattened style the design system's Text puts on its host. */
const emulateText = (ds, lang, p, extra = []) =>
  flatten([
    textTypography(ds, lang, p),
    { color: ds.color.text[p.color || "primary"] },
    { textAlign: ALIGN[p.align || "start"] },
    ...extra,
  ])

/**
 * size, weight, family and leading that reproduce DmText's fontSize,
 * lineHeight and fontFamily in both languages, preferring a step to legacy
 * to px(), and the language's own face to a pinned one. `named`: the weight
 * the classes name last (`font-sans700`'s 700), tried first, since TheSans
 * draws 600 and 700 alike and the source said which (as the ActionBtn
 * translator does).
 */
const NAMED_WEIGHT = { 400: "regular", 500: "medium", 600: "semibold", 700: "bold" }
const namedWeight = (str) => {
  const all = [...(str || "").matchAll(/font-(?:custom|montserrat|sans)(\d{3})/g)]
  return all.length ? NAMED_WEIGHT[all[all.length - 1][1]] || null : null
}
const mapTypography = (ds, en, ar, named = null) => {
  const size = en.fontSize
  if (ar.fontSize !== size)
    throw new Unconvertible("not-expressible", "fontSize differs by language")
  // Off the scale, Text takes px(n) (TextSizeOrPx); fractional sizes stay.
  if (!Number.isInteger(size) || size <= 0)
    throw new Unconvertible("off-scale-size", `text size ${size}`)
  let face = null
  const weights = named
    ? [named, ...WEIGHTS.filter((w) => w !== named)]
    : WEIGHTS
  for (const family of FAMILIES) {
    for (const weight of family === "system" ? ["regular"] : weights) {
      const e = ds.textStyle("en", size, weight, "legacy", family).fontFamily
      const a = ds.textStyle("ar", size, weight, "legacy", family).fontFamily
      if (e === en.fontFamily && a === ar.fontFamily) {
        face = { family, weight }
        break
      }
    }
    if (face) break
  }
  if (!face) {
    // customerapp's font-sans400/500 (TheSans-Regular) and font-sans600
    // (TheSans-SemiBold) name faces it doesn't ship: the device draws the
    // system face, which no Text family spells with that fontFamily. A bridge
    // keeps it by hand (WelcomeScreen:83, customerapp-plan CA5).
    const shipped = shippedFaces()
    const unshipped = [
      ...new Set([en.fontFamily, ar.fontFamily].filter(Boolean)),
    ].filter((f) => shipped && !shipped.has(f))
    if (unshipped.length)
      throw new Unconvertible(
        "unshipped-face",
        `${unshipped.join(" / ")} isn't a face the app ships, so the device draws the system face; no Text family writes that fontFamily (bridge it by hand)`
      )
    throw new Unconvertible(
      "font-not-expressible",
      `faces ${en.fontFamily || "(system)"} / ${ar.fontFamily || "(system)"} (en/ar) match no weight and family`
    )
  }
  const candidates = [
    ...(onScale(ds, size) ? STEPS.filter((s) => s in ds.LEADING[size]) : []),
    "legacy",
    { px: en.lineHeight },
    // a size class over the text's own leading-[n]: the size's line height
    // in English, n x 1.32 in Arabic
    ...(typeof ar.lineHeight === "number"
      ? [{ legacy: Math.round((ar.lineHeight / 1.32) * 1000) / 1000 }]
      : []),
    // a style's lineHeight: n in both languages
    ...(en.lineHeight === ar.lineHeight ? [{ fixed: en.lineHeight }] : []),
  ]
  const leading = candidates.find((l) => {
    const p = { size, ...face, leading: l }
    return (
      textTypography(ds, "en", p).lineHeight === en.lineHeight &&
      textTypography(ds, "ar", p).lineHeight === ar.lineHeight
    )
  })
  if (leading === undefined)
    throw new Unconvertible(
      "leading-not-expressible",
      `line height ${en.lineHeight} (en) / ${ar.lineHeight} (ar) at size ${size}: no step, legacy, px(), { legacy } or { fixed } gives both`
    )
  return { size, ...face, leading }
}

const colorToken = (ds, value) =>
  Object.keys(ds.color.text).find((k) => ds.color.text[k] === value) || null

/** A prop's value per combination, as one expression over the conditions. */
const synthesize = (values, atomIds, table, print, refs = []) => {
  const keyOf = (v) => JSON.stringify(v)
  const distinct = [...new Set(values.map((x) => keyOf(x.value)))]
  if (distinct.length === 1) return { constant: values[0].value }
  const deps = atomIds.filter((id) =>
    values.some((x) => {
      const flipped = values.find(
        (y) =>
          y.env.get(id) !== x.env.get(id) &&
          atomIds.every((o) => o === id || y.env.get(o) === x.env.get(o))
      )
      return flipped && keyOf(flipped.value) !== keyOf(x.value)
    })
  )
  if (deps.length > 2)
    throw new Unconvertible(
      "too-many-conditions",
      `the text's type depends on ${deps.length} conditions`
    )
  const valueAt = (env) =>
    values.find((x) => deps.every((id) => x.env.get(id) === env.get(id))).value
  const build = (order, used) => {
    const at = (i, env) => {
      if (i === order.length) return print(valueAt(env))
      const id = order[i]
      const t = at(i + 1, new Map([...env, [id, true]]))
      const f = at(i + 1, new Map([...env, [id, false]]))
      if (t === f) return t
      const c = table.atomCond(id, true)
      used.push(id)
      return `${c.src} ? ${t} : ${f}`
    }
    return at(0, new Map())
  }
  // Two conditions: whichever order reads shorter (`a ? 9 : b ? 10 : 11`
  // rather than `b ? (a ? 9 : 10) : (a ? 9 : 11)`).
  const orders = deps.length === 2 ? [deps, [deps[1], deps[0]]] : [deps]
  const tries = orders.map((order) => {
    const used = []
    return { expr: build(order, used), used }
  })
  const best = tries.reduce((x, y) => (y.expr.length < x.expr.length ? y : x))
  refs.push(...best.used)
  return { expr: best.expr }
}

// What a text draws with the style in DmText's place: classes, style, font.
const layered = (r, style) => ({
  ...r.layers.nativewind,
  ...style,
  ...r.layers.font,
})

/** The style expression for what Text's style keeps of the element's own. */
const restExpr = (rest, { registry, hint }) => {
  if (rest.kind === "raw") return { k: "raw", src: rest.src, value: rest.value }
  if (rest.kind === "static")
    return staticExpr(rest.value, { registry, hint, provenance: {} })
  return null
}

const concatStyle = (...exprs) => {
  const items = exprs
    .filter(Boolean)
    .flatMap((x) => (x.k === "arr" ? x.items : [x]))
  if (items.length === 0) return null
  return items.length === 1 ? items[0] : { k: "arr", items }
}

const printKeyValue = (key, value) =>
  `${key}: ${value && typeof value === "object" && "written" in value ? value.written : JSON.stringify(value)}`

/**
 * The Text props and style for a DmText element, or Unconvertible.
 * `ir` is the className IR (null for no className). `styleLayer`, when the
 * element's style has typography, is readTextStyle()'s reading of it.
 */
const convertDmText = ({
  ds,
  ir,
  table,
  registry,
  hint,
  existingStyleOk,
  styleLayer = null,
}) => {
  if (!existingStyleOk.ok)
    throw new Unconvertible(existingStyleOk.code, existingStyleOk.detail)
  const atomIds = ir ? [...atomsOf(ir)] : []
  let envs
  try {
    envs = assignments(atomIds)
  } catch (error) {
    throw new Unconvertible("too-many-conditions", error.message)
  }
  const dropped = new Map()
  const combos = envs.map((env) => {
    const str = ir ? evaluate(ir, env) : undefined
    let en
    let ar
    try {
      en = resolveDmText(str, { lang: "en" })
      ar = resolveDmText(str, { lang: "ar" })
    } catch (error) {
      if (error instanceof NwResolveError)
        throw new Unconvertible(
          "unresolvable-class",
          error.problems.map((p) => `${p.class}: ${p.reason}`).join("; ")
        )
      throw error
    }
    for (const d of en.dropped) dropped.set(d.class, d)
    // A weight with no face in either language (customerapp's
    // font-custom800): DmText draws the system face, as Text family="system"
    // does, and the class is listed with the drops, since it renders nothing.
    for (const c of en.consumed) {
      const arFace = ar.consumed.find((x) => x.class === c.class)
      if (
        /no face for this weight/.test(c.by) &&
        arFace &&
        /no face for this weight/.test(arFace.by)
      )
        dropped.set(c.class, {
          class: c.class,
          reason: `no face for weight ${c.class.slice(-3)} in English or Arabic: DmText draws the system face`,
        })
    }
    if ("fontWeight" in en.style)
      throw new Unconvertible(
        "fontWeight-class",
        `${en.provenance.fontWeight} sets fontWeight, which Text leaves to the face`
      )
    const drawn = styleLayer
      ? { en: layered(en, styleLayer.en), ar: layered(ar, styleLayer.ar) }
      : { en: en.style, ar: ar.style }
    if ("fontWeight" in drawn.en || "fontWeight" in drawn.ar)
      throw new Unconvertible(
        "fontWeight-in-style",
        `fontWeight ${JSON.stringify(drawn.en.fontWeight ?? drawn.ar.fontWeight)} in the element's style, which Text leaves to the face`
      )
    const typo = mapTypography(ds, drawn.en, drawn.ar, namedWeight(str))
    if (
      en.style.color !== ar.style.color ||
      en.style.textAlign !== ar.style.textAlign
    )
      throw new Unconvertible(
        "not-expressible",
        "colour or alignment differs by language"
      )
    return {
      env,
      str,
      en,
      ar,
      drawn,
      typo,
      color: colorToken(ds, en.style.color),
      align: ALIGN_OF[en.style.textAlign] || null,
    }
  })

  // A typography key of the style that the font layer draws over, in a
  // language: it renders nothing there today.
  const deadStyle = []
  if (styleLayer)
    for (const key of TYPO_KEYS) {
      const langs = ["en", "ar"].filter(
        (lang) =>
          key in styleLayer[lang] &&
          combos.some(
            (c) => !deepEqual(c.drawn[lang][key], styleLayer[lang][key])
          )
      )
      if (langs.length)
        deadStyle.push({
          class: `style ${printKeyValue(key, styleLayer[langs[0]][key])}`,
          reason: `DmText's font layer draws over it (${langs.join(" and ")}), so it renders nothing`,
        })
    }

  // A size that changes with a condition types `leading` as the steps all
  // of its sizes share (LeadingFor<20 | 30> is only "tight"); a step outside
  // them is written as its value, px(n), which draws the same in both
  // languages (a step and px() are both x1.32 in Arabic).
  const sizeSet = [...new Set(combos.map((c) => c.typo.size))]
  if (sizeSet.length > 1)
    for (const c of combos) {
      const l = c.typo.leading
      if (
        typeof l === "string" &&
        l !== "legacy" &&
        !sizeSet.every((sz) => onScale(ds, sz) && l in ds.LEADING[sz])
      )
        c.typo = { ...c.typo, leading: { px: ds.LEADING[c.typo.size][l] } }
    }

  const colorAsProp = combos.every((c) => c.color)
  const alignAsProp = combos.every((c) => c.align)
  const exclude = new Set(TYPO_KEYS)
  if (colorAsProp) exclude.add("color")
  if (alignAsProp) exclude.add("textAlign")

  const style = ir
    ? styleFromIR(ir, { table, registry, hint, exclude, fontIsDead: false })
    : { expr: null, dropped: [] }
  // The element's own style follows the class styles, as in DmText.
  const styleExpr = styleLayer
    ? concatStyle(style.expr, restExpr(styleLayer.rest, { registry, hint }))
    : style.expr

  // The whole thing, per combination and language, against DmText.
  for (const c of combos) {
    const props = {
      ...c.typo,
      color: colorAsProp ? c.color : undefined,
      align: alignAsProp ? c.align : undefined,
    }
    const extra = evalStyle(styleExpr, c.env, registry.a)
    for (const lang of ["en", "ar"]) {
      const got = emulateText(ds, lang, props, extra)
      if (!deepEqual(got, c.drawn[lang]))
        throw new Unconvertible(
          "not-expressible",
          `Text would draw ${JSON.stringify(got)} where DmText draws ${JSON.stringify(c.drawn[lang])} (${lang}, "${c.str || ""}")`
        )
    }
  }

  const per = (fn) => combos.map((c) => ({ env: c.env, value: fn(c) }))
  const attrs = []
  const refs = []
  const uses = { px: false }
  const printLeading = (l) => {
    if (l && typeof l === "object") {
      uses.px = true
      if ("fixed" in l) return `{ fixed: px(${l.fixed}) }`
      if ("legacy" in l) return `{ legacy: px(${l.legacy}) }`
      return `px(${l.px})`
    }
    return JSON.stringify(l)
  }
  const add = (name, values, isDefault, print, braces) => {
    if (values.every((v) => isDefault(v.value, v))) return
    const s = synthesize(values, atomIds, table, print, refs)
    if ("constant" in s) {
      const printed = print(s.constant)
      attrs.push(
        braces || !/^"/.test(printed)
          ? `${name}={${printed}}`
          : `${name}=${printed}`
      )
    } else attrs.push(`${name}={${s.expr}}`)
  }
  const sizes = per((c) => c.typo.size)
  add(
    "size",
    sizes,
    () => false,
    (v) => {
      if (onScale(ds, v)) return String(v)
      uses.px = true
      return `px(${v})`
    },
    true
  )
  add(
    "weight",
    per((c) => c.typo.weight),
    (v) => v === "regular",
    JSON.stringify
  )
  add(
    "leading",
    combos.map((c) => ({
      env: c.env,
      value: c.typo.leading,
      size: c.typo.size,
    })),
    (v, x) => v === defaultStep(ds, x.size),
    printLeading
  )
  if (colorAsProp)
    add(
      "color",
      per((c) => c.color),
      (v) => v === "primary",
      JSON.stringify
    )
  if (alignAsProp)
    add(
      "align",
      per((c) => c.align),
      (v) => v === "start",
      JSON.stringify
    )
  add(
    "family",
    per((c) => c.typo.family),
    (v) => v === "auto",
    JSON.stringify
  )

  return {
    attrs,
    styleExpr,
    // The element's style attribute is rewritten whole (or removed), not
    // kept after the class styles.
    replacesStyle: !!styleLayer,
    deadStyle,
    refs,
    uses,
    dropped: [
      ...dropped.values(),
      ...style.dropped.filter((d) => !dropped.has(d.class)),
    ],
    combos: combos.length,
    counts: {
      // the ratchet's legacy: "legacy", { legacy: px(n) }, { fixed: px(n) }
      legacy: combos.some(
        (c) =>
          c.typo.leading === "legacy" ||
          (c.typo.leading &&
            typeof c.typo.leading === "object" &&
            !("px" in c.typo.leading))
      ),
      px: combos.some((c) => typeof c.typo.leading === "object"),
      system: combos.some((c) => c.typo.family === "system"),
      styleTypography: !!styleLayer,
    },
  }
}

module.exports = {
  ALIGN,
  TEXT_PROPS,
  TYPO_KEYS,
  convertDmText,
  emulateText,
  mapTypography,
  synthesize,
}
