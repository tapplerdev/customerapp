/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen and its mutants are passed as loaders. */
import { describe, expect, it } from "@jest/globals"

import {
  pressTitled,
  rowsByPlatform,
  treeAfter,
  type Step,
} from "testing/screenKit"
import { freshInstallState } from "testing/screenKit/states"
import {
  PARITY_MATRIX,
  captureMode,
  expectParity,
  parityName,
  type ParityAllowance,
  type ParityEnv,
} from "testing/hostTreeParity"

/*
 * The checker, proved on a real customer screen: WelcomeScreen (the language
 * picker a fresh install opens on), captured from the unconverted code in
 * every row of PARITY_MATRIX, as it opens and after each language button is
 * pressed. Its source was e30b19a's when the fixture was captured, and so
 * was everything it draws; the screen drawn here is the converted one
 * (ds Text and Button), which draws the same rows.
 *
 * Then five copies of the converted file, each with one change, compared
 * with that fixture (__fixtures__/WelcomeScreen/): a margin, a colour, a
 * value only Arabic draws (an RTL branch), a dropped onPress, and an onPress
 * that does nothing. Each must fail where its change draws, and only there:
 * the Arabic-only change passes the English rows, the do-nothing handler
 * passes every row until the button is pressed. (They were copies of the
 * unconverted file until W3.1; they drew through NativeWind then, and
 * archive/ca-pass1-tools still has them.)
 *
 * The real screen's rows allow Button's two listed deltas (on a Button's
 * root only), which the converted screen's Buttons need.
 */

const WELCOME = () =>
  require("screens/onboardingScreens/WelcomeScreen/WelcomeScreen")
const mutant = (name: string) => () =>
  require(`../__fixtures__/WelcomeScreen/${name}`)

const ALLOW: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

type Case = { state: string; steps?: Step[] }

const pressEnglish: Step = (root) => pressTitled(root, "English")
const pressArabic: Step = (root) => pressTitled(root, "عربي")

const CASES: Case[] = [
  { state: "the language picker" },
  { state: "English pressed", steps: [pressEnglish] },
  { state: "Arabic pressed", steps: [pressArabic] },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

const render = (load: () => unknown, env: ParityEnv, steps: Step[] = []) =>
  treeAfter(
    load,
    {
      ...freshInstallState(),
      lang: env.language,
      platform: env.platform,
      route: { name: "WelcomeScreen" },
    },
    env,
    steps
  )

describe("WelcomeScreen, captured from the unconverted code", () => {
  it.each(rows)(
    "$state [$env.language $env.platform]",
    async ({ state, steps, env }) => {
      expectParity(parityName(state, env), await render(WELCOME, env, steps), {
        allow: ALLOW,
      })
    }
  )
})

const compareOnly = captureMode() === "compare" ? describe : describe.skip
const picker = (env: ParityEnv) => parityName("the language picker", env)
const envs = rowsByPlatform([{}], PARITY_MATRIX)

compareOnly("each mutant fails where its change draws", () => {
  it.each(envs)(
    "a margin: the second title's 12 for 11 [$env.language $env.platform]",
    async ({ env }) => {
      const tree = await render(mutant("margin"), env)
      expect(() => expectParity(picker(env), tree, { allow: ALLOW })).toThrow(
        /marginTop/
      )
    }
  )

  it.each(envs)(
    "a colour: the footnote red for grey [$env.language $env.platform]",
    async ({ env }) => {
      const tree = await render(mutant("colour"), env)
      expect(() => expectParity(picker(env), tree, { allow: ALLOW })).toThrow(
        /color/
      )
    }
  )

  it.each(envs)(
    "an Arabic-only value: the RTL branch's margin, which only Arabic rows draw [$env.language $env.platform]",
    async ({ env }) => {
      const tree = await render(mutant("arabicOnly"), env)
      const compare = () =>
        expectParity(picker(env), tree, { allow: ALLOW })
      if (env.language === "ar") {
        expect(compare).toThrow(/marginLeft/)
      } else {
        expect(compare).not.toThrow()
      }
    }
  )

  it.each(envs)(
    "a dropped onPress: the button draws another host, and a customer can't press it [$env.language $env.platform]",
    async ({ env }) => {
      const tree = await render(mutant("droppedOnPress"), env)
      expect(() => expectParity(picker(env), tree, { allow: ALLOW })).toThrow()
      await expect(
        render(mutant("droppedOnPress"), env, [pressEnglish])
      ).rejects.toThrow('press "English": 0 matches, expected 1')
    }
  )

  it.each(envs)(
    "an onPress that does nothing: the same tree until the press, then not [$env.language $env.platform]",
    async ({ env }) => {
      const idle = await render(mutant("neuteredHandler"), env)
      expectParity(picker(env), idle, { allow: ALLOW })
      const pressed = await render(mutant("neuteredHandler"), env, [
        pressEnglish,
      ])
      expect(() =>
        expectParity(parityName("English pressed", env), pressed, {
          allow: ALLOW,
        })
      ).toThrow()
    }
  )
})

describe("what the rows drew", () => {
  it("the picker shows both languages; a press covers it with the loading overlay", async () => {
    const env: ParityEnv = { language: "en", platform: "ios" }
    const idle = JSON.stringify(await render(WELCOME, env))
    const pressed = JSON.stringify(await render(WELCOME, env, [pressEnglish]))
    expect(idle).toContain("Please Select Your Language")
    expect(idle).toContain("عربي")
    expect(pressed).not.toContain("Please Select Your Language")
  })
})
