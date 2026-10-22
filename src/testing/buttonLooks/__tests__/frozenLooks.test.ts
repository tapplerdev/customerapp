/**
 * The Button looks CA-W0-B proved, frozen.
 *
 * ../__fixtures__/ButtonLooks.cases.json (72 prop sets, 63 looks, harvested
 * from customerapp e30b19a's 51 ActionBtn elements) and ButtonLooks.table.json
 * (what ds Button was written with for each set, the translator's output as B
 * drew it beside a live ActionBtn) are the proof the converted screens' Buttons
 * stand on. Both are JSON: nothing here needs NativeWind, the translator
 * (../__fixtures__/translate.ts, which reads nw-resolve and tailwind.config.js)
 * or ActionBtn. table.pass1.test.ts runs the translator against them live
 * (`yarn test:pass1-tools`, and at archive/ca-pass1-tools after the flip);
 * this file keeps them from changing in `yarn test`: byte for byte, and one
 * row in the table for every set in the cases.
 */
import { describe, expect, it } from "@jest/globals"
import crypto from "crypto"
import fs from "fs"
import path from "path"

const FIXTURES = path.resolve(__dirname, "../__fixtures__")
const read = (name: string) =>
  fs.readFileSync(path.join(FIXTURES, name), "utf8")

type Cases = { looks: Record<string, { props: object; sites: string[] }> }
type Table = {
  looks: Record<string, { props: object; written: string; allow: string[] }>
}

describe("CA-W0-B's Button looks, frozen", () => {
  it("holds B's two files byte for byte", () => {
    const sha = (name: string) =>
      crypto.createHash("sha256").update(read(name)).digest("hex")
    expect(sha("ButtonLooks.cases.json")).toBe(
      "23c65cf467d878af0070acc0b7a7b56dc2ee042762f35dfb82168f042dfb43f2"
    )
    expect(sha("ButtonLooks.table.json")).toBe(
      "bfb928bcb6591ad780c12a92c184d0f8de9b9fcdf959642ffd36e96bf54bc615"
    )
  })

  it("has a table row, spelled as written, for each of the 72 prop sets and none besides", () => {
    const cases: Cases = JSON.parse(read("ButtonLooks.cases.json"))
    const table: Table = JSON.parse(read("ButtonLooks.table.json"))
    expect(Object.keys(cases.looks)).toHaveLength(72)
    expect(Object.keys(table.looks).sort()).toEqual(
      Object.keys(cases.looks).sort()
    )
    Object.entries(table.looks).forEach(([id, row]) => {
      expect({ id, spelled: row.written.length > 0 }).toEqual({
        id,
        spelled: true,
      })
      expect({ id, props: Object.keys(row.props).length > 0 }).toEqual({
        id,
        props: true,
      })
    })
  })
})
