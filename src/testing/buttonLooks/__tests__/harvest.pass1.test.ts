/**
 * No ActionBtn and no DmText left in customerapp's app code.
 *
 * This file pinned the ActionBtn count while the screens moved onto ds
 * Button: CA-W0-B harvested 51 elements in 38 files at e30b19a (frozen in
 * ../__fixtures__/ButtonLooks.cases.json), W1 converted 8, W2 the other 43,
 * so the pin reads none. What it holds now:
 *
 * 1. the harvest (../harvest, which reads ActionBtn's JSX elements) finds
 *    none, and no site is read through a rewrite;
 * 2. nothing in app code brings either one back in any spelling (../legacy
 *    Primitives: an alias, UI.ActionBtn, createElement, a re-export, a path
 *    import, a barrel taken whole), with a positive control for each spelling
 *    and a negative one for what is not, so a scan that goes blind fails here;
 * 3. every file B harvested an ActionBtn in is clean now, and B's looks, the
 *    ones the converted Buttons were written from, are still proved against
 *    the translator by table.pass1.test.ts (all 72 prop sets spelled as B's
 *    table does).
 *
 * src/testing, tests, mocks and fixtures are left out on purpose (the
 * controls and captures there build both on purpose); ds:ratchet counts the
 * same files and keeps DmText/ActionBtn and their imports at their baseline.
 */
import { describe, expect, it } from "@jest/globals"
import fs from "fs"
import path from "path"

import { harvestActionBtnLooks } from "../harvest"
import {
  appFiles,
  findLegacyPrimitives,
  legacyPrimitivesIn,
} from "../legacyPrimitives"
import { REWRITES } from "../rewrites"

const APP = path.resolve(__dirname, "../../../..")
const SRC = path.join(APP, "src")

type Frozen = { sites: { site: string; looks: number }[] }
const frozen: Frozen = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../__fixtures__/ButtonLooks.cases.json"),
    "utf8"
  )
)
const fileOf = (site: string) => site.replace(/:\d+$/, "")

const UI = "@tappler/shared/src/components/UI"
const SHARED_FILE = "../../../tappler-shared/src/components/UI"

// Each is one way to bring one in or draw one. A scan must find every one.
const SPELLINGS: Record<string, string> = {
  "a JSX element": `import { ActionBtn } from "${UI}"\nexport const A = () => <ActionBtn title="x" />`,
  "a DmText element": `import { DmText } from "${UI}"\nexport const A = () => <DmText>x</DmText>`,
  "an alias": `import { ActionBtn as Btn } from "${UI}"\nexport const A = () => <Btn />`,
  "a DmText alias": `import { DmText as T } from "${UI}"\nexport const A = () => <T />`,
  "a type-only import": `import type { ActionBtn } from "${UI}"\nexport type P = typeof ActionBtn`,
  "a member of a namespace": `import * as UI from "${UI}"\nexport const A = () => <UI.ActionBtn />`,
  "a member of a namespace, DmText": `import * as UI from "${UI}"\nexport const A = UI.DmText`,
  "a member by string": `import * as UI from "${UI}"\nexport const A = UI["ActionBtn"]`,
  "a member by joined strings": `import * as UI from "${UI}"\nexport const A = UI["Dm" + "Text"]`,
  "a namespace taken whole": `import * as UI from "${UI}"\nconst pick = (name: string) => (UI as any)[name]\nexport default pick`,
  "a default import of a barrel": `import UI from "${UI}"\nexport default UI`,
  "a root barrel": `import * as Shared from "@tappler/shared"\nexport default Shared`,
  "a relative barrel": `import * as UI from "${SHARED_FILE}"\nexport default UI`,
  "a renamed destructure": `import * as UI from "${UI}"\nconst { ActionBtn: B } = UI\nexport default B`,
  "a destructure of a require": `const { DmText: T } = require("${UI}")\nexport default T`,
  "a rest destructure of a require": `const { DmView, ...rest } = require("${UI}")\nexport default rest`,
  "a require taken whole": `const UI = require("${UI}")\nexport default UI`,
  "a require of its module": `const B = require("${UI}/ActionBtn").default\nexport default B`,
  "a member of a require": `export const B = require("${UI}").ActionBtn`,
  "a dynamic import of a barrel": `export const load = () => import("${UI}")`,
  "an import = require of a barrel": `import UI = require("${UI}")\nexport default UI`,
  "a default import of its module": `import Btn from "${UI}/ActionBtn"\nexport default Btn`,
  "a default import of its file": `import Btn from "${UI}/ActionBtn/ActionBtn"\nexport default Btn`,
  "a default import of DmText's file": `import T from "${SHARED_FILE}/DmText/DmText"\nexport default T`,
  "an import with an extension": `import T from "${UI}/DmText/DmText.tsx"\nexport default T`,
  createElement: `import React from "react"\nimport { DmText } from "${UI}"\nexport const A = () => React.createElement(DmText, null, "x")`,
  "createElement by name": `import React from "react"\nexport const A = () => React.createElement("DmText", null, "x")`,
  "jsx()": `import { jsx } from "react/jsx-runtime"\nimport { ActionBtn } from "${UI}"\nexport const A = () => jsx(ActionBtn, {})`,
  "a re-export": `export { ActionBtn } from "${UI}"`,
  "a re-export under a name": `export { DmText as Txt } from "${UI}"`,
  "a re-export of a default": `export { default as Btn } from "${UI}/ActionBtn"`,
  "an export * of a barrel": `export * from "${UI}"`,
  "an export * as of a barrel": `export * as UI from "${UI}"`,
  "an export * of its module": `export * from "${UI}/DmText"`,
  "an export of a value": `import { DmText } from "${UI}"\nexport const Txt = DmText`,
  "an export default": `import { DmText } from "${UI}"\nexport default DmText`,
  "a memo": `import React from "react"\nimport { DmText } from "${UI}"\nexport const T = React.memo(DmText)`,
}

