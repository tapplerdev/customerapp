/**
 * Jest only. A component's harvest on disk, frozen when its fixture is
 * captured, so the cases a parity test compares are the call sites as they
 * were BEFORE the change (a conversion that edits the call sites can't move
 * them):
 *
 *   <Name>.cases.json     the prop sets and the sites that pass each one
 *
 * It lives in a `__fixtures__` directory beside the component's tests, with
 * the component's frozen twins (`<Name>.twins.json`, frozenTwins) if it has
 * any. Until W3.1 a `<Name>.classes.tsx` beside it listed the cases' class
 * strings so NativeWind compiled them; nothing draws a harvested class now
 * (archive/ca-pass1-tools holds that path).
 */
import fs from "fs"
import path from "path"

import {
  harvestCallSites,
  type Harvest,
  type HarvestOptions,
  type HarvestedSite,
} from "./harvest"

export type CasesFile = Harvest & {
  /** What the cases are of (the component, as the test names it). */
  component: string
  /** The commit the harvest was taken on. */
  capturedAt: string
}

export type HarvestFiles = {
  /** `<dir>/__fixtures__/<Name>.cases.json` */
  cases: string
}

/**
 * The import specifiers customerapp reaches one of its src/components by:
 * `components/X` (the folder's index; 71 imports at e30b19a) and
 * `components/X/X` (the file; 80). The harvest matches an import's text, so
 * give it this to find both: `importFrom: componentImport("SkeletonLoader")`.
 */
export const componentImport = (name: string) =>
  new RegExp(`(^|/)components/${name}(/${name})?$`)

/** Where a component's harvest lives: `__fixtures__` beside `testsDir`. */
export const harvestFilesFor = (
  testsDir: string,
  name: string
): HarvestFiles => ({
  cases: path.join(
    path.dirname(testsDir),
    "__fixtures__",
    `${name}.cases.json`
  ),
})

/** Harvest the call sites and write the cases (the test's harvest mode). */
export const writeHarvest = (
  files: HarvestFiles,
  name: string,
  options: HarvestOptions,
  capturedAt: string
): { file: CasesFile; sites: HarvestedSite[] } => {
  const { harvest, sites } = harvestCallSites(options)
  const file: CasesFile = { component: name, capturedAt, ...harvest }
  fs.mkdirSync(path.dirname(files.cases), { recursive: true })
  fs.writeFileSync(files.cases, `${JSON.stringify(file, null, 1)}\n`)
  return { file, sites }
}

/** The frozen cases (a missing file says how to make it). */
export const readHarvest = (files: HarvestFiles): CasesFile => {
  if (!fs.existsSync(files.cases)) {
    throw new Error(
      `${files.cases} is missing: harvest the call sites first (DS_HARVEST=1, on the code before the change)`
    )
  }
  return JSON.parse(fs.readFileSync(files.cases, "utf8")) as CasesFile
}

/**
 * Whether this run harvests (writes the files) instead of comparing: the
 * DS_HARVEST variable, read through a variable key so react-native-dotenv
 * can't inline it at transform time.
 */
export const harvesting = () => {
  const key = "DS_HARVEST"
  return (
    (globalThis.process.env as Record<string, string | undefined>)[key] === "1"
  )
}
