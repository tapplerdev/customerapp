/**
 * Jest only. A component's harvest on disk, frozen when its fixture is
 * captured, so the cases a parity test compares are the call sites as they
 * were BEFORE the change (a conversion that edits the call sites can't move
 * them):
 *
 *   <Name>.cases.json     the prop sets and the sites that pass each one
 *   <Name>.classes.tsx    every class string in them, written out in a
 *                         .tsx so NativeWind compiles them as the sites' own
 *                         files compile them in the app (classes in JSON
 *                         never compile). The test imports it for that.
 *
 * Both live in a `__fixtures__` directory beside the component's tests (not
 * under `__tests__`, where jest would take the .tsx for a test; the style
 * ratchet and the codemod skip `__fixtures__`).
 */
import fs from "fs"
import path from "path"

import {
  classStringsOf,
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
  /** `<dir>/__fixtures__/<Name>.classes.tsx` */
  classes: string
}

/** Where a component's harvest lives: `__fixtures__` beside `testsDir`. */
export const harvestFilesFor = (
  testsDir: string,
  name: string
): HarvestFiles => {
  const dir = path.join(path.dirname(testsDir), "__fixtures__")
  return {
    cases: path.join(dir, `${name}.cases.json`),
    classes: path.join(dir, `${name}.classes.tsx`),
  }
}

const classesSource = (name: string, classes: string[]) =>
  [
    "/*",
    ` * Generated with ${name}.cases.json (testing/harvest). Every class string`,
    " * the harvested call sites pass, so that NativeWind compiles them here as",
    " * it compiles them in the sites' own files in the app. Imported by the",
    " * parity test for that effect only; regenerate with the harvest.",
    " */",
    "export const HARVESTED_CLASSES = [",
    ...classes.map((value) => `  ${JSON.stringify(value)},`),
    "]",
    "",
  ].join("\n")

/** Harvest the call sites and write both files (the test's harvest mode). */
export const writeHarvest = (
  files: HarvestFiles,
  name: string,
  options: HarvestOptions,
  capturedAt: string
): { file: CasesFile; sites: HarvestedSite[]; classes: string[] } => {
  const { harvest, sites } = harvestCallSites(options)
  const file: CasesFile = { component: name, capturedAt, ...harvest }
  const classes = classStringsOf(harvest.cases)
  fs.mkdirSync(path.dirname(files.cases), { recursive: true })
  fs.writeFileSync(files.cases, `${JSON.stringify(file, null, 1)}\n`)
  fs.writeFileSync(files.classes, classesSource(name, classes))
  return { file, sites, classes }
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
 * The class strings the cases pass that the classes file doesn't list
 * (empty when the file is in step with the cases).
 */
export const unlistedClasses = (files: HarvestFiles, cases: CasesFile) => {
  const source = fs.existsSync(files.classes)
    ? fs.readFileSync(files.classes, "utf8")
    : ""
  return classStringsOf(cases.cases).filter(
    (value) => !source.includes(JSON.stringify(value))
  )
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
