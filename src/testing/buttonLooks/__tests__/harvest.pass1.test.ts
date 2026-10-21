/**
 * The ActionBtn look harvest (../harvest) over customerapp's src: every
 * site read with no rewrite (REWRITES is empty), and the looks keyed the way
 * the codemod keys them (scripts/ds-codemod/actionbtn.js lookKey), so the
 * looks proof and the codemod count the same 63. Then the translator's
 * verdict on each: every one has a Button spelling.
 */
import { describe, expect, it } from "@jest/globals"
import path from "path"

import { harvestActionBtnLooks } from "../harvest"
import { REWRITES } from "../rewrites"
import { translate } from "../__fixtures__/translate"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { lookKey } = require("../../../../scripts/ds-codemod/actionbtn")

const SRC = path.resolve(__dirname, "../../..")

describe("the ActionBtn look harvest on customerapp", () => {
  const { harvest, sites } = harvestActionBtnLooks(SRC)
  const byKey = new Map<string, Set<string>>()
  for (const { props, sites: where } of Object.values(harvest.looks)) {
    const key = lookKey(props)
    byKey.set(key, new Set([...(byKey.get(key) ?? []), ...where]))
  }

  it("reads every ActionBtn in src, none through a rewrite", () => {
    expect(REWRITES).toEqual({})
    expect(harvest.elements).toBe(51)
    expect(harvest.files).toBe(38)
    expect(sites.filter((s) => s.rewritten)).toEqual([])
    // per site, and as the codemod tells looks apart
    expect(sites.reduce((n, s) => n + s.looks, 0)).toBe(94)
    expect(byKey.size).toBe(63)
  })

  it("translates all 63 looks: CA-W0-B's rules spell the five it once refused", () => {
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
