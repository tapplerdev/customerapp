/**
 * Jest only, and W3.1 only: W3.4 deletes this file with the codemod. The
 * freeze, which writes a twin test's `__fixtures__/<Name>.twins.json`.
 *
 * With DS_FREEZE_TWINS=1, frozenTwinCases hands every case set a twin test
 * feeds (harvested JSON, `*.hand.tsx`, a test's own hand sets) to the codemod
 * here instead of reading the frozen file. Each prop set becomes a call site
 * of its own and is converted by scripts/ds-codemod's convertSource, the
 * function `yarn ds:codemod` runs on each file. An element value the test
 * builds as a real component the codemod converts (DmText, DmView, View) is
 * written into the site as JSX, so the codemod converts it too; any other
 * element (a stand-in, which draws its recorded props) stays a value.
 *
 * The freeze refuses a converted case that still holds a class (on the
 * component or an element in it) or renders DmText or ActionBtn: neither
 * draws once NativeWind is gone. A refused case is hand-converted (the
 * test's `edits`: the class the codemod leaves, converted the way the real
 * sites were, the rest converted by the codemod) or dropped (the test's
 * `drops`, with the screen parity file that covers its site). Anything else
 * refused fails the run.
 *
 * The test's rows compare each converted case with the class test's own
 * trees (expectTwin), and the file is written after the last row, with
 * every case whose rows all passed: its code, its styles file and the props
 * it was written from, under the codemod's commit.
 */
import { afterAll, expect, it } from "@jest/globals"
import { execFileSync } from "child_process"
import fs from "fs"
import path from "path"

import type { CasesFile } from "./files"
import type { ElementSpec, PropSet, SpecValue } from "./harvest"
import { buildValue, type BuildOptions } from "./props"
import {
  ROOT,
  SITE_FILE,
  SITE_MODULE,
  renderSite,
  type FrozenCase,
  type Left,
  type TwinCase,
  type TwinSpec,
  type TwinsFile,
} from "./twinSite"

/** The tags a test can build as real components that the codemod converts, and where a site imports them. */
const CONVERTED_TAGS: Record<string, string> = {
  DmText: "@tappler/shared/src/components/UI",
  DmView: "@tappler/shared/src/components/UI",
  View: "react-native",
}

/** A prop that carries class names, NativeWind's `tw` included. */
const CLASS_PROP = /^className|ClassName$|^tw$/

/** What draws only through NativeWind (DmText's guard, ActionBtn's look). */
const NATIVEWIND_ONLY = new Set(["DmText", "ActionBtn"])

type Site = {
  tag: string
  attr: string | null
  status: "converted" | "left"
  reason?: string
  detail?: string
}

