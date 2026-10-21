#!/usr/bin/env node
/**
 * yarn ds:resolve "<className>" ["<className>" ...] [--dmtext [--lang en|ar|both]] [--json]
 * yarn ds:resolve --table
 *
 * Prints the exact React Native style NativeWind 2.0.11 hands a component for a
 * className, with this app's tailwind.config.js. It is how the StyleSheet
 * migration writes its pass-1 styles, and the seed of the codemod, so it has
 * to be exact rather than plausible:
 *
 * - Per-class styles come from NativeWind's own extractStyles, configured the
 *   way nativewind/dist/babel/index.js configures it (the nativePlugin first,
 *   then validateConfig). Nothing is re-derived from Tailwind's CSS.
 * - They are composed the way nativewind/dist/style-sheet/runtime.js composes
 *   them at render: class-string order, later class wins per key (RN's flatten),
 *   and every transform class's entries gathered, in order, into ONE
 *   `transform` array appended last. So `rotate-[180deg] scale-y-[-1]` keeps
 *   both; a plain last-wins merge would keep only the scale (verify.md W3).
 * - The keys are NativeWind's physical keys: `px-[20]` is paddingLeft +
 *   paddingRight, never paddingHorizontal. Yoga prefers a specific edge over
 *   an axis shorthand whatever the array order, so `pl-[10] px-[20]` is 20/20
 *   today and would be 10/20 with paddingHorizontal.
 * - `flex-1` is NativeWind's {flexGrow: 1, flexShrink: 1, flexBasis: "0%"},
 *   which is NOT React Native's `flex: 1` (shrink 0, basis 0 points). The
 *   percent basis goes undefined in a parent with no main-axis size, such as
 *   scroll content, so the two lay out differently.
 *
 * Reported, not fatal:
 * - DROPPED: classes NativeWind produces nothing for (unknown ones like
 *   `flex-between` or `font-400`, a unitless `leading-[20]`, `rtl:`/`ltr:`
 *   variants, CSS NativeWind can't map such as `inset-0`), each with why.
 * - CONSUMED: `font-customNNN`. NativeWind ignores it; DmText and ActionBtn
 *   read it through tappler-shared's takeFontStyles. Listing it as dropped
 *   would bury the real drops (it is on ~1,400 elements).
 *
 * Fatal (exit 1, or a thrown NwResolveError): anything a static style can't
 * say. A masked class (ios:, android:, dark:, hover:...), a vw/vh unit, a
 * class that styles its children (gap-*, space-*, divide-*), a media rule
 * (shadow-* is per platform), or a value computed at runtime. Emitting an
 * unconditional style for those would be wrong on some device, so the site
 * has to be converted by hand.
 *
 * --dmtext resolves a DmText call site the way DmText renders it
 * (tappler-shared DmText.tsx): NativeWind sees the guard
 * "text-14 text-black text-left " + className with its FIRST `custom\d{3}`
 * stripped, the caller's `style` comes next, and takeFontStyles(className ||
 * "font-custom400", language) goes last. That last layer is the font family
 * per language, and in Arabic a 1-2 digit `leading-[Npx]` times 1.32. The
 * real takeFontStyles is loaded from ../tappler-shared/src/helpers/helpers.ts,
 * and the Latin faces are read from the setLatinFontWeights call in index.js,
 * so neither is restated here. customerapp's index.js registers nothing, so
 * its Latin faces are shared's default, Montserrat (proapp registers
 * Poppins). --table prints the line height a bare `text-N` gets through that
 * guard, which is the token table's `legacy` column.
 *
 * A NOTE also says when the style names a fontFamily the app doesn't ship
 * (ios/<app>/Info.plist UIAppFonts): customerapp's tailwind.config.js maps
 * font-sans400/500 to TheSans-Regular and font-sans600 to TheSans-SemiBold,
 * neither of which it ships, so the device draws the system face there.
 *
 * As a module: resolve(className), resolveDmText(className, { lang }),
 * resolveMany(classNames), legacyTable(), latinFaces(), shippedFaces(),
 * NwResolveError.
 */
const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")
const TAILWIND_CONFIG = path.join(ROOT, "tailwind.config.js")
const SHARED_HELPERS = path.join(
  ROOT,
  "..",
  "tappler-shared",
  "src",
  "helpers",
  "helpers.ts"
)
const ENTRY_FILE = path.join(ROOT, "index.js")
const IOS_DIR = path.join(ROOT, "ios")

