/**
 * The ratcheted lint warnings (scripts/lint-ratchet-rules.js): what each
 * selector flags on a sample, which files .eslintrc.js applies them to, and
 * how scripts/lint-ratchet.js compares counts with the baseline.
 */
const path = require("path")
const { ESLint } = require("eslint")
const { ratcheted, selectorsFor } = require("../lint-ratchet-rules")
const { compare } = require("../lint-ratchet")

const ROOT = path.resolve(__dirname, "..", "..")

const SAMPLE = `
import { Alert, Text } from "react-native"
import { dsColors } from "styles/dsColors"
import other from "../../styles/dsColors"

export const a = () => Alert.alert("x")
export const b = <Text style={{ color: "#fff", backgroundColor: "rgba(0,0,0,0.5)" }}>{"#hashtag"}</Text>
export const c = ["#12345678", "rgb(1,2,3)", "#1234567890", "red"]
export const d = dsColors && other
`

const keyOf = new Map(ratcheted.map(({ message, key }) => [message, key]))

// The ratcheted warnings on SAMPLE as "line:key", with only these selectors.
const flag = async (options) => {
  const eslint = new ESLint({
    cwd: ROOT,
    useEslintrc: false,
    ignore: false,
    overrideConfig: {
      parser: "@typescript-eslint/parser",
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: "module" },
      rules: { "no-restricted-syntax": ["warn", ...selectorsFor(options)] },
    },
  })
  const [result] = await eslint.lintText(SAMPLE, {
    filePath: path.join(ROOT, "src", "Sample.tsx"),
  })

  return result.messages.map((m) => `${m.line}:${keyOf.get(m.message)}`)
}

// The selectors .eslintrc.js gives a file, by ratchet key.
const keysFor = async (file) => {
  const config = await new ESLint({ cwd: ROOT }).calculateConfigForFile(
    path.join(ROOT, file)
  )
  const [severity, ...entries] = config.rules["no-restricted-syntax"]

  // An override that only turns the rule off keeps its options.
  if (severity === "off" || severity === 0) return []

  return [
    ...new Set(
      entries.map((e) => keyOf.get(e.message)).filter((key) => key != null)
    ),
  ].sort()
}

describe("the ratcheted selectors", () => {
  it("in .tsx: Alert.alert, both dsColors imports, hex and rgb(a) colours", async () => {
    expect(await flag({ tsx: true })).toEqual([
      "3:dsColorsImport",
      "4:dsColorsImport",
      "6:alert",
      "7:colourLiteral",
      "7:colourLiteral",
      "8:colourLiteral",
      "8:colourLiteral",
    ])
  })

  it("leave colours alone outside .tsx", async () => {
    expect(await flag({ tsx: false })).toEqual([
      "3:dsColorsImport",
      "4:dsColorsImport",
      "6:alert",
    ])
  })

  it("leave out the keys a file is excepted from", async () => {
    expect(await flag({ tsx: true, except: ["alert"] })).not.toContain(
      "6:alert"
    )
  })
})

describe(".eslintrc.js", () => {
  it("applies all of them to app .tsx", async () => {
    expect(await keysFor("src/App.tsx")).toEqual([
      "alert",
      "colourLiteral",
      "dsColorsImport",
    ])
  })

  it("lets openPermissionAlert call Alert.alert", async () => {
    expect(await keysFor("src/utils/openPermissionAlert.ts")).toEqual([
      "dsColorsImport",
    ])
  })

  it("applies none to tests", async () => {
    expect(await keysFor("src/screens/Some/__tests__/Some.test.tsx")).toEqual(
      []
    )
  })
})

describe("the comparison", () => {
  const baseline = { alert: 46, dsColorsImport: 24, colourLiteral: 115 }

  it("passes when nothing moved", () => {
    expect(compare(baseline, { ...baseline })).toEqual([])
  })

  it("fails a rise", () => {
    expect(compare(baseline, { ...baseline, alert: 47 })).toEqual([
      "alert: 47, up from 46. Fix the new one.",
    ])
  })

  it("fails a fall until the baseline is lowered", () => {
    expect(compare(baseline, { ...baseline, colourLiteral: 110 })).toEqual([
      "colourLiteral: 110, down from 115. Run `yarn lint:ratchet --update` " +
        "and commit the baseline to lock it in.",
    ])
  })
})
