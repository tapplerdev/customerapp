/**
 * No ActionBtn and no DmText left in customerapp's app code, in any spelling.
 *
 * Restored from archive/ca-pass1-tools (F1 of review-ca-w3): W3.4 deleted
 * this scan with the ActionBtn harvest it sat beside, but it reads the AST
 * and needs no NativeWind, so it runs in `yarn test` again. It is the only
 * check that sees a DmText or ActionBtn in a state no kit row draws (the class
 * guard sees drawn states only), and it is stricter than the ratchet's
 * primitives/primitiveImport counts: the review fed the old SPELLINGS table
 * to the ratchet and 15 of 37 got past it. What it holds:
 *
 * 1. nothing in app code brings either one back in any spelling (../legacy
 *    Primitives: an alias, UI.ActionBtn, createElement, a re-export, a path
 *    import, a barrel taken whole), with a positive control for each spelling
 *    and a negative one for what is not, so a scan that goes blind fails here;
 * 2. the gaps review-ca-w2's L2 listed are shut: a barrel spelled with a
 *    trailing `/` or `/index.ts`, and a computed-key destructure;
 * 3. the nine escapes review-ca-w3 planted in AboutAppScreen (S1-S5, S7, S9,
 *    S15, S16) each fail it, S5 and S7 across two files;
 * 4. an app file that imports from src/testing or a __fixtures__ folder
 *    (which the scan leaves out) counts, whatever it is imported as.
 *
 * src/testing, tests, mocks and fixtures are left out on purpose (the
 * controls and captures there build both on purpose); ds:ratchet counts the
 * same files and keeps DmText/ActionBtn and their imports at their baseline.
 */
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals"
import fs from "fs"
import os from "os"
import path from "path"

import {
  appFiles,
  findLegacyPrimitives,
  legacyPrimitivesIn,
} from "../legacyPrimitives"

const APP = path.resolve(__dirname, "../../../..")

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


// The ways round review-ca-w2's L2 named, and the barrel's other spellings.
const BARREL_SPELLINGS: Record<string, string> = {
  "a namespace of the barrel with a trailing slash": `import * as UI from "${UI}/"\nconst pick = (name: string) => (UI as any)[name]\nexport default pick`,
  "a namespace of the barrel's /index.ts": `import * as UI from "${UI}/index.ts"\nconst pick = (name: string) => (UI as any)[name]\nexport default pick`,
  "a namespace of the barrel's /index": `import * as UI from "${UI}/index"\nexport default UI`,
  "a namespace of the barrel's /index.js": `import * as UI from "${UI}/index.js"\nexport default UI`,
  "a default import of the barrel with a trailing slash": `import UI from "${UI}/"\nexport default UI`,
  "a relative barrel with a trailing slash": `import * as UI from "${SHARED_FILE}/"\nexport default UI`,
  "a relative barrel's /index.tsx": `import * as UI from "${SHARED_FILE}/index.tsx"\nexport default UI`,
  "the root barrel's /index.ts": `import * as Shared from "@tappler/shared/index.ts"\nexport default Shared`,
  "the components barrel with a trailing slash": `import * as C from "@tappler/shared/src/components/"\nexport default C`,
  "a barrel with doubled slashes": `import * as UI from "@tappler/shared/src/components//UI"\nexport default UI`,
  "a barrel with a ./ segment": `import * as UI from "@tappler/shared/src/components/./UI"\nexport default UI`,
  "an export * of a barrel with a trailing slash": `export * from "${UI}/"`,
  "an export * as of the barrel's /index.ts": `export * as UI from "${UI}/index.ts"`,
  "a require of a barrel with a trailing slash": `const UI = require("${UI}/")\nexport default UI`,
  "a require of the barrel's /index.ts": `const UI = require("${UI}/index.ts")\nexport default UI`,
  "a dynamic import of a barrel with a trailing slash": `export const load = () => import("${UI}/")`,
  "an import = require of the barrel's /index.ts": `import UI = require("${UI}/index.ts")\nexport default UI`,
  // the key is opaque (no "DmText" in the file): only the destructure shows it
  "a computed-key destructure of a require": `const k = String(Math.random())\nconst { [k]: X } = require("${UI}")\nexport default X`,
  "a computed-key destructure of a require with a trailing slash": `declare const k: string\nconst { [k]: X } = require("${UI}/")\nexport default X`,
  "a computed-key destructure of the barrel's /index.ts": `declare const k: string\nconst { [k]: X } = require("${UI}/index.ts")\nexport default X`,
  "a computed-key destructure among named keys": `declare const k: string\nconst { DmView, [k]: X } = require("${UI}")\nexport default X`,
  "a template-keyed computed destructure": `declare const k: string\nconst { [\`${"${k}"}\`]: X } = require("${UI}")\nexport default X`,
  "a computed-key destructure of a require, the key named": `const k = "DmText"\nconst { [k]: X } = require("${UI}")\nexport default X`,
  "a string-keyed computed destructure": `const { ["Dm" + "Text"]: X } = require("${UI}")\nexport default X`,
}