// DmText.tsx: `"text-14 text-black text-left " + userClassName`.
const DMTEXT_GUARD = ["text-14", "text-black", "text-left"]
const FONT_CLASS = /^font-custom\d{3}$/

class NwResolveError extends Error {
  constructor(className, problems) {
    super(
      `nw-resolve: "${className}" can't be written as one static style:\n` +
        problems.map((p) => `  - ${p.class}: ${p.reason}`).join("\n")
    )
    this.name = "NwResolveError"
    this.className = className
    this.problems = problems
  }
}

// ---------------------------------------------------------------------------
// NativeWind, configured like its Babel plugin

let tailwindConfig
const getTailwindConfig = () => {
  if (tailwindConfig) return tailwindConfig
  const resolveConfig = require("tailwindcss/resolveConfig")
  const { validateConfig } = require("tailwindcss/lib/util/validateConfig")
  const { nativePlugin } = require("nativewind/dist/tailwind/native")
  // eslint-disable-next-line import/no-dynamic-require
  const userConfig = require(TAILWIND_CONFIG)
  // babel.config.js lists 'nativewind/babel' with no options, so the plugin
  // builds nativePlugin({}) (nativewind/dist/babel/index.js:30-41).
  tailwindConfig = validateConfig(
    resolveConfig({
      ...userConfig,
      plugins: [nativePlugin({}), ...(userConfig.plugins || [])],
    })
  )
  return tailwindConfig
}

const MASK_NAMES = (() => {
  const s = require("nativewind/dist/utils/selector")
  return [
    [s.DARK_MODE, "dark"],
    [s.IOS, "ios"],
    [s.ANDROID, "android"],
    [s.WEB, "web"],
    [s.WINDOWS, "windows"],
    [s.OSX, "macos"],
    [s.RTL, "rtl"],
    [s.ACTIVE, "active"],
    [s.HOVER, "hover"],
    [s.FOCUS, "focus"],
    [s.GROUP, "group"],
    [s.GROUP_ISO, "group-isolate"],
    [s.PARENT, "parent"],
    [s.GROUP_ACTIVE, "group-active"],
    [s.GROUP_HOVER, "group-hover"],
    [s.GROUP_FOCUS, "group-focus"],
    [s.ISO_GROUP_ACTIVE, "group-isolate-active"],
    [s.ISO_GROUP_HOVER, "group-isolate-hover"],
    [s.ISO_GROUP_FOCUS, "group-isolate-focus"],
    [s.PARENT_ACTIVE, "parent-active"],
    [s.PARENT_HOVER, "parent-hover"],
    [s.PARENT_FOCUS, "parent-focus"],
  ]
})()
const maskNames = (mask) =>
  MASK_NAMES.filter(([bit]) => mask & bit).map(([, name]) => name)

const hasRuntimeFunction = (value) => {
  if (typeof value === "string") return value.startsWith("__{")
  if (Array.isArray(value)) return value.some(hasRuntimeFunction)
  if (value && typeof value === "object")
    return Object.values(value).some(hasRuntimeFunction)
  return false
}

// Tailwind's CSS for some classes, keyed the way NativeWind keys its output
// (normalizeCssSelector). Only used to explain a drop, never for a value.
const tailwindDeclarations = (classes) => {
  const postcss = require("postcss")
  const tailwind = require("tailwindcss")
  const { normalizeCssSelector } = require("nativewind/dist/utils/selector")
  const root = postcss([
    tailwind({
      ...getTailwindConfig(),
      content: [{ raw: classes.join(" "), extension: "tsx" }],
      // What the Babel plugin passes, which keeps Tailwind from warning
      // "No utility classes were detected" when none of these are classes.
      safelist: ["babel-empty"],
    }),
  ]).process("@tailwind components;@tailwind utilities;", {
    from: undefined,
  }).root
  const byClass = new Map()
  root.walkRules((rule) => {
    const decls = []
    rule.walkDecls((d) => {
      if (!d.prop.startsWith("--tw-")) decls.push(`${d.prop}: ${d.value}`)
    })
    for (const selector of rule.selectors) {
      const cls = normalizeCssSelector(selector)
      byClass.set(cls, [...(byClass.get(cls) || []), ...decls])
    }
  })
  return byClass
}

