/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the probe is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import {
  BOTTOM_GAP_INSETS,
  copy,
  fields,
  only,
  openScreen,
  pressText,
  pressTitled,
  rowsByPlatform,
  treeAfter,
  typeInto,
  wait,
  type RenderScreenOptions,
  type Step,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import {
  PARITY_MATRIX,
  type HostNode,
  type ParityEnv,
} from "testing/hostTreeParity"

import en from "locales/en.json"
import ar from "locales/ar.json"

/*
 * The kit's press and type helpers (interact.ts, and treeAfter in index.ts),
 * on a probe of shared's components that writes down what it got.
 */

const probe = () => require("../__fixtures__/InteractProbe")

const text = (tree: HostNode | null, testID: string): string => {
  const find = (node: HostNode | string): HostNode | undefined => {
    if (typeof node === "string") return undefined
    if (node.props.testID === testID) return node
    for (const child of node.children) {
      const found = find(child)
      if (found) return found
    }
    return undefined
  }
  const node = tree ? find(tree) : undefined
  return (node?.children ?? []).join("")
}

const optionsFor = (env: ParityEnv): RenderScreenOptions => ({
  ...screenState("data"),
  lang: env.language,
  platform: env.platform,
  navigation: "none",
})

describe("copy", () => {
  const EN: ParityEnv = { language: "en" }
  const AR: ParityEnv = { language: "ar" }

  it("is the row's language, straight from the app's (flat) files", () => {
    expect(copy(EN, "save")).toBe(en.save)
    expect(copy(AR, "save")).toBe(ar.save)
    expect(copy(AR, "save")).not.toBe(copy(EN, "save"))
  })

  // customerapp's two files hold the same keys today, so the English
  // fallback i18next would take (fallbackLng "en") never runs; a key added
  // to en.json alone would take it.
  it("finds every English key in Arabic too, and throws on a key neither has", () => {
    expect(Object.keys(en).filter((key) => !(key in ar))).toEqual([])
    expect(() => copy(AR, "no_such_key_anywhere")).toThrow(
      'no string "no_such_key_anywhere" in ar.json or en.json'
    )
  })
})

describe("pressing and typing by what the customer sees", () => {
  const rows = rowsByPlatform([{}], PARITY_MATRIX)

  it.each(rows)(
    "presses a titled button and a link, types into two fields [$env.language $env.platform]",
    async ({ env }) => {
      const steps: Step[] = [
        (root) => typeInto(root, 0, "Mona"),
        (root) => typeInto(root, 1, "Giza"),
        (root, rowEnv) => pressTitled(root, copy(rowEnv, "save")),
        (root, rowEnv) => pressText(root, copy(rowEnv, "delete_account")),
      ]
      const tree = await treeAfter(probe, optionsFor(env), env, steps)
      expect(text(tree, "typed")).toBe("Mona|Giza|")
      expect(text(tree, "pressed")).toBe("save,link")
    }
  )

  it("types through the field's own TextInput, so its handler runs (Arabic digits become Latin)", async () => {
    const env: ParityEnv = { language: "ar", platform: "ios" }
    const tree = await treeAfter(probe, optionsFor(env), env, [
      (root) => typeInto(root, 2, "١٢٣"),
    ])
    expect(text(tree, "typed")).toBe("||123")
  })

  it("refuses what a customer can't do: a disabled or loading control, a field that isn't editable or that takes a press", async () => {
    const env: ParityEnv = { language: "en", platform: "ios" }
    const session = await openScreen(probe, optionsFor(env))
    try {
      const { root } = session
      for (const title of ["Locked", "Sending", "Pay"]) {
        expect(() => pressTitled(root, title)).toThrow(
          `press "${title}": it is disabled, so a tap does nothing`
        )
      }
      expect(() => typeInto(root, 3, "x")).toThrow(
        "type into field 3: its text input isn't editable"
      )
      expect(() => typeInto(root, 4, "x")).toThrow(
        "type into field 4: it draws 0 text inputs, expected 1"
      )
      // asked for, a disabled control's handler runs
      await session.act(() => {
        pressTitled(root, "Locked", { allowDisabled: true })
      })
      expect(text(session.tree(), "pressed")).toBe("locked")
    } finally {
      session.unmount()
    }
  })

  it("refuses a press a touchable on its way refuses: a link, a touchable, a row's own lock", async () => {
    const env: ParityEnv = { language: "en", platform: "ios" }
    const session = await openScreen(probe, optionsFor(env))
    try {
      const { root } = session
      const refused = (what: string) =>
        `press "${what}": it is disabled, so a tap does nothing`
      expect(() => pressText(root, "Disabled link")).toThrow(refused("Disabled link"))
      expect(() => pressText(root, "Disabled touch")).toThrow(refused("Disabled touch"))
      // the row says nothing of `disabled`; the touchable under its wrapper does
      expect(() => pressTitled(root, "Locked row")).toThrow(refused("Locked row"))
      // asked for, the handlers run
      await session.act(() => {
        pressText(root, "Disabled link", { allowDisabled: true })
        pressTitled(root, "Locked row", { allowDisabled: true })
      })
      expect(text(session.tree(), "pressed")).toBe("disabled link,locked")
    } finally {
      session.unmount()
    }
  })

  it("refuses words two controls show, unless the row picks one", async () => {
    const env: ParityEnv = { language: "en", platform: "ios" }
    const session = await openScreen(probe, optionsFor(env))
    try {
      const { root } = session
      expect(() => pressText(root, "Help")).toThrow(
        'press "Help": 2 controls show it (pass { nth } to pick one)'
      )
      expect(() => pressText(root, "Help", { nth: 2 })).toThrow(
        'press "Help": no control 2, only 2'
      )
      await session.act(() => {
        pressText(root, "Help", { nth: 1 })
      })
      expect(text(session.tree(), "pressed")).toBe("help 2")
    } finally {
      session.unmount()
    }
  })

  it("lets time pass with wait(ms), and only then", async () => {
    const env: ParityEnv = { language: "en", platform: "ios" }
    const before = await treeAfter(probe, optionsFor(env), env)
    expect(text(before, "timer")).toBe("timer waiting")
    const after = await treeAfter(probe, optionsFor(env), env, [wait(1500)])
    expect(text(after, "timer")).toBe("timer fired")
  })

  it("says what it couldn't find", async () => {
    const env: ParityEnv = { language: "en", platform: "ios" }
    const session = await openScreen(probe, optionsFor(env))
    try {
      const { root } = session
      // the five DmInputs, outermost first
      expect(fields(root)).toHaveLength(5)
      expect(() => typeInto(root, 5, "x")).toThrow(
        "type into field 5: only 5 fields"
      )
      expect(() => pressTitled(root, "Nowhere")).toThrow(
        'press "Nowhere": 0 matches, expected 1'
      )
      expect(() => pressText(root, "Nowhere")).toThrow(
        'press "Nowhere": no match'
      )
      expect(() =>
        only(root, (node) => typeof node.props.onChangeText === "function", "a field")
      ).toThrow("a field: 5 matches, expected 1")
    } finally {
      session.unmount()
    }
  })

  it("fails a step that hands act a promise that never settles, naming the step", async () => {
    const env: ParityEnv = { language: "en", platform: "ios" }
    await expect(
      treeAfter(probe, optionsFor(env), env, [
        (root) => typeInto(root, 0, "Mona"),
        () => new Promise<void>(() => undefined),
      ])
    ).rejects.toThrow(/pending after 1000 turns[^]*: treeAfter's step 2 of 2, /)
  })
})

it("BOTTOM_GAP_INSETS: no home indicator and one past the 45 threshold, beside each platform's default", () => {
  expect(BOTTOM_GAP_INSETS).toEqual([0, 48])
})
