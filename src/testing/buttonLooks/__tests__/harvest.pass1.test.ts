/**
 * The ActionBtn look harvest (../harvest) over customerapp's src: every
 * site read with no rewrite (REWRITES is empty), and the looks keyed the way
 * the codemod keys them (scripts/ds-codemod/actionbtn.js lookKey), so the
 * looks proof and the codemod count the same 63. Then the translator's
 * verdict on each: which have a Button spelling today.
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

  it("translates all but five looks; those five are what Button can't spell yet", () => {
    const refused: Record<string, { looks: number; sites: string[] }> = {}
    for (const [key, where] of byKey) {
      const look = JSON.parse(key)
      try {
        translate({ title: "Button title", ...look }, () => null)
      } catch (error) {
        const why = String((error as Error).message).split("\n")[0]
        const entry = (refused[why] = refused[why] ?? { looks: 0, sites: [] })
        entry.looks += 1
        entry.sites = [...new Set([...entry.sites, ...where])].sort()
      }
    }
    expect(refused).toEqual({
      // no #E5E5E5 state fill: disabled, and disabled while saving
      "no Button variant for primary|bg-grey19": {
        looks: 2,
        sites: [
          "screens/dashboardScreens/AddNewAddressScreen/AddNewAddressScreen.tsx:234",
          "screens/dashboardScreens/ChangePasswordScreen/ChangePasswordScreen.tsx:167",
          "screens/dashboardScreens/MyInformationScreen/MyInformationScreen.tsx:160",
          "screens/dashboardScreens/UpdateEmailScreen/UpdateEmailScreen.tsx:164",
        ],
      },
      // no dim prop
      "no Button variant for primary|opacity-50": {
        looks: 1,
        sites: ["screens/dashboardScreens/FoodItemScreen/FoodItemScreen.tsx:385"],
      },
      // the caller's red over ActionBtn's grey, under the spinner
      "bg-red draws over ActionBtn's loading fill (the caller's classes come last), where Button draws its loading fill":
        {
          looks: 2,
          sites: [
            "screens/dashboardScreens/AddNewAddressScreen/AddNewAddressScreen.tsx:234",
            "screens/dashboardScreens/AuthGateScreen/GateRegisterScreen.tsx:222",
            "screens/onboardingScreens/RegisterScreen/RegisterScreen.tsx:326",
          ],
        },
    })
  })
})