const dropReason = (cls, record, cssDecls) => {
  if (/^leading-\[\d+(\.\d+)?\]$/.test(cls))
    return "unitless arbitrary line height; NativeWind 2 emits nothing for it (leading-[Npx] works)"
  if (record.mangledKey) {
    const variant = cls.split(":")[0]
    return `${variant}: variant; NativeWind 2.0.11 compiles it under the key "${record.mangledKey}", which no className can match, so it never applies`
  }
  if (record.style && Object.keys(record.style).length === 0)
    return "NativeWind emits an empty style for it"
  if (cssDecls && cssDecls.length) {
    // rounded-[8] -> "border-radius: 8", text-[13] -> "color: 13": a bare
    // number NativeWind won't take for that property; the px form maps.
    const bare = cls.match(/-\[(-?\d+(?:\.\d+)?)\]$/)
    const unitless =
      bare && cssDecls.every((d) => d.endsWith(`: ${bare[1]}`))
        ? ` (a bare number; the px form, ${cls.replace(/\]$/, "px]")}, is what maps)`
        : ""
    return `Tailwind generates "${cssDecls.join(
      "; "
    )}", which NativeWind 2.0.11 has no React Native style for${unitless}`
  }
  return "unknown class: neither Tailwind's defaults nor tailwind.config.js define it"
}

// NativeWind's tables are plain objects; only their own keys are classes.
const own = (table, key) =>
  table && Object.prototype.hasOwnProperty.call(table, key)
    ? table[key]
    : undefined

// Class names that are also keys of Object.prototype. The runtime looks
// classes up in plain objects (this.topics[className] and so on), so one
// of these finds the prototype's function and the render throws:
// "TypeError: this.topics[className] is not iterable" in prepare().
const PROTOTYPE_NAMES = new Set(Object.getOwnPropertyNames(Object.prototype))

// One class's NativeWind output, everything the runtime would look at.
const recordFor = (cls, raw) => {
  const styles = raw.styles || {}
  const atRuleList = own(raw.atRules, cls)
  const childClassNames = own(raw.childClasses, cls)
  // rtl:/ltr: come out keyed ".rtl:ml-[3])", a key no className can produce.
  const mangledKey = Object.keys(styles).find((key) => key === `.${cls})`)
  return {
    class: cls,
    style: own(styles, cls),
    mask: own(raw.masks, cls) || 0,
    units: own(raw.units, cls),
    topics: own(raw.topics, cls),
    transform: !!own(raw.transforms, cls),
    atRules: atRuleList
      ? atRuleList.map((rules, i) => ({
          rules,
          style: own(styles, `${cls}@${i}`),
        }))
      : undefined,
    childClasses: childClassNames
      ? childClassNames.map((name) => ({
          name,
          styles: Object.keys(styles)
            .filter((key) => key.startsWith(`${name}@`))
            .map((key) => styles[key]),
        }))
      : undefined,
    mangledKey,
    partialDrops: [],
  }
}

const cache = new Map()

// Runs NativeWind once over every class not seen yet. Per-class output does
// not depend on the other classes in the run (the Babel plugin itself
// extracts a whole file's classes in one go), so one run can serve many
// strings.
const prefetch = (classes) => {
  const missing = [...new Set(classes)].filter((c) => c && !cache.has(c))
  if (missing.length === 0) return
  const { extractStyles } = require("nativewind/dist/postcss/extract-styles")
  const out = extractStyles({
    ...getTailwindConfig(),
    content: [{ raw: missing.join(" "), extension: "tsx" }],
    // What the Babel plugin passes when the config has no safelist.
    safelist: ["babel-empty"],
  })
  const records = missing.map((cls) => recordFor(cls, out.raw))
  const unexplained = records.filter(
    (r) => r.style === undefined || Object.keys(r.style).length === 0
  )
  const errors = out.errors || []
  if (unexplained.length || errors.length) {
    const css = tailwindDeclarations(missing)
    for (const r of records) {
      const decls = css.get(r.class) || []
      if (r.style === undefined || Object.keys(r.style).length === 0)
        r.dropReason = dropReason(r.class, r, decls)
      for (const e of errors) {
        const decl =
          e.declaration && `${e.declaration.prop}: ${e.declaration.value}`
        if (
          decl &&
          decls.includes(decl) &&
          r.style &&
          Object.keys(r.style).length
        )
          r.partialDrops.push(`${decl} (${e.error})`)
      }
    }
  }
  for (const r of records) cache.set(r.class, r)
}

