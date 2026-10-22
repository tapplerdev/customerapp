/**
 * Jest only. What a twin test's synthetic call site is, and how one runs.
 *
 * A twin case is one prop set a component's harvest froze, written as a call
 * site of its own (`export default <Tag ... />`) and converted by the codemod
 * the way `yarn ds:codemod` converts a real site. The converted site is
 * frozen in `__fixtures__/<Name>.twins.json` (freezeTwins, W3.1 only), and
 * from then on a twin test draws the frozen code (frozenTwinCases): no
 * codemod, no class strings, no NativeWind.
 *
 * A site imports the component, React, the design system and its own styles
 * file (when the codemod wrote one) as the app's babel resolves them, and
 * every value the codemod doesn't read (a handler, an opaque value, a
 * stand-in element) from a module of its own, `__twin_site__`, so those
 * reach the component exactly as buildProps builds them.
 */
import fs from "fs"
import path from "path"
import type React from "react"

import type { PropSet, SpecValue } from "./harvest"
import { buildValue, type BuildOptions } from "./props"

export const ROOT = path.resolve(__dirname, "../../..")
const SRC = path.join(ROOT, "src")
const SHARED = path.resolve(ROOT, "..", "tappler-shared")

/** The module a site's other values come from. */
export const SITE_MODULE = "__twin_site__"

/** Where the codemod is told the site lives (its styles go to `./styles`). */
export const SITE_FILE = path.join(
  SRC,
  "components",
  "__fixtures__",
  "__twin__.tsx"
)

export type TwinSpec = {
  /** The module a call site imports the component from (`components/X`). */
  source: string
  /** The tag a call site writes (and the local name it imports). */
  tag: string
  /** `default` (the default) or the named export. */
  exportName?: string
  /** Props a site writes that the component never gets (React's `key`). */
  omit?: string[]
  /** How the values the codemod doesn't read are built (buildProps'). */
  build?: BuildOptions
  /**
   * The freeze's hand edits (W3.1): a class the codemod leaves, converted
   * the way the real sites were converted by hand. Each names what the codemod
   * left (its attribute and reason) and returns the case's props as the
   * converted site writes them; the codemod then converts the rest.
   */
  edits?: HandEdit[]
  /**
   * Cases the freeze leaves out, by id, each with its reason and, for a real
   * site, the screen parity file that covers it.
   */
  drops?: Record<string, Drop>
}

export type HandEdit = {
  attr: string
  reason: string
  edit: (props: PropSet) => PropSet
}

export type Drop = {
  /** Why the case can't be a frozen twin. */
  reason: string
  /** The screen parity file that draws its site, for a real site. */
  coveredBy?: string
  /**
   * The class fixture's cases it stood for, when the test draws it under
   * other names (variants); default the case id alone.
   */
  names?: string[]
}

/** What the codemod left at a site: an attribute it couldn't convert, and why. */
export type Left = { attr: string; reason: string; tag?: string }

/** One case as the freeze wrote it. */
export type FrozenCase = {
  /** The harvested sites behind the case (`(hand)` for a set made by hand). */
  sites: string[]
  /** The prop set the synthetic site was written from (after any hand edit). */
  props: PropSet
  /** The site as the codemod rewrote it. */
  code: string
  /** The styles file the codemod wrote beside it, if any. */
  styles: string | null
  /** What the site imports from `__twin_site__`, in order. */
  values: SpecValue[]
  /** What the codemod left at the case's site, before any hand edit. */
  left: Left[]
  /** The hand edits applied (each the reason of what it converts). */
  edits?: string[]
}

export type TwinsFile = {
  /** What the cases are of (the component, as its tests name it). */
  component: string
  /** The commit of scripts/ds-codemod that converted every case. */
  codemod: string
  cases: Record<string, FrozenCase>
  drops: Record<string, Drop & { sites: string[] }>
}