// The nine escapes review-ca-w3 planted in AboutAppScreen (mutants S1-S5,
// S7, S9, S15, S16). Single-file ones are sources; S5 and S7 are two files
// each and run through an app tree below.
const ESCAPES: Record<string, string> = {
  "S1 a namespace of the barrel with a trailing slash": `import * as UI from "${UI}/"\nexport const A = () => <UI.DmText>x</UI.DmText>`,
  "S2 a require of the barrel, rendered by member": `const UIR = require("${UI}")\nexport const A = () => <UIR.DmText>x</UIR.DmText>`,
  "S3 a string member of a namespace": `import * as UI from "${UI}"\nconst T = UI["DmText"]\nexport const A = () => <T>x</T>`,
  "S4 a joined-string member of a namespace": `import * as UI from "${UI}"\nconst T = (UI as any)["Dm" + "Text"]\nexport const A = () => <T>x</T>`,
  "S9 a computed-key destructure of a require (ActionBtn)": `const k = "ActionBtn"\nconst { [k]: B } = require("${UI}")\nexport const A = () => <B title="x" onPress={() => {}} />`,
  "S9 the same, the key not in the file": `declare const k: string\nconst { [k]: B } = require("${UI}")\nexport const A = () => <B title="x" onPress={() => {}} />`,
  "S15 an alias from the barrel with a trailing slash": `import { DmText as L } from "${UI}/"\nexport const A = () => <L>x</L>`,
  "S16 a lazy dynamic import of the barrel": `import React from "react"\nexport const LazyT = React.lazy(() => import("${UI}").then((m) => ({ default: m.DmText })))`,
}

// An app file that reaches into a place the scan leaves out. From
// src/screens/area/Screen.tsx.
const OUT_OF_SCAN: Record<string, string> = {
  "a module-resolver path into src/testing": `import { Label } from "testing/labels"\nexport const A = Label`,
  "a relative path into src/testing": `import { Label } from "../../testing/labels"\nexport const A = Label`,
  "src/testing spelled out": `import { Label } from "src/testing/labels"\nexport const A = Label`,
  "a require of src/testing": `export const A = require("testing/labels").Label`,
  "a dynamic import of src/testing": `export const load = () => import("testing/labels")`,
  "a re-export from src/testing": `export { Label } from "testing/labels"`,
  "an export * from src/testing": `export * from "../../testing/labels"`,
  "src/testing itself": `import * as T from "testing"\nexport default T`,
  "a sibling __fixtures__": `import Extra from "./__fixtures__/Extra"\nexport const A = Extra`,
  "a __fixtures__ from src": `import Extra from "screens/area/__fixtures__/Extra"\nexport const A = Extra`,
  "a __mocks__": `import Extra from "./__mocks__/Extra"\nexport const A = Extra`,
  "a __tests__ helper": `import Extra from "../__tests__/helpers"\nexport const A = Extra`,
}