const problemsOf = (r) => {
  const problems = []
  if (PROTOTYPE_NAMES.has(r.class))
    problems.push(
      "a name Object.prototype already has; NativeWind's runtime looks classes up in plain objects, so this one makes the render throw (TypeError in StyleSheetRuntime.prepare)"
    )
  if (r.mask)
    problems.push(
      `masked (${maskNames(r.mask).join(", ")}): applies only in that state`
    )
  if (r.units)
    problems.push(
      `unit ${Object.entries(r.units)
        .map(([k, u]) => `${k} in ${u}`)
        .join(", ")}: computed from the window at runtime`
    )
  if (r.atRules)
    problems.push(
      `media rule (${r.atRules
        .map((a) =>
          a.rules.map(([rule, params]) => `@${rule} ${params}`).join(" and ")
        )
        .join(" | ")}): a different style per platform or window size`
    )
  if (r.childClasses)
    problems.push(
      `styles its children (${r.childClasses
        .map(
          (c) => `${c.name} ${JSON.stringify(Object.assign({}, ...c.styles))}`
        )
        .join(", ")}): convert by hand`
    )
  if (r.style && hasRuntimeFunction(r.style))
    problems.push(`value computed at runtime: ${JSON.stringify(r.style)}`)
  if (r.topics && !r.units && !r.atRules && !r.mask)
    problems.push(`depends on ${r.topics.join(", ")} at runtime`)
  return problems
}

const tokensOf = (className) =>
  typeof className === "string" ? className.split(/\s+/).filter(Boolean) : []

// The faces the app ships: the font files ios/<app>/Info.plist lists under
// UIAppFonts, by file name (each file's name is its face's PostScript name
// in both apps). A family not in it isn't registered on the device, so iOS
// and Android draw the system face instead. null when there is no plist.
let shipped
const shippedFaces = () => {
  if (shipped !== undefined) return shipped
  shipped = null
  if (!fs.existsSync(IOS_DIR)) return shipped
  for (const entry of fs.readdirSync(IOS_DIR, { withFileTypes: true })) {
    const plist = path.join(IOS_DIR, entry.name, "Info.plist")
    if (!entry.isDirectory() || /Tests$/.test(entry.name)) continue
    if (!fs.existsSync(plist)) continue
    const m = fs
      .readFileSync(plist, "utf8")
      .match(/<key>UIAppFonts<\/key>\s*<array>([\s\S]*?)<\/array>/)
    if (!m) continue
    shipped = new Set(shipped || [])
    for (const [, file] of m[1].matchAll(/<string>([^<]+)<\/string>/g))
      shipped.add(file.trim().replace(/\.(ttf|otf)$/i, ""))
  }
  return shipped
}

const unshippedFaceNote = (style) => {
  const faces = shippedFaces()
  const family = style && style.fontFamily
  return faces && typeof family === "string" && !faces.has(family)
    ? `fontFamily ${family} isn't a face the app ships (Info.plist UIAppFonts), so the device draws the system face`
    : null
}

// runtime.js reEvaluate(): string order; a transform class contributes only
// its `transform` entries, gathered into one array appended last. `entries`
// are the tokens NativeWind receives, in order, each with a label saying
// where it came from (so a user's `text-left` isn't credited to the guard's).
const compose = (entries) => {
  const parts = []
  const transform = []
  const transformFrom = []
  for (const { cls, label } of entries) {
    const r = cache.get(cls)
    if (!r.style) continue
    if (r.transform) {
      transform.push(...(r.style.transform || []))
      transformFrom.push(label)
    } else parts.push([label, r.style])
  }
  const style = {}
  const provenance = {}
  for (const [label, s] of parts) {
    for (const key of Object.keys(s)) {
      style[key] = s[key]
      provenance[key] = label
    }
  }
  if (transform.length) {
    style.transform = transform
    provenance.transform = transformFrom.join(" ")
  }
  return { style, provenance }
}