export type TwinCase = {
  id: string
  /** The harvested sites behind the case. */
  sites: string[]
  /** The prop set the site was written from. */
  props: PropSet
  /** The synthetic site as the codemod rewrote it. */
  code: string
  /** What the codemod left at the case's own site, and why (before any hand edit). */
  left: Left[]
  /** The hand edits the freeze applied. */
  edits: string[]
  /** What the converted site renders. */
  element: React.ReactElement
}

/** `<dir>/__fixtures__/<Name>.twins.json`, beside a component's tests. */
export const twinsFileFor = (testsDir: string, name: string) =>
  path.join(path.dirname(testsDir), "__fixtures__", `${name}.twins.json`)

/**
 * Whether this run freezes the twins (writes the `.twins.json` files)
 * instead of comparing them: DS_FREEZE_TWINS, read through a variable key so
 * react-native-dotenv can't inline it at transform time.
 */
export const freezing = () => {
  const key = "DS_FREEZE_TWINS"
  return (
    (globalThis.process.env as Record<string, string | undefined>)[key] === "1"
  )
}

type Module = { exports: Record<string, unknown> }

const compile = (code: string, file: string): string => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const babel = require("@babel/core") as typeof import("@babel/core")
  const out = babel.transformSync(code, {
    filename: file,
    babelrc: false,
    configFile: false,
    sourceType: "module",
    plugins: [
      [require.resolve("@babel/plugin-transform-typescript"), { isTSX: true }],
      [
        require.resolve("@babel/plugin-transform-react-jsx"),
        { runtime: "automatic" },
      ],
      require.resolve("@babel/plugin-transform-modules-commonjs"),
    ],
  })
  if (!out?.code) throw new Error(`twins: ${file} didn't compile`)
  return out.code
}

const run = (
  code: string,
  file: string,
  load: (request: string) => unknown
): Record<string, unknown> => {
  const mod: Module = { exports: {} }
  // eslint-disable-next-line no-new-func
  new Function("exports", "require", "module", compile(code, file))(
    mod.exports,
    load,
    mod
  )
  return mod.exports
}

const EXTENSIONS = [
  ".tsx",
  ".ts",
  ".js",
  "/index.tsx",
  "/index.ts",
  "/index.js",
]

// An import as the app's babel resolves it (module-resolver: `@tappler/shared`
// is the sibling checkout, anything else rooted in src first), through jest's
// own registry, so the site gets the very modules the test renders with.
const appRequire = (request: string): unknown => {
  if (request === "@tappler/shared" || request.startsWith("@tappler/shared/")) {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(path.join(SHARED, request.slice("@tappler/shared".length)))
  }
  const rooted = path.join(SRC, request)
  if (EXTENSIONS.some((ext) => fs.existsSync(rooted + ext))) {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(rooted)
  }
  // eslint-disable-next-line import/no-dynamic-require, global-require
  return require(request)
}

/**
 * What a site renders: its code run with its values (built now, so a value
 * that reads the test's state reads it as it is now) and its styles file.
 */
export const renderSite = (
  site: { code: string; styles: string | null; values: unknown[] },
  what: string
): React.ReactElement => {
  let styles: Record<string, unknown> | null = null
  const load = (request: string): unknown => {
    if (request === SITE_MODULE) {
      return { __esModule: true, default: { values: site.values } }
    }
    if (request === "./styles") {
      if (site.styles === null) {
        throw new Error(
          `twins: ${what} imports a styles file the codemod didn't write`
        )
      }
      styles =
        styles ??
        run(
          site.styles,
          path.join(path.dirname(SITE_FILE), "styles.ts"),
          appRequire
        )
      return styles
    }
    return appRequire(request)
  }
  return run(site.code, SITE_FILE, load).default as React.ReactElement
}

/** A frozen case's values, built with the test's build options. */
export const buildValues = (values: SpecValue[], build: BuildOptions = {}) =>
  values.map((value) => buildValue(value, build))

/** JSON with sorted keys, so two prop sets compare as values. */
export const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]])
        )
      : item
  )