const OUT_OF_SCAN_INNOCENT: Record<string, string> = {
  "a testing folder that is not src/testing": `import { x } from "components/testing/x"\nexport const A = x`,
  "a relative testing folder under components": `import { x } from "../../components/testing/x"\nexport const A = x`,
  "a name that starts with testing": `import { x } from "testingTools/x"\nexport const A = x`,
  "a package": `import React from "react"\nexport const A = React`,
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
})

describe("the barrel, however it is spelled (review-ca-w2 L2)", () => {
  it.each(Object.entries(BARREL_SPELLINGS))("sees %s", (_name, source) => {
    expect(findLegacyPrimitives(source, "Case.tsx")).not.toEqual([])
  })

  it("still reads named members of a barrel by their names", () => {
    const named = [
      `import { DmView } from "${UI}/"\nexport default DmView`,
      `const { DmView } = require("${UI}/index.ts")\nexport default DmView`,
      `const { DmView: V, DmInput } = require("${UI}")\nexport default [V, DmInput]`,
      `export const V = require("${UI}/").DmView`,
    ]
    named.forEach((source) =>
      expect(findLegacyPrimitives(source, "Case.tsx")).toEqual([])
    )
  })
})

describe("the escapes review-ca-w3 planted (S1-S5, S7, S9, S15, S16)", () => {
  it.each(Object.entries(ESCAPES))("fails on %s", (_name, source) => {
    expect(findLegacyPrimitives(source, "AboutAppScreen.tsx")).not.toEqual([])
  })

  describe("the two that run across files", () => {
    let dir: string
    const write = (file: string, text: string) => {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      fs.writeFileSync(path.join(dir, file), text)
    }
    beforeAll(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "legacy-primitives-"))
    })
    afterAll(() => {
      fs.rmSync(dir, { recursive: true, force: true })
    })

    it("S5 fails: src/testing re-exports DmText and a screen renders it", () => {
      // src/testing is out of the scan, so only the screen's import can show it
      write("src/testing/labels.ts", `export { DmText as Label } from "${UI}"\n`)
      write(
        "src/screens/AboutAppScreen.tsx",
        `import { Label } from "testing/labels"\nexport const A = () => <Label>x</Label>\n`
      )
      const found = legacyPrimitivesIn(dir)
      expect(found).toHaveLength(1)
      expect(found[0]).toMatch(
        /^src\/screens\/AboutAppScreen\.tsx:1 the out-of-scan module "testing\/labels"/
      )
    })

    it("S7 fails: an app file hands the namespace on and a screen renders a member", () => {
      write(
        "src/components/uiNs.ts",
        `import * as UI from "${UI}"\nexport default UI\n`
      )
      write(
        "src/screens/Other.tsx",
        `import NS from "components/uiNs"\nexport const A = () => <NS.DmText>x</NS.DmText>\n`
      )
      expect(legacyPrimitivesIn(dir)).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /^src\/components\/uiNs\.ts:1 a namespace import of the barrel/
          ),
        ])
      )
    })
  })
})

describe("an app file reaching into what the scan leaves out", () => {
  it.each(Object.entries(OUT_OF_SCAN))("sees %s", (_name, source) => {
    const hits = findLegacyPrimitives(source, "src/screens/area/Screen.tsx")
    expect(hits.some((line) => /the out-of-scan module/.test(line))).toBe(true)
  })

  it.each(Object.entries(OUT_OF_SCAN_INNOCENT))(
    "leaves alone %s",
    (_name, source) => {
      expect(
        findLegacyPrimitives(source, "src/screens/area/Screen.tsx")
      ).toEqual([])
    }
  )

  it("resolves a relative path from the importing file", () => {
    // ../testing from src/screens/Screen.tsx is src/testing; from
    // src/screens/area/Screen.tsx it is src/screens/testing, which is the app's
    const source = `import { x } from "../testing/x"\nexport const A = x`
    expect(findLegacyPrimitives(source, "src/screens/Screen.tsx")).not.toEqual(
      []
    )
    expect(
      findLegacyPrimitives(source, "src/screens/area/Screen.tsx")
    ).toEqual([])
  })
})