// Shared by resolve() and resolveDmText(). An entry with `consumedAs` is a
// font class DmText/ActionBtn read themselves: reported, not dropped.
const resolveEntries = (input, entries) => {
  prefetch(entries.map((e) => e.cls))
  const problems = []
  const dropped = []
  const consumed = []
  const notes = []
  const classes = entries.map(({ cls, label, consumedAs }) => {
    const r = cache.get(cls)
    const found = problemsOf(r)
    for (const reason of found) problems.push({ class: label, reason })
    for (const p of r.partialDrops)
      notes.push(`${label}: NativeWind drops part of it: ${p}`)
    if (found.length) return { class: cls, label, status: "error" }
    if (r.style && Object.keys(r.style).length)
      return { class: cls, label, status: "ok", style: r.style }
    if (consumedAs) {
      consumed.push({ class: consumedAs, via: cls })
      return { class: cls, label, status: "consumed" }
    }
    const reason = r.dropReason || dropReason(cls, r)
    dropped.push({ class: label, reason })
    return { class: cls, label, status: "dropped", reason }
  })
  if (problems.length) throw new NwResolveError(input, problems)
  return { ...compose(entries), classes, dropped, consumed, notes }
}

/**
 * The style NativeWind gives an element for `className`. `font-customNNN` is
 * reported as consumed (by DmText/ActionBtn), not dropped.
 */
const resolve = (className) => {
  const entries = tokensOf(className).map((cls) => ({
    cls,
    label: cls,
    consumedAs: FONT_CLASS.test(cls) ? cls : undefined,
  }))
  const result = resolveEntries(className, entries)
  for (const c of result.consumed)
    c.by = "DmText/ActionBtn (takeFontStyles); NativeWind ignores it"
  const unshipped = unshippedFaceNote(result.style)
  return {
    input: className,
    mode: "plain",
    nativewindInput: className,
    ...result,
    notes: unshipped ? [...result.notes, unshipped] : result.notes,
  }
}

/** One NativeWind run for many strings, then resolve() each. */
const resolveMany = (classNames) => {
  prefetch(classNames.flatMap(tokensOf))
  return classNames.map((cls) => {
    try {
      return resolve(cls)
    } catch (error) {
      if (error instanceof NwResolveError) return { input: cls, error }
      throw error
    }
  })
}

// ---------------------------------------------------------------------------
// DmText's font layer: tappler-shared's own takeFontStyles

const readLatinRegistry = () => {
  if (!fs.existsSync(ENTRY_FILE)) return { weights: null, source: null }
  const parser = require("@babel/parser")
  const ast = parser.parse(fs.readFileSync(ENTRY_FILE, "utf8"), {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  })
  for (const stmt of ast.program.body) {
    const call = stmt.type === "ExpressionStatement" && stmt.expression
    if (
      !call ||
      call.type !== "CallExpression" ||
      call.callee.type !== "Identifier" ||
      call.callee.name !== "setLatinFontWeights"
    )
      continue
    const [arg] = call.arguments
    if (!arg || arg.type !== "ObjectExpression")
      throw new Error(
        `nw-resolve: index.js:${call.loc.start.line} calls setLatinFontWeights with something other than an object literal; read it by hand`
      )
    const weights = {}
    for (const prop of arg.properties) {
      const key =
        prop.key &&
        (prop.key.type === "Identifier" ? prop.key.name : prop.key.value)
      if (prop.type !== "ObjectProperty" || prop.value.type !== "StringLiteral")
        throw new Error(
          `nw-resolve: index.js:${prop.loc.start.line}: a Latin face that isn't a string literal; read it by hand`
        )
      weights[String(key)] = prop.value.value
    }
    return { weights, source: `index.js:${call.loc.start.line}` }
  }
  return { weights: null, source: null }
}

// Babel's targets lookup loads baseline-browser-mapping, which warns on load
// that its data is old. Nothing here compiles for a browser.
const quietly = (fn) => {
  const { warn } = console
  console.warn = (...args) => {
    if (!String(args[0]).startsWith("[baseline-browser-mapping]")) warn(...args)
  }
  try {
    return fn()
  } finally {
    console.warn = warn
  }
}

// helpers.ts reads Dimensions at import time; nothing font-related needs more.
const REACT_NATIVE_STUB = {
  Dimensions: {
    get: () => ({ width: 402, height: 874, scale: 3, fontScale: 1 }),
  },
  Platform: { OS: "ios", select: (o) => ("ios" in o ? o.ios : o.default) },
}

