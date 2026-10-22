/**
 * Jest only. A component's twin proof once its class-name path is gone: the
 * call sites the codemod converted at the freeze (W3.1), each drawn from its
 * frozen code and compared with the trees its class-name test captured
 * before the conversion. No codemod runs here, no class string is compiled
 * and nothing needs NativeWind.
 *
 *   __fixtures__/<Name>.twins.json   every case's converted site, its styles
 *                                    file and the props it was written from,
 *                                    the cases the freeze dropped and why
 *   __tests__/__parity__/<class test>.json   the trees (expectParity's `file`)
 *
 * A failing frozen twin means the component changed what it draws, never
 * that the frozen file is wrong: neither file may be edited by hand.
 */
import { expect } from "@jest/globals"
import fs from "fs"
import path from "path"

import {
  expectParity,
  parityName,
  type HostNode,
  type ParityEnv,
  type ParityOptions,
} from "testing/hostTreeParity"

import type { CasesFile } from "./files"
import type { PropSet } from "./harvest"
import {
  ROOT,
  buildValues,
  canonical,
  freezing,
  renderSite,
  type TwinCase,
  type TwinSpec,
  type TwinsFile,
} from "./twinSite"

const rel = (file: string) => path.relative(ROOT, file)

// The freeze, loaded only when the run freezes (W3.4 deletes it), once: the
// kit's twin tests reset the module registry between rows, and a freeze
// loaded again would have lost the cases it holds.
let freezeModule: typeof import("./freezeTwins") | null = null
const freeze = () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  freezeModule ??= require("./freezeTwins") as typeof import("./freezeTwins")
  return freezeModule
}

