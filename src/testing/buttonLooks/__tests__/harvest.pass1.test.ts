/**
 * The ActionBtn look harvest (../harvest) over customerapp's src: every
 * site read with no rewrite (REWRITES is empty), and the looks keyed the way
 * the codemod keys them (scripts/ds-codemod/actionbtn.js lookKey). Then the
 * translator's verdict on each: every one has a Button spelling.
 *
 * The count falls as ActionBtn becomes Button. CA-W0-B harvested 51 elements
 * in 38 files (63 looks) at e30b19a and that harvest is frozen in
 * ../__fixtures__/ButtonLooks.cases.json; W1 converted 8 of them (CONVERTED
 * below), so the tree reads 43 in 31 files. The left sites are held to B's
 * frozen harvest: nothing new, and every look a left file draws is one B
 * proved. W2 lowers the pins again as it converts the screens.
 */
import { describe, expect, it } from "@jest/globals"
import fs from "fs"
import path from "path"

import { harvestActionBtnLooks } from "../harvest"
import { REWRITES } from "../rewrites"
import { translate } from "../__fixtures__/translate"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { lookKey } = require("../../../../scripts/ds-codemod/actionbtn")

const SRC = path.resolve(__dirname, "../../..")

// The ActionBtn elements W1 turned into ds Button, by file: C1's five and C2's
// three (the two in ProCardBase, SuccessModal's).
const CONVERTED: Record<string, number> = {
  "components/CalendarTimeSheet/CalendarTimeSheet.tsx": 1,
  "components/CancelJobFeedbackModal/CancelJobFeedbackModal.tsx": 1,
  "components/FoodMenuItemRow/FoodMenuItemRow.tsx": 1,
  "components/LeaveReviewModal/LeaveReviewModal.tsx": 1,
  "components/MessageBlockedModal/MessageBlockedModal.tsx": 1,
  "components/ProCardBase/ProCardBase.tsx": 2,
  "components/SuccessModal/SuccessModal.tsx": 1,
}

type Frozen = {
  sites: { site: string; looks: number }[]
  looks: Record<string, { props: Record<string, never>; sites: string[] }>
}
const frozen: Frozen = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../__fixtures__/ButtonLooks.cases.json"),
    "utf8"
  )
)
const fileOf = (site: string) => site.replace(/:\d+$/, "")

describe("the ActionBtn look harvest on customerapp", () => {
  const { harvest, sites } = harvestActionBtnLooks(SRC)
  const byKey = new Map<string, Set<string>>()
  for (const { props, sites: where } of Object.values(harvest.looks)) {
    const key = lookKey(props)
    byKey.set(key, new Set([...(byKey.get(key) ?? []), ...where]))
  }

  it("reads every ActionBtn left in src, none through a rewrite", () => {
    expect(REWRITES).toEqual({})
    expect(harvest.elements).toBe(43)
    expect(harvest.files).toBe(31)
    expect(sites).toHaveLength(43)
    expect(sites.filter((s) => s.rewritten)).toEqual([])
    // per site, and as the codemod tells looks apart
    expect(sites.reduce((n, s) => n + s.looks, 0)).toBe(82)
    expect(byKey.size).toBe(52)
  })

  it("has lost exactly the eight elements W1 converted, from B's 51", () => {
    const count = (list: { site: string }[]) => {
      const out: Record<string, number> = {}
      for (const { site } of list)
        out[fileOf(site)] = (out[fileOf(site)] ?? 0) + 1
      return out
    }
    const before = count(frozen.sites)
    const now = count(sites)
    expect(frozen.sites).toHaveLength(51)
    expect(Object.keys(before)).toHaveLength(38)
    // nothing appeared, nothing went but the converted ones
    const lost: Record<string, number> = {}
    for (const file of Object.keys(before)) {
      const gone = before[file] - (now[file] ?? 0)
      if (gone) lost[file] = gone
    }
    expect(Object.keys(now).filter((file) => !(file in before))).toEqual([])
    expect(lost).toEqual(CONVERTED)
  })

  it("draws only looks B proved, in each file it still has", () => {
    // B's frozen harvest, by file: the looks (as the codemod keys them) of
    // the file's elements. A file that is left may not draw a look B did not
    // draw there, so the sites that remain are the ones B's table covers.
    const proven = new Map<string, Set<string>>()
    for (const { props, sites: where } of Object.values(frozen.looks)) {
      for (const site of where) {
        const file = fileOf(site)
        proven.set(file, new Set([...(proven.get(file) ?? []), lookKey(props)]))
      }
    }
    const stray: string[] = []
    for (const { props, sites: where } of Object.values(harvest.looks)) {
      for (const site of where) {
        if (!proven.get(fileOf(site))?.has(lookKey(props)))
          stray.push(`${site} ${lookKey(props)}`)
      }
    }
    expect(stray).toEqual([])
    // and every look B proved for a left file is still read there
    const read = new Map<string, Set<string>>()
    for (const [key, where] of byKey)
      for (const site of where)
        read.set(
          fileOf(site),
          new Set([...(read.get(fileOf(site)) ?? []), key])
        )
    const missing: string[] = []
    for (const [file, keys] of proven) {
      if (file in CONVERTED && !sites.some((s) => fileOf(s.site) === file))
        continue
      for (const key of keys)
        if (!read.get(file)?.has(key)) missing.push(`${file} ${key}`)
    }
    expect(missing).toEqual([])
  })

  it("translates all 52 looks: CA-W0-B's rules spell the five it once refused", () => {
    // bg-grey19 while disabled (subtle), a caller's bg-red under the
    // spinner (brand), opacity-50 (dim); table.pass1.test.ts checks every
    // look's props against B's table
    const refused: Record<string, string[]> = {}
    for (const [key, where] of byKey) {
      const look = JSON.parse(key)
      try {
        translate({ title: "Button title", ...look }, () => null)
      } catch (error) {
        const why = String((error as Error).message).split("\n")[0]
        refused[why] = [...new Set([...(refused[why] ?? []), ...where])]
      }
    }
    expect(refused).toEqual({})
  })
})