let fontHelpers
const getFontHelpers = () => {
  if (fontHelpers) return fontHelpers
  if (!fs.existsSync(SHARED_HELPERS))
    throw new Error(
      `nw-resolve: --dmtext needs tappler-shared beside the app (${SHARED_HELPERS} not found)`
    )
  const babel = require("@babel/core")
  const { code } = quietly(() =>
    babel.transformSync(fs.readFileSync(SHARED_HELPERS, "utf8"), {
      filename: SHARED_HELPERS,
      babelrc: false,
      configFile: false,
      sourceType: "module",
      plugins: [
        require.resolve("@babel/plugin-transform-typescript"),
        require.resolve("@babel/plugin-transform-modules-commonjs"),
      ],
    })
  )
  const mod = { exports: {} }
  const localRequire = (name) => {
    if (name === "react-native") return REACT_NATIVE_STUB
    if (name.startsWith("."))
      throw new Error(
        `nw-resolve: helpers.ts now imports "${name}"; teach getFontHelpers() to load it`
      )
    // eslint-disable-next-line import/no-dynamic-require
    return require(require.resolve(name, { paths: [ROOT] }))
  }
  // A CommonJS wrapper in this realm (not vm), so the objects it returns are
  // ordinary objects to jest's equality checks.
  // eslint-disable-next-line no-new-func
  new Function("exports", "require", "module", "__filename", "__dirname", code)(
    mod.exports,
    localRequire,
    mod,
    SHARED_HELPERS,
    path.dirname(SHARED_HELPERS)
  )
  const {
    takeFontStyles,
    takeFontFamily,
    setLatinFontWeights,
    getLatinFontWeights,
  } = mod.exports
  if (
    typeof takeFontStyles !== "function" ||
    typeof takeFontFamily !== "function" ||
    typeof getLatinFontWeights !== "function"
  )
    throw new Error(
      "nw-resolve: helpers.ts no longer exports takeFontStyles/takeFontFamily/getLatinFontWeights"
    )
  const registry = readLatinRegistry()
  // customerapp's index.js registers nothing: shared's default stays.
  if (registry.weights) setLatinFontWeights(registry.weights)
  fontHelpers = { takeFontStyles, takeFontFamily, getLatinFontWeights, registry }
  return fontHelpers
}

/**
 * The Latin faces DmText draws for font-custom400..700: index.js's
 * setLatinFontWeights call if it has one, else tappler-shared's default
 * (Montserrat, which is what customerapp draws: it registers nothing).
 */
const latinFaces = () => ({ ...getFontHelpers().getLatinFontWeights() })

const LANGS = ["en", "ar"]

/**
 * A DmText call site: `<DmText className={className}>` in `lang`. `style` is
 * the host Text's flattened style without a caller `style` prop (that one
 * would sit between `layers.nativewind` and `layers.font`).
 */