type Convert = (
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

const isLiteral = (value: SpecValue) =>
  value === null || ["string", "number", "boolean"].includes(typeof value)

const isElementSpec = (value: SpecValue): value is ElementSpec =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "$el" in value

/** Nothing but literals (a style object): written into an element as a literal. */
const isPlain = (value: SpecValue): boolean => {
  if (isLiteral(value)) return true
  if (Array.isArray(value)) return value.every(isPlain)
  if (typeof value !== "object" || value === null) return false
  if ("$el" in value || "$fn" in value || "$opaque" in value) return false
  return Object.values(value).every(isPlain)
}

/**
 * The synthetic call site for one prop set: each class, text and other
 * literal prop as a literal (the codemod reads literals: a text slot's own
 * props may depend on them, as they do at a real site), each element the
 * codemod converts as JSX, and every other value through `__twin_site__`.
 */
export const siteFor = (spec: TwinSpec, props: PropSet) => {
  const build: BuildOptions = spec.build ?? {}
  const values: unknown[] = []
  const specs: SpecValue[] = []
  const tags = new Set<string>()

  const real = (value: SpecValue): value is ElementSpec =>
    isElementSpec(value) &&
    value.$el in CONVERTED_TAGS &&
    !!build.elements?.[value.$el]
  const holdsReal = (value: SpecValue): boolean =>
    real(value) || (Array.isArray(value) && value.some(holdsReal))
  const imported = (value: SpecValue) => {
    values.push(buildValue(value, build))
    specs.push(value)
    return `__twin.values[${values.length - 1}]`
  }

  // An attribute's value; inside an element the codemod converts, a plain
  // object or array (a style) is a literal too, as the site wrote it.
  const attrValue = (value: SpecValue, inElement: boolean): string => {
    if (isLiteral(value)) return JSON.stringify(value)
    if (real(value)) return jsx(value)
    if (holdsReal(value)) {
      throw new Error(
        `twins: a list holding ${(value as SpecValue[]).length} elements as a prop value isn't written yet`
      )
    }
    if (inElement && isPlain(value)) return JSON.stringify(value)
    return imported(value)
  }
  // A JSX child (or, for a list holding an element the codemod converts, one
  // child per item, which React lays out as it lays out the list).
  const child = (value: SpecValue): string => {
    if (isLiteral(value)) return `{${JSON.stringify(value)}}`
    if (real(value)) return jsx(value)
    if (Array.isArray(value) && value.some(holdsReal)) {
      return value.map(child).join("")
    }
    return `{${imported(value)}}`
  }
  function jsx(element: ElementSpec): string {
    tags.add(element.$el)
    const attrs = Object.entries(element.props ?? {}).map(
      ([key, value]) => `${key}={${attrValue(value, true)}}`
    )
    const open = [element.$el, ...attrs].join(" ")
    const kids = element.children === undefined ? "" : child(element.children)
    return kids ? `<${open}>${kids}</${element.$el}>` : `<${open} />`
  }

  const attrs = Object.entries(props)
    .filter(([key]) => key !== "children" && !spec.omit?.includes(key))
    .map(([key, value]) => `${key}={${attrValue(value, false)}}`)
  const children =
    props.children === undefined
      ? null
      : holdsReal(props.children)
        ? child(props.children)
        : `{${attrValue(props.children, false)}}`
  const imports =
    (spec.exportName ?? "default") === "default"
      ? spec.tag
      : `{ ${spec.exportName} as ${spec.tag} }`
  const element = children
    ? `<${spec.tag} ${attrs.join(" ")}>${children}</${spec.tag}>`
    : `<${spec.tag} ${attrs.join(" ")} />`
  const byModule = new Map<string, string[]>()
  ;[...tags].sort().forEach((tag) => {
    const source = CONVERTED_TAGS[tag]
    byModule.set(source, [...(byModule.get(source) ?? []), tag])
  })
  const code = [
    `import React from "react"`,
    `import ${imports} from ${JSON.stringify(spec.source)}`,
    ...[...byModule].map(
      ([source, names]) =>
        `import { ${names.join(", ")} } from ${JSON.stringify(source)}`
    ),
    `import __twin from ${JSON.stringify(SITE_MODULE)}`,
    "",
    `export default ${element}`,
    "",
  ].join("\n")
  return { code, values, specs }
}

type Node = { type: string; [key: string]: unknown }

const tagName = (name: Node): string =>
  name.type === "JSXIdentifier"
    ? (name.name as string)
    : name.type === "JSXMemberExpression"
      ? `${tagName(name.object as Node)}.${(name.property as Node).name as string}`
      : String(name.name)

/**
 * Why a converted case can't be frozen (empty when it can): a class left on
 * an element of the site (even an empty one, which a DmView would hand its
 * native view once nothing strips it), a DmText or ActionBtn the site
 * renders, or one inside a value the codemod never saw.
 */
export const refusalsOf = (
  code: string,
  specs: SpecValue[],
  build: BuildOptions
): string[] => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const parser = require("@babel/parser") as typeof import("@babel/parser")
  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  }) as unknown as Node
  const out: string[] = []
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (!node || typeof node !== "object") return
    const n = node as Node
    if (n.type === "JSXOpeningElement") {
      const tag = tagName(n.name as Node)
      if (NATIVEWIND_ONLY.has(tag)) out.push(`it renders <${tag}>`)
      ;((n.attributes as Node[]) ?? []).forEach((attribute) => {
        if (attribute.type !== "JSXAttribute") return
        const attr = tagName(attribute.name as Node)
        if (CLASS_PROP.test(attr)) out.push(`<${tag}> keeps ${attr}`)
      })
    }
    Object.entries(n).forEach(([key, value]) => {
      if (key !== "loc" && key !== "start" && key !== "end") visit(value)
    })
  }
  visit(ast)
  const inValue = (value: SpecValue, where: string) => {
    if (Array.isArray(value)) {
      value.forEach((item) => inValue(item, where))
      return
    }
    if (!value || typeof value !== "object") return
    if (isElementSpec(value)) {
      if (build.elements?.[value.$el]) {
        if (NATIVEWIND_ONLY.has(value.$el)) {
          out.push(`${where} builds a <${value.$el}>`)
        }
        Object.entries(value.props ?? {}).forEach(([key, item]) => {
          if (CLASS_PROP.test(key) && typeof item === "string" && item.trim()) {
            out.push(`${where} builds a <${value.$el}> with ${key}`)
          }
        })
      }
      Object.values(value.props ?? {}).forEach((item) => inValue(item, where))
      if (value.children !== undefined) inValue(value.children, where)
      return
    }
    if ("$fn" in value || "$opaque" in value) return
    Object.values(value).forEach((item) => inValue(item, where))
  }
  specs.forEach((value, index) => inValue(value, `value ${index}`))
  return out
}