// What is not one: nothing here may be found.
const INNOCENT: Record<string, string> = {
  "a comment": `// ActionBtn and DmText used to be here\n/* <DmText> */\nexport const x = 1`,
  "a doc comment": `/** matches DmText's text-left */\nexport const x = 1`,
  "a sentence in a string": `export const x = "Press the ActionBtn, then DmText"`,
  "a longer name": `export const DmTextInput = 1\nexport const ActionBtnSmallish = 2`,
  "the barrel's other members": `import { DmView, DmInput } from "${UI}"\nexport const A = () => <DmView />`,
  "a destructure of other members": `const { DmView } = require("${UI}")\nexport default DmView`,
  "a member of a require, another": `export const V = require("${UI}").DmView`,
  "ds Button and Text": `import { Button, Text } from "@tappler/shared/src/ds"\nexport const A = () => <Button title="x" />`,
  "another module": `import x from "../DmTextual/x"\nexport default x`,
  "an unrelated string join": `export const x = "Dm" + "View"`,
}

describe("no ActionBtn or DmText left in customerapp's app code", () => {
  it("scans the app's own files, and only those", () => {
    const files = appFiles(APP)
    // a scan over nothing finds nothing: it must have read the whole app
    expect(files.length).toBeGreaterThan(200)
    expect(files).toContain(
      "src/screens/dashboardScreens/AuthGateScreen/AuthGateScreen.tsx"
    )
    expect(files).toContain("src/components/scroll/index.tsx")
    expect(files).toContain("index.js")
    expect(
      files.filter(
        (file) =>
          file.startsWith("src/testing/") ||
          /(^|\/)(__tests__|__mocks__|__fixtures__)\//.test(file) ||
          /\.(test|spec)\.[jt]sx?$/.test(file)
      )
    ).toEqual([])
  })

  it("finds neither one, under any spelling, in any of them", () => {
    expect(legacyPrimitivesIn(APP)).toEqual([])
  })

  it.each(Object.entries(SPELLINGS))("sees %s", (_name, source) => {
    expect(findLegacyPrimitives(source, "Case.tsx")).not.toEqual([])
  })

  it.each(Object.entries(INNOCENT))("leaves alone %s", (_name, source) => {
    expect(findLegacyPrimitives(source, "Case.tsx")).toEqual([])
  })

  it("reads a .ts and a .js file as the language they are", () => {
    // a type assertion is a syntax error read as TSX; a JS file has none
    expect(
      findLegacyPrimitives(`const a = <any>5\nexport default a`, "x.ts")
    ).toEqual([])
    expect(
      findLegacyPrimitives(
        `const { ActionBtn } = require("${UI}")\nmodule.exports = ActionBtn`,
        "x.js"
      )
    ).not.toEqual([])
  })

  it("has no ActionBtn element for the harvest to read, through no rewrite", () => {
    expect(REWRITES).toEqual({})
    const { harvest, sites } = harvestActionBtnLooks(SRC)
    expect(sites).toEqual([])
    expect(harvest.elements).toBe(0)
    expect(harvest.files).toBe(0)
    expect(harvest.looks).toEqual({})
  })

  it("is clean in every file B harvested an ActionBtn in at e30b19a", () => {
    // B's 51 elements in 38 files (frozen), all converted: W1 took 8, W2 the 43
    const files = [...new Set(frozen.sites.map(({ site }) => fileOf(site)))]
    expect(frozen.sites).toHaveLength(51)
    expect(files).toHaveLength(38)
    const dirty = files.filter((file) => {
      const full = path.join(SRC, file)
      // a file that was deleted or renamed has none either
      return (
        fs.existsSync(full) &&
        findLegacyPrimitives(fs.readFileSync(full, "utf8"), file).length > 0
      )
    })
    expect(dirty).toEqual([])
  })
})
