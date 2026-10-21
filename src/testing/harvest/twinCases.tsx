/**
 * Jest only. The twin half of a wave 2 component's parity proof.
 *
 * Every prop set a component's harvest froze (testing/harvest) is handed to
 * the codemod as a call site of its own and converted by it, in this process
 * (scripts/ds-codemod's convertSource, the function `yarn ds:codemod` runs on
 * each file). Once the component declares its twins, the site that passed
 * classes comes back passing the style twins, `*Type` twins and typed props
 * the codemod writes for it; built and drawn, it must give exactly the tree
 * its class-name case was captured with. A twin test therefore compares each
 * converted case with the class test's own fixture (expectParity's `file`):
 * one tree, asked for both ways, and the twins are the codemod's, not a copy
 * of its rules.
 *
 * An attribute the codemod still leaves (a class it can't express, a prop
 * the component doesn't take) stays a class at the site, as it would in the
 * app, and the case says which and why, for the test to pin. A twin test
 * imports the class test's classes file, so those classes compile.
 *
 * The synthetic site writes each class, text and other literal prop as a
 * literal, since the codemod reads literals (a text slot's own props may
 * depend on them, as they do at a real site), and every other value (an
 * element, a handler, an opaque value) through a module it can't see into,
 * so those reach the component exactly as buildProps builds them.
 *
 * W2a-0 wrote it as components/__fixtures__/twinCases, which re-exports
 * this until the wave 2a branches that import that path have merged.
 */
import fs from "fs"
import path from "path"
import type React from "react"

import type { CasesFile } from "./files"
import type { PropSet, SpecValue } from "./harvest"
import { buildValue, type BuildOptions } from "./props"

const ROOT = path.resolve(__dirname, "../../..")
const SRC = path.join(ROOT, "src")
const SHARED = path.resolve(ROOT, "..", "tappler-shared")
const SITE_MODULE = "__twin_site__"

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
}

type Site = {
  file: string
  tag: string
  line: number
  attr: string | null
  status: "converted" | "left"
  reason?: string
  detail?: string
  slot?: string
}

export type TwinCase = {
  id: string
  /** The harvested sites behind the case. */
  sites: string[]
  /** The synthetic site as the codemod rewrote it. */
  code: string
  /** The codemod's outcome for each class attribute of the site. */
  outcome: Site[]
  /** The class attributes it left, and why (empty when it converted all). */
  left: { attr: string; reason: string }[]
  /** What the converted site renders. */
  element: React.ReactElement
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
  if (!out?.code) throw new Error(`twinCases: ${file} didn't compile`)
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

const EXTENSIONS = [".tsx", ".ts", ".js", "/index.tsx", "/index.ts", "/index.js"]

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

const isLiteral = (value: SpecValue) =>
  value === null || ["string", "number", "boolean"].includes(typeof value)

/** The synthetic call site for one prop set, and the values it imports. */
const siteFor = (spec: TwinSpec, props: PropSet) => {
  const values: unknown[] = []
  const valueOf = (value: SpecValue) => {
    if (isLiteral(value)) return JSON.stringify(value)
    values.push(buildValue(value, spec.build ?? {}))
    return `__twin.values[${values.length - 1}]`
  }
  const attrs = Object.entries(props)
    .filter(([key]) => key !== "children" && !spec.omit?.includes(key))
    .map(([key, value]) => `${key}={${valueOf(value)}}`)
  const children =
    props.children === undefined ? null : `{${valueOf(props.children)}}`
  const imported =
    (spec.exportName ?? "default") === "default"
      ? spec.tag
      : `{ ${spec.exportName} as ${spec.tag} }`
  const element = children
    ? `<${spec.tag} ${attrs.join(" ")}>${children}</${spec.tag}>`
    : `<${spec.tag} ${attrs.join(" ")} />`
  const code = [
    `import React from "react"`,
    `import ${imported} from ${JSON.stringify(spec.source)}`,
    `import __twin from ${JSON.stringify(SITE_MODULE)}`,
    "",
    `export default ${element}`,
    "",
  ].join("\n")
  return { code, values }
}

/**
 * Every case of `cases`, converted by the codemod and built, with what the
 * codemod left and why.
 */
export const twinCases = (cases: CasesFile, spec: TwinSpec): TwinCase[] => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires, import/no-dynamic-require
  const { convertSource } = require(
    path.join(ROOT, "scripts", "ds-codemod", "convert")
  ) as {
    convertSource: (
      code: string,
      file: string,
      options: {
        io: { read: (f: string) => string; exists: (f: string) => boolean }
      }
    ) => {
      code: string
      styles: { file: string; code: string } | null
      sites: Site[]
    }
  }
  const file = path.join(SRC, "components", "__fixtures__", "__twin__.tsx")
  return Object.entries(cases.cases).map(([id, entry]) => {
    const { code, values } = siteFor(spec, entry.props)
    const out = convertSource(code, file, {
      io: { read: () => "", exists: () => false },
    })
    const outcome = out.sites.filter((site) => site.tag === spec.tag)
    const left = outcome
      .filter((site) => site.status === "left")
      .map((site) => ({
        attr: site.attr ?? "",
        reason: `${site.reason}: ${site.detail ?? ""}`,
      }))
    let styles: Record<string, unknown> | null = null
    const load = (request: string): unknown => {
      if (request === SITE_MODULE) return { __esModule: true, default: { values } }
      if (request === "./styles") {
        if (!out.styles) throw new Error(`twinCases: ${id} imports a styles file the codemod didn't write`)
        styles = styles ?? run(out.styles.code, out.styles.file, appRequire)
        return styles
      }
      return appRequire(request)
    }
    const element = run(out.code, file, load).default as React.ReactElement
    return { id, sites: entry.sites, code: out.code, outcome, left, element }
  })
}