let convertSource: Convert | null = null
const codemod = (): Convert => {
  if (!convertSource) {
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires, import/no-dynamic-require
    convertSource = (
      require(path.join(ROOT, "scripts", "ds-codemod", "convert")) as {
        convertSource: Convert
      }
    ).convertSource
  }
  return convertSource
}

/** One prop set through the codemod: the converted site and why it can't be frozen, if it can't. */
export const convertCase = (spec: TwinSpec, props: PropSet) => {
  const { code, values, specs } = siteFor(spec, props)
  const out = codemod()(code, SITE_FILE, {
    io: { read: () => "", exists: () => false },
  })
  const left: Left[] = out.sites
    .filter((site) => site.status === "left")
    .map((site) => ({
      attr: site.attr ?? "",
      reason: `${site.reason}: ${site.detail ?? ""}`,
      ...(site.tag === spec.tag ? {} : { tag: site.tag }),
    }))
  return {
    code: out.code,
    styles: out.styles?.code ?? null,
    values,
    specs,
    left,
    refusals: refusalsOf(out.code, specs, spec.build ?? {}),
  }
}

type Entry = FrozenCase & { ran: number; passed: number }

type Freezer = {
  component: string
  cases: Map<string, Entry>
  drops: Map<string, TwinsFile["drops"][string]>
  /** Every case id a set handed it, and every drop a spec declared. */
  fed: Set<string>
  declaredDrops: Set<string>
  edits: Set<TwinSpec["edits"]>
  used: Set<unknown>
}

const freezers = new Map<string, Freezer>()

const git = (...args: string[]) =>
  execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8" }).trim()

const rel = (file: string) => path.relative(ROOT, file)

/** The commit of the codemod that converts the cases; it must be committed as it runs. */
const codemodCommit = () => {
  const dirty = git(
    "status",
    "--porcelain",
    "--",
    "scripts/ds-codemod",
    "scripts/nw-resolve.js",
    "tailwind.config.js"
  )
  if (dirty) {
    throw new Error(
      `twins: the codemod has uncommitted changes; commit them before freezing:\n${dirty}`
    )
  }
  return git("log", "-1", "--format=%h", "--", "scripts/ds-codemod")
}