const resolveDmText = (className, { lang = "en" } = {}) => {
  if (!LANGS.includes(lang))
    throw new Error(`nw-resolve: --lang must be en or ar, got "${lang}"`)
  // DmText.tsx:22-25. No `g` flag: only the first `custom\d{3}` goes, so
  // `font-custom500` reaches NativeWind as `font-` and any later
  // font-customNNN reaches it whole. Both are dropped there; the family comes
  // from takeFontStyles, which reads the unstripped className.
  const stripped = className ? className.replace(/custom(\d{3})/, "") : ""
  const nativewindInput = `${DMTEXT_GUARD.join(" ")} ${stripped}`
  // The strip happens inside one token; find it so its leftover (`font-`) can
  // be reported under the class the caller wrote.
  const strip = className ? /custom(\d{3})/.exec(className) : null
  let stripStart = -1
  if (strip) {
    stripStart = strip.index
    while (stripStart > 0 && !/\s/.test(className[stripStart - 1])) stripStart--
  }
  const entries = DMTEXT_GUARD.map((cls) => ({
    cls,
    label: `${cls} (DmText guard)`,
  }))
  const tokenPattern = /\S+/g
  let m
  while (className && (m = tokenPattern.exec(className))) {
    const original = m[0]
    if (m.index !== stripStart) {
      entries.push({
        cls: original,
        label: original,
        consumedAs: FONT_CLASS.test(original) ? original : undefined,
      })
      continue
    }
    const after = original.replace(/custom(\d{3})/, "")
    if (after)
      entries.push({
        cls: after,
        label: `${original} (DmText strips it to "${after}")`,
        consumedAs: FONT_CLASS.test(original) ? original : undefined,
      })
  }
  const seen = entries.map((e) => e.cls).join(" ")
  if (seen !== tokensOf(nativewindInput).join(" "))
    throw new Error(
      `nw-resolve: internal: token walk "${seen}" != "${nativewindInput}"`
    )
  const result = resolveEntries(className, entries)

  const { takeFontStyles, takeFontFamily, registry } = getFontHelpers()
  const fontInput = className || "font-custom400"
  const font = takeFontStyles(fontInput, lang)
  const fontFrom = {}
  if (font.fontFamily) {
    const winner = [...fontInput.matchAll(/font-custom(\d{3})/g)]
      .map((m) => m[0])
      .filter((t) => (takeFontFamily(t, lang) || {}).fontFamily)
      .pop()
    fontFrom.fontFamily = `${winner}${className ? "" : " (DmText default)"} (takeFontStyles, ${lang})`
  }
  if (font.lineHeight !== undefined) {
    const winner = [...fontInput.matchAll(/leading-\[(\d{1,2})px\]/g)].pop()
    fontFrom.lineHeight = `${winner ? winner[0] : "?"} x 1.32 (takeFontStyles, ar)`
  }
  for (const c of result.consumed) {
    const family = (takeFontFamily(c.class, lang) || {}).fontFamily
    c.by = family
      ? `DmText (takeFontStyles): ${family} in ${lang}`
      : `DmText (takeFontStyles): no face for this weight in ${lang}`
  }
  const notes = [...result.notes]
  // (With a family class such as font-sans700, NativeWind's family stands.)
  if (
    className &&
    !/font-custom\d{3}/.test(className) &&
    !result.style.fontFamily
  )
    notes.push(
      "no font-customNNN: DmText sets no fontFamily, so this text is in the system face"
    )
  if (!font.fontFamily && /font-custom\d{3}/.test(fontInput))
    notes.push(
      `no registered face for ${fontInput.match(/font-custom\d{3}/g).join(", ")} in ${lang}: system face`
    )

  const style = { ...result.style, ...font }
  const provenance = { ...result.provenance, ...fontFrom }
  const unshipped = unshippedFaceNote(style)
  if (unshipped) notes.push(unshipped)
  return {
    ...result,
    input: className,
    mode: "dmtext",
    lang,
    nativewindInput,
    style,
    provenance,
    layers: { nativewind: result.style, font },
    latinRegistry:
      registry.source ||
      "tappler-shared default (no setLatinFontWeights in index.js)",
    notes,
  }
}

/**
 * The line height a bare `text-N` gets on DmText today, per size in the
 * config: its own config line height, else the guard's text-14 (22). Arabic
 * is not scaled here (only an explicit leading-[Npx] is), so en == ar.
 */
const legacyTable = () => {
  const sizes = Object.keys(getTailwindConfig().theme.fontSize)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b))
  return sizes.map((size) => {
    const en = resolveDmText(`text-${size}`, { lang: "en" })
    const ar = resolveDmText(`text-${size}`, { lang: "ar" })
    return {
      size: Number(size),
      fontSize: en.style.fontSize,
      lineHeight: en.style.lineHeight,
      lineHeightAr: ar.style.lineHeight,
      from: en.provenance.lineHeight,
    }
  })
}

// ---------------------------------------------------------------------------
// CLI

const literal = (value) => {
  if (Array.isArray(value)) return `[${value.map(literal).join(", ")}]`
  if (value && typeof value === "object")
    return `{ ${Object.entries(value)
      .map(([k, v]) => `${k}: ${literal(v)}`)
      .join(", ")} }`
  return JSON.stringify(value)
}

const formatStyle = (style, provenance, indent = "") => {
  const keys = Object.keys(style)
  if (keys.length === 0) return `${indent}{}`
  const lines = keys.map(
    (key) =>
      `${indent}  ${key}: ${literal(style[key])}, // ${provenance[key] || ""}`
  )
  return [`${indent}{`, ...lines, `${indent}}`].join("\n")
}

const formatTail = (r) => {
  const out = []
  out.push(
    r.dropped.length
      ? `DROPPED:\n${r.dropped.map((d) => `  ${d.class}: ${d.reason}`).join("\n")}`
      : "DROPPED: none"
  )
  if (r.consumed.length)
    out.push(
      `CONSUMED:\n${r.consumed.map((c) => `  ${c.class}: ${c.by}`).join("\n")}`
    )
  if (r.notes.length)
    out.push(`NOTE:\n${r.notes.map((n) => `  ${n}`).join("\n")}`)
  return out.join("\n")
}

