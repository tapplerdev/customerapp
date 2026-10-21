/**
 * The translator (../__fixtures__/translate.ts, the rules ds:codemod runs)
 * against CA-W0-B's translation table: B harvested customerapp's 51 ActionBtn
 * elements at e30b19a into 72 prop sets (63 looks) and drew ds Button with
 * each row's props beside live ActionBtn under customerapp's tailwind config,
 * equal but for the listed deltas. Each harvested prop set must translate to
 * exactly the props of B's row, so what the codemod writes is what B drew.
 *
 * ../__fixtures__/ButtonLooks.cases.json and ButtonLooks.table.json are byte
 * copies of proapp ds/ca-w0-B ef04bc94's
 * src/testing/sharedComponents/customerapp/__fixtures__ (pinned below by
 * hash): copy both again, and the hashes, if B's table changes.
 * A pass-1 suite: the translator reads NativeWind's output through nw-resolve.
 */
import { describe, expect, it } from "@jest/globals"
import crypto from "crypto"
import fs from "fs"
import path from "path"
import type React from "react"

import { translate } from "../__fixtures__/translate"
import type { ElementSpec, Look } from "../harvest"

const FIXTURES = path.resolve(__dirname, "../__fixtures__")
const read = (name: string) =>
  fs.readFileSync(path.join(FIXTURES, name), "utf8")

type Cases = { looks: Record<string, { props: Look; sites: string[] }> }
type Table = {
  looks: Record<string, { props: Record<string, unknown>; written: string }>
}

// A function as { $fn: true } and a built node as its spec, keys sorted: the
// table's JSON form.
const norm = (value: unknown): unknown => {
  if (typeof value === "function") return { $fn: true }
  if (Array.isArray(value)) return value.map(norm)
  if (value && typeof value === "object") {
    const spec = (value as { $spec?: ElementSpec }).$spec
    if (spec) return norm(spec)
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, norm((value as Record<string, unknown>)[key])])
    )
  }
  return value
}

describe("the translator against CA-W0-B's translation table", () => {
  it("reads B's files as B wrote them", () => {
    const sha = (name: string) =>
      crypto.createHash("sha256").update(read(name)).digest("hex")
    expect(sha("ButtonLooks.cases.json")).toBe(
      "23c65cf467d878af0070acc0b7a7b56dc2ee042762f35dfb82168f042dfb43f2"
    )
    expect(sha("ButtonLooks.table.json")).toBe(
      "bfb928bcb6591ad780c12a92c184d0f8de9b9fcdf959642ffd36e96bf54bc615"
    )
  })

  it("spells every one of B's 72 prop sets as B's table does", () => {
    const cases: Cases = JSON.parse(read("ButtonLooks.cases.json"))
    const table: Table = JSON.parse(read("ButtonLooks.table.json"))
    const outcome: Record<string, string> = {}
    for (const [id, { props }] of Object.entries(cases.looks)) {
      const row = table.looks[id]
      if (!row) {
        outcome[id] = "not in B's table"
        continue
      }
      let got: unknown
      try {
        // a built node stands as its spec (the table's form), not an element
        got = translate(
          props,
          (spec) => ({ $spec: spec }) as unknown as React.ReactNode
        ).props
      } catch (error) {
        outcome[id] =
          `refused: ${String((error as Error).message).split("\n")[0]}`
        continue
      }
      outcome[id] =
        JSON.stringify(norm(got)) === JSON.stringify(norm(row.props))
          ? "equal"
          : `differs: ${JSON.stringify(norm(got))} where B has ${row.written}`
    }
    expect(Object.keys(outcome)).toHaveLength(72)
    expect(
      Object.entries(outcome).filter(([, verdict]) => verdict !== "equal")
    ).toEqual([])
  })
})