const write = (file: string, freezer: Freezer) => {
  const staleDrops = [...freezer.declaredDrops].filter(
    (id) => !freezer.fed.has(id)
  )
  if (staleDrops.length) {
    throw new Error(
      `twins: drops for cases no set has (stale?): ${staleDrops.join(", ")}`
    )
  }
  const unused = [...freezer.edits]
    .flatMap((edits) => edits ?? [])
    .filter((edit) => !freezer.used.has(edit))
    .map((edit) => `${edit.attr}: ${edit.reason}`)
  if (unused.length) {
    throw new Error(
      `twins: hand edits no case needed (stale?): ${unused.join("; ")}`
    )
  }
  const entries = [...freezer.cases].sort(([a], [b]) => (a < b ? -1 : 1))
  const never = entries.filter(([, entry]) => entry.ran === 0).map(([id]) => id)
  if (never.length) {
    throw new Error(
      `twins: ${rel(file)} not written: no row compared ${never.join(", ")} (a -t filter? freeze the whole file)`
    )
  }
  const failed = entries
    .filter(([, entry]) => entry.passed < entry.ran)
    .map(([id]) => id)
  const frozen: TwinsFile = {
    component: freezer.component,
    codemod: codemodCommit(),
    cases: Object.fromEntries(
      entries
        .filter(([, entry]) => entry.passed === entry.ran)
        .map(([id, { ran: _ran, passed: _passed, ...entry }]) => [id, entry])
    ),
    drops: Object.fromEntries(
      [...freezer.drops].sort(([a], [b]) => (a < b ? -1 : 1))
    ),
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(frozen, null, 1)}\n`)
  if (failed.length) {
    throw new Error(
      `twins: ${rel(file)} written without ${failed.length} case(s) whose rows failed: ${failed.join(", ")}`
    )
  }
}

/**
 * The freeze of one case set (frozenTwinCases with DS_FREEZE_TWINS=1): its
 * cases converted by the codemod, refused, hand-edited or dropped, for the
 * test's rows to compare; the file is written after the last row.
 */
export const freezeTwins = (
  file: string,
  cases: Pick<CasesFile, "cases"> & Partial<CasesFile>,
  spec: TwinSpec
): TwinCase[] => {
  let freezer = freezers.get(file)
  if (!freezer) {
    freezer = {
      component: cases.component ?? spec.tag,
      cases: new Map(),
      drops: new Map(),
      fed: new Set(),
      declaredDrops: new Set(),
      edits: new Set(),
      used: new Set(),
    }
    freezers.set(file, freezer)
    const mine = freezer
    afterAll(() => write(file, mine))
  }
  const state = freezer
  state.edits.add(spec.edits)
  Object.keys(spec.drops ?? {}).forEach((id) => state.declaredDrops.add(id))
  Object.keys(cases.cases).forEach((id) => state.fed.add(id))
  const refused: string[] = []
  const twins = Object.entries(cases.cases).flatMap(([id, entry]) => {
    const drop = spec.drops?.[id]
    if (drop) {
      state.drops.set(id, { ...drop, sites: entry.sites })
      return []
    }
    const first = convertCase(spec, entry.props)
    let converted = first
    let props = entry.props
    const applied: string[] = []
    if (first.refusals.length) {
      const edits = first.left.map((left) =>
        spec.edits?.find(
          (edit) => edit.attr === left.attr && edit.reason === left.reason
        )
      )
      if (edits.length && edits.every(Boolean)) {
        edits.forEach((edit) => {
          state.used.add(edit)
          props = edit!.edit(props)
          applied.push(edit!.reason)
        })
        converted = convertCase(spec, props)
      }
    }
    if (converted.refusals.length) {
      refused.push(
        `${id} (${entry.sites[0]}): ${converted.refusals.join("; ")}; left ${JSON.stringify(first.left)}`
      )
      return []
    }
    const frozen: FrozenCase = {
      sites: entry.sites,
      props,
      code: converted.code,
      styles: converted.styles,
      values: converted.specs,
      left: first.left,
      ...(applied.length ? { edits: applied } : {}),
    }
    const seen = state.cases.get(id)
    if (seen && seen.code !== frozen.code) {
      throw new Error(`twins: two cases named ${id} convert differently`)
    }
    if (!seen) state.cases.set(id, { ...frozen, ran: 0, passed: 0 })
    return [
      {
        id,
        sites: entry.sites,
        props,
        code: converted.code,
        left: first.left,
        edits: applied,
        element: renderSite(
          {
            code: converted.code,
            styles: converted.styles,
            values: converted.values,
          },
          id
        ),
      },
    ]
  })
  it(`the freeze refuses none of the ${Object.keys(cases.cases).length} cases it is given`, () => {
    expect(refused).toEqual([])
  })
  return twins
}

/** A row's comparison, counted toward its case (expectTwin, freeze mode). */
export const countRow = (file: string, id: string, compare: () => void) => {
  const entry = freezers.get(file)?.cases.get(id)
  if (!entry) {
    throw new Error(
      `twins: a row of ${id}, which ${rel(file)}'s freeze doesn't hold`
    )
  }
  entry.ran += 1
  compare()
  entry.passed += 1
}

/**
 * The case ids the freeze of `file` holds so far, its drops, the ids its
 * case sets fed and the drops their specs declared.
 */
export const frozenSoFar = (file: string) => {
  const freezer = freezers.get(file)
  return {
    ids: [...(freezer?.cases.keys() ?? [])],
    drops: Object.fromEntries(freezer?.drops ?? []),
    fed: [...(freezer?.fed ?? [])],
    declared: [...(freezer?.declaredDrops ?? [])],
  }
}