const USAGE = `usage: yarn ds:resolve "<className>" ["<className>" ...] [--dmtext [--lang en|ar|both]] [--json]
       yarn ds:resolve --table

  --dmtext   resolve as <DmText className="..."> renders it (guard prefix, font layer)
  --lang     with --dmtext: en, ar or both (default both)
  --json     machine-readable output
  --table    DmText's line height for a bare text-N, per configured size`

const main = (argv) => {
  const args = []
  const flags = { dmtext: false, json: false, table: false, lang: "both" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--dmtext") flags.dmtext = true
    else if (a === "--json") flags.json = true
    else if (a === "--table") flags.table = true
    else if (a === "--lang") flags.lang = argv[++i]
    else if (a.startsWith("--lang=")) flags.lang = a.slice(7)
    else if (a === "--help" || a === "-h") {
      console.log(USAGE)
      return 0
    } else if (a.startsWith("--")) {
      console.error(`nw-resolve: unknown option ${a}\n${USAGE}`)
      return 2
    } else args.push(a)
  }
  if (!["en", "ar", "both"].includes(flags.lang)) {
    console.error(`nw-resolve: --lang must be en, ar or both\n${USAGE}`)
    return 2
  }
  if (flags.table) {
    const rows = legacyTable()
    if (flags.json) console.log(JSON.stringify(rows, null, 2))
    else {
      console.log("DmText, bare text-N (guard: text-14 text-black text-left)")
      console.log("size  lineHeight  ar   from")
      for (const r of rows)
        console.log(
          `${String(r.size).padEnd(6)}${String(r.lineHeight).padEnd(12)}${String(r.lineHeightAr).padEnd(5)}${r.from}`
        )
    }
    return 0
  }
  if (args.length === 0) {
    console.error(USAGE)
    return 2
  }
  const langs = flags.lang === "both" ? LANGS : [flags.lang]
  const results = []
  let failed = 0
  if (!flags.dmtext) prefetch(args.flatMap(tokensOf))
  for (const className of args) {
    try {
      if (flags.dmtext)
        results.push({
          input: className,
          byLang: Object.fromEntries(
            langs.map((lang) => [lang, resolveDmText(className, { lang })])
          ),
        })
      else results.push(resolve(className))
    } catch (error) {
      if (!(error instanceof NwResolveError)) throw error
      failed++
      results.push({ input: className, error })
    }
  }
  if (flags.json) {
    console.log(
      JSON.stringify(
        results.map((r) =>
          r.error
            ? {
                input: r.input,
                error: r.error.message,
                problems: r.error.problems,
              }
            : r
        ),
        null,
        2
      )
    )
    return failed ? 1 : 0
  }
  const blocks = results.map((r) => {
    if (r.error) return r.error.message
    if (!flags.dmtext)
      return [
        `"${r.input}"`,
        formatStyle(r.style, r.provenance),
        formatTail(r),
      ].join("\n")
    // NativeWind's half is the same in both languages; the font layer isn't.
    const perLang = Object.values(r.byLang)
    const [first] = perLang
    const merged = {
      dropped: first.dropped,
      consumed: first.consumed.map((c, i) => ({
        class: c.class,
        by: perLang.map((x) => x.consumed[i].by).join("; "),
      })),
      notes: [...new Set(perLang.flatMap((x) => x.notes))],
    }
    return [
      `<DmText className="${r.input}">`,
      `NativeWind sees: "${first.nativewindInput}"`,
      `Latin faces: ${first.latinRegistry}`,
      ...Object.entries(r.byLang).map(
        ([lang, x]) =>
          `${lang}: ${formatStyle(x.style, x.provenance).trimStart()}`
      ),
      formatTail(merged),
    ].join("\n")
  })
  console.log(blocks.join("\n\n"))
  return failed ? 1 : 0
}

module.exports = {
  resolve,
  resolveMany,
  resolveDmText,
  legacyTable,
  readLatinRegistry,
  latinFaces,
  shippedFaces,
  prefetch,
  NwResolveError,
  DMTEXT_GUARD,
  paths: { ROOT, TAILWIND_CONFIG, SHARED_HELPERS, ENTRY_FILE, IOS_DIR },
  main,
}

if (require.main === module) process.exitCode = main(process.argv.slice(2))