/** A frozen file (a missing one says how it is made). */
export const readTwins = (file: string): TwinsFile => {
  if (!fs.existsSync(file)) {
    throw new Error(
      `${rel(file)} is missing: it is written by the freeze (DS_FREEZE_TWINS=1, W3.1 only)`
    )
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as TwinsFile
}

/** The case's props as the freeze wrote its site: the hand edits it applied, by reason. */
const asFrozen = (
  id: string,
  props: PropSet,
  reasons: string[],
  spec: TwinSpec
) =>
  reasons.reduce((current, reason) => {
    const edit = spec.edits?.find((candidate) => candidate.reason === reason)
    if (!edit) {
      throw new Error(
        `twins: ${id} was frozen with a hand edit the test no longer has: ${reason}`
      )
    }
    return edit.edit(current)
  }, props)

/**
 * What a test's case sets handed frozenTwinCases, by frozen file: every case
 * id they feed and every drop their specs declare. The cover check holds the
 * file's drops to them.
 */
const fedTo = new Map<string, { fed: Set<string>; declared: Set<string> }>()

/**
 * The twins of one case set a test feeds (harvested JSON, `*.hand.tsx`, its
 * own hand sets), in the set's order: each case's frozen site, drawn with
 * values built now from `spec.build`. A dropped case is left out. A case the
 * file doesn't hold, or one that changed since the freeze, fails.
 *
 * With DS_FREEZE_TWINS=1 the run is the freeze instead (freezeTwins).
 */
export const frozenTwinCases = (
  file: string,
  cases: Pick<CasesFile, "cases"> & Partial<CasesFile>,
  spec: TwinSpec
): TwinCase[] => {
  if (freezing()) return freeze().freezeTwins(file, cases, spec)
  const seen = fedTo.get(file) ?? { fed: new Set(), declared: new Set() }
  fedTo.set(file, seen)
  Object.keys(cases.cases).forEach((id) => seen.fed.add(id))
  Object.keys(spec.drops ?? {}).forEach((id) => seen.declared.add(id))
  const frozen = readTwins(file)
  return Object.entries(cases.cases).flatMap(([id, entry]) => {
    const dropped = id in frozen.drops
    if (dropped !== !!spec.drops?.[id]) {
      throw new Error(
        `twins: ${id} is ${dropped ? "" : "not "}dropped in ${rel(file)}, but the test says otherwise: refreeze`
      )
    }
    if (dropped) return []
    const twin = frozen.cases[id]
    if (!twin) {
      throw new Error(
        `twins: ${id} isn't in ${rel(file)}: refreeze (DS_FREEZE_TWINS=1, W3.1 only)`
      )
    }
    const props = asFrozen(id, entry.props, twin.edits ?? [], spec)
    if (canonical(props) !== canonical(twin.props)) {
      throw new Error(
        `twins: ${id} isn't the case ${rel(file)} froze (its props changed)`
      )
    }
    return [
      {
        id,
        sites: twin.sites,
        props: twin.props,
        code: twin.code,
        left: twin.left,
        edits: twin.edits ?? [],
        element: renderSite(
          {
            code: twin.code,
            styles: twin.styles,
            values: buildValues(twin.values, spec.build),
          },
          `${id} (${rel(file)})`
        ),
      },
    ]
  })
}

/**
 * One frozen case's element, built in the module registry this runs in. The
 * kit's twin tests (OrderBill, the scroll wrappers) draw each row in a
 * registry of its own, so the loader asks for its element here: the case's
 * frozen site, with `props` (the case as the test builds it) held to the
 * ones the freeze wrote. In the freeze the case is converted by the codemod
 * instead, in this registry (`props` is then the case as it is, and the
 * test's top-level frozenTwinCases call is what writes the file).
 */
export const frozenTwinElement = (
  file: string,
  id: string,
  props: PropSet,
  spec: TwinSpec
) => {
  if (freezing()) {
    const converted = freeze().convertCase(spec, props)
    return renderSite(
      {
        code: converted.code,
        styles: converted.styles,
        values: converted.values,
      },
      `${id} (${rel(file)})`
    )
  }
  const twin = readTwins(file).cases[id]
  if (!twin) {
    throw new Error(
      `twins: ${id} isn't in ${rel(file)}: refreeze (DS_FREEZE_TWINS=1, W3.1 only)`
    )
  }
  if (canonical(props) !== canonical(twin.props)) {
    throw new Error(
      `twins: ${id} isn't the case ${rel(file)} froze (its props changed)`
    )
  }
  return renderSite(
    {
      code: twin.code,
      styles: twin.styles,
      values: buildValues(twin.values, spec.build),
    },
    `${id} (${rel(file)})`
  )
}

/**
 * expectParity for one row of a twin: the tree it draws against the class
 * test's (options.file). In the freeze the row also counts toward writing
 * its case, which is written only if every row of it passes.
 */
export const expectTwin = (
  file: string,
  id: string,
  name: string,
  tree: HostNode | null,
  options: ParityOptions
) => {
  let result: ReturnType<typeof expectParity> = { accepted: [] }
  const compare = () => {
    result = expectParity(name, tree, options)
  }
  if (freezing()) freeze().countRow(file, id, compare)
  else compare()
  return result
}

/**
 * A twin row as the cover check reads it: its case, its tree's name in the
 * fixture (default the case id) and its environment.
 */
export type TwinRow = { id: string; name?: string; env: ParityEnv }

const ENV_SUFFIX = / \[(en|ar) (ios|android)\]$/

/**
 * Freeze honesty: the rows a twin test compares are every case its class
 * test captured (the fixture's names) but the recorded drops, and they draw
 * every case the frozen file holds and nothing else. A frozen file that
 * lost its cases fails here, not silently. So does a stray drop: one the
 * test doesn't declare, one for a case no set feeds, one that is also a
 * kept case, or one that stands for no case the class test captured.
 */
export const expectFrozenCover = (
  file: string,
  fixture: string,
  rows: readonly TwinRow[]
) => {
  const { ids, drops, fed, declared } = freezing()
    ? freeze().frozenSoFar(file)
    : (() => {
        const frozen = readTwins(file)
        const seen = fedTo.get(file)
        return {
          ids: Object.keys(frozen.cases),
          drops: frozen.drops,
          fed: [...(seen?.fed ?? [])],
          declared: [...(seen?.declared ?? [])],
        }
      })()
  const captured = Object.keys(
    (JSON.parse(fs.readFileSync(fixture, "utf8")) as { cases: object }).cases
  )
  const bases = new Set(captured.map((name) => name.replace(ENV_SUFFIX, "")))
  const strays = [
    ...Object.keys(drops)
      .filter((id) => !declared.includes(id))
      .map((id) => `${id}: a drop the test doesn't declare`),
    ...declared
      .filter((id) => !(id in drops))
      .map((id) => `${id}: a drop the test declares and the file lacks`),
    ...declared
      .filter((id) => !fed.includes(id))
      .map((id) => `${id}: a drop for a case no set feeds`),
    ...Object.keys(drops)
      .filter((id) => ids.includes(id))
      .map((id) => `${id}: a drop that is also a kept case`),
    ...Object.entries(drops).flatMap(([id, drop]) =>
      (drop.names ?? [id])
        .filter((name) => !bases.has(name))
        .map(
          (name) => `${id}: drops ${name}, which the class test never captured`
        )
    ),
  ]
  expect(strays.sort()).toEqual([])
  const dropped = new Set(
    Object.entries(drops).flatMap(([id, drop]) => drop.names ?? [id])
  )
  const names = [
    ...new Set(rows.map((row) => parityName(row.name ?? row.id, row.env))),
  ]
  expect(names.sort()).toEqual(
    captured.filter((name) => !dropped.has(name.replace(ENV_SUFFIX, ""))).sort()
  )
  expect([...new Set(rows.map((row) => row.id))].sort()).toEqual(
    [...ids].sort()
  )
  Object.entries(drops).forEach(([id, drop]) => {
    expect({ id, reason: drop.reason.length > 0 }).toEqual({ id, reason: true })
    const real = drop.sites.some((site) => /\.tsx?:\d+$/.test(site))
    if (real) {
      expect({ id, coveredBy: drop.coveredBy }).toEqual({
        id,
        coveredBy: expect.any(String),
      })
      expect({
        id,
        exists: fs.existsSync(path.join(ROOT, drop.coveredBy!)),
      }).toEqual({
        id,
        exists: true,
      })
    }
  })
}
