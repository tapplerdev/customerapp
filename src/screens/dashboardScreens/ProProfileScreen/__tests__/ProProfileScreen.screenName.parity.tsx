/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import {
  openScreen,
  rowsByPlatform,
  wait,
  fireHost,
  type RenderScreenOptions,
  type Step,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { PRO_COMPANY, PRO_INDIVIDUAL } from "testing/screenKit/fixtures/entities"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"
import type { ProType } from "types/pro"

/*
 * ProProfileScreen's name for a menu service (snags #506, #6): the profile
 * heading, the header that fades in on scroll and the photo's initial show the
 * service's APPROVED screen name (GET /pros/:id?serviceCategoryId ->
 * serviceScreenName) instead of the business / registered name; with none
 * approved (null) or the field absent, today's name. ProProfileScreen.parity.tsx
 * keeps every row that has no such field, unchanged. These are captured from
 * the code that reads the field; each row also says which name is on screen.
 */

/*
 * #522 redrew the hero (the name on its own line, the account type in a grey
 * pill with the Featured sticker beside it, one red star and "x of 5 (N
 * Reviews)" or the no-reviews box, the OFFERS box; the collapsed header's
 * score is the one-star line too; the pill as tall as the Featured sticker,
 * 24pt), so every state that changed is drawn again under a "#522 profile
 * hero, pill as tall as Featured" name and captured beside the frozen ones,
 * which no row draws any more.
 */
const load = () => require("../ProProfileScreen")

const KITCHEN = "Sweet Day"
const shows = (tree: unknown, name: string) => JSON.stringify(tree).includes(name)

const company = (extra: Partial<ProType> = {}): ProType => ({
  ...PRO_COMPANY,
  workPhotos: [],
  documents: [],
  ...extra,
})
const individual = (extra: Partial<ProType> = {}): ProType => ({
  ...PRO_INDIVIDUAL,
  workPhotos: [],
  documents: [],
  ...extra,
})

const SIGNED = screenState("data")
const withPro = (pro: ProType): Omit<RenderScreenOptions, "lang" | "platform"> => ({
  ...SIGNED,
  api: { ...DATA, getProProfile: { data: pro } },
  http: () => ({ text: "<svg xmlns='http://www.w3.org/2000/svg'/>" }),
  route: { name: "ProProfileScreen", params: { ...ROUTE_PARAMS.ProProfileScreen } },
})
const scrollTo = (y: number): Step => (root) =>
  fireHost(root, "RCTScrollView", "onScroll", [{ nativeEvent: { contentOffset: { y } } }], { nth: 0 })

type Case = {
  state: string
  pro: ProType
  /** The name the row must draw, and the one it must not. */
  draws: string
  hides?: string
  steps?: Step[]
}
const CASES: Case[] = [
  { state: "a company with an approved screen name, #522 profile hero, pill as tall as Featured", pro: company({ serviceScreenName: KITCHEN }), draws: KITCHEN, hides: PRO_COMPANY.businessName },
  { state: "an individual with an approved screen name, #522 profile hero, pill as tall as Featured", pro: individual({ serviceScreenName: KITCHEN }), draws: KITCHEN, hides: PRO_INDIVIDUAL.registeredName },
  { state: "a screen name, no photo: its initial, #522 profile hero, pill as tall as Featured", pro: company({ serviceScreenName: KITCHEN, profilePhoto: undefined, profilePhoto150: undefined, profilePhoto720: undefined }), draws: KITCHEN, hides: PRO_COMPANY.businessName },
  { state: "a screen name, the header scrolled in, #522 profile hero, pill as tall as Featured", pro: company({ serviceScreenName: KITCHEN }), draws: KITCHEN, steps: [scrollTo(300), wait(300)] },
  { state: "none approved: the business name, #522 profile hero, pill as tall as Featured", pro: company({ serviceScreenName: null }), draws: PRO_COMPANY.businessName as string, hides: KITCHEN },
  { state: "none approved: the registered name, #522 profile hero, pill as tall as Featured", pro: individual({ serviceScreenName: null }), draws: PRO_INDIVIDUAL.registeredName, hides: KITCHEN },
  // A pro-level screenName (another kitchen's) never reaches this screen's name.
  { state: "another kitchen's pro-level screen name is ignored, #522 profile hero, pill as tall as Featured", pro: company({ screenName: "Other Kitchen", serviceScreenName: null }), draws: PRO_COMPANY.businessName as string, hides: "Other Kitchen" },
  { state: "a blank screen name falls back, #522 profile hero, pill as tall as Featured", pro: company({ serviceScreenName: "" }), draws: PRO_COMPANY.businessName as string },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("ProProfileScreen, the approved screen name", () => {
  it.each(rows)("$state [$env.language $env.platform]", async ({ state, pro, draws, hides, steps, env }) => {
    const session = await openScreen(load, {
      ...withPro(pro),
      lang: env.language,
      platform: env.platform,
    })
    try {
      for (const [index, step] of (steps ?? []).entries()) {
        // eslint-disable-next-line no-await-in-loop
        await session.act(() => step(session.root, env), 500, `step ${index + 1}`)
      }
      const tree = session.tree()
      expect(shows(tree, draws)).toBe(true)
      if (hides) expect(shows(tree, hides)).toBe(false)
      expectParity(parityName(state, env), tree)
    } finally {
      session.unmount()
    }
  })
})
