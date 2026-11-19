/**
 * The Button looks CA-W0-B proved, frozen.
 *
 * ../__fixtures__/ButtonLooks.cases.json (72 prop sets, 63 looks, harvested
 * from customerapp e30b19a's 51 ActionBtn elements) and ButtonLooks.table.json
 * (what ds Button was written with for each set, the translator's output as B
 * drew it beside a live ActionBtn) are the proof the converted screens' Buttons
 * stand on. Both are JSON: nothing here needs NativeWind, the translator
 * (which read nw-resolve and tailwind.config.js) or ActionBtn. The
 * translator, the harvest and the live comparison (table.pass1.test.ts) were
 * deleted in W3.4 and live on at the archive tag archive/ca-pass1-tools; this
 * file keeps the two files from changing in `yarn test`: byte for byte, and
 * one row in the table for every set in the cases.
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
      "eca8b8b2cd63c14eac4bb7cf7412ecf38b82d2c0afc56400cbc4a1e68a558e74"
    )
    expect(sha("ButtonLooks.table.json")).toBe(
      "82e42fd98ade7e58347111684f3862ab1560baee50a53dc2a86f94f35edc1d20"
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
