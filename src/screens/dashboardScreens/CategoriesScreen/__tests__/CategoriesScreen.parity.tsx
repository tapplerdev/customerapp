/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
  rowsByPlatform,
  treeAfter,
  typeInto,
  wait,
  type RenderScreenOptions,
  type Step,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA, urlOf } from "testing/screenKit/fixtures/api"
import {
  CATEGORY,
  SERVICE,
  SERVICES,
  some,
} from "testing/screenKit/fixtures/entities"
import { pressContaining } from "testing/pressContaining"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"
import type { ServiceType } from "types/cms"

/*
 * CategoriesScreen (the search for a service), captured from the unconverted
 * code: the list of services, loading (the skeleton), a server error (an
 * empty list), nothing published, and a search typed (after its 300 ms
 * debounce): a service that matches, a sub-category that matches, both, no
 * match, and the round trip still in flight (the skeleton again). Then the
 * presses: a service row, a sub-category result (it opens the address sheet
 * in place; its rows send the customer on), the back chevron and the clear X.
 */

const load = () => require("../CategoriesScreen")

/** A service with several categories, one with long Arabic text. */
const WIDE: ServiceType = {
  id: 203,
  nameEn: "Cleaning and household help",
  nameAr: "التنظيف والمساعدة المنزلية الطويلة جدا في اسمها",
  categories: [
    some({
      id: 3031,
      nameEn: "Deep cleaning",
      nameAr: "تنظيف عميق",
      serviceId: 203,
      keywords: "dust sparkle",
      placeOfService: ["customerPlace"],
    }),
    some({
      id: 3032,
      nameEn: "Online home-organising consultation",
      nameAr: "استشارة تنظيم المنزل عبر الإنترنت",
      serviceId: 203,
      placeOfService: ["remoteOrOnline"],
    }),
  ],
}

const WITH_WIDE = {
  getServices: {
    data: {
      data: [...SERVICES, WIDE],
      page: 1,
      perPage: 100,
      total: 3,
    },
  },
}

const typed = (text: string): Step[] => [
  (root) => typeInto(root, 0, text),
  wait(400),
]

type Case = {
  state: string
  options: Omit<RenderScreenOptions, "lang" | "platform">
  steps?: Step[]
}

const SIGNED = screenState("data")

const CASES: Case[] = [
  { state: "the services", options: SIGNED },
  { state: "the services, a wide one", options: { ...SIGNED, api: { ...DATA, ...WITH_WIDE } } },
  { state: "loading", options: screenState("loading") },
  // A failed list and an empty one draw the same: no results (the screen
  // doesn't tell them apart), and a guest's list is a signed-in one's.
  { state: "a server error or nothing published", options: screenState("error") },
  {
    state: "search: a service matches",
    options: { ...SIGNED, api: { ...DATA, ...WITH_WIDE } },
    steps: typed("clean"),
  },
  {
    state: "search: a sub-category matches",
    options: { ...SIGNED, api: { ...DATA, ...WITH_WIDE } },
    steps: typed("plumbing"),
  },
  {
    state: "search: a keyword matches",
    options: { ...SIGNED, api: { ...DATA, ...WITH_WIDE } },
    steps: typed("SPARKLE"),
  },
  {
    state: "search: a service and a sub-category match",
    options: SIGNED,
    steps: typed("home"),
  },
  { state: "search: nothing matches", options: SIGNED, steps: typed("zzz") },
  {
    state: "search: the answer is still on its way",
    options: {
      ...SIGNED,
      api: {
        ...DATA,
        getServices: (args) =>
          urlOf(args).includes("search=") ? "loading" : DATA.getServices as never,
      },
    },
    steps: typed("home"),
  },
  {
    state: "typed but not yet searched (the clear X shows)",
    options: SIGNED,
    steps: [(root) => typeInto(root, 0, "pl")],
  },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("CategoriesScreen, captured from the unconverted code", () => {
  it.each(rows)(
    "$state [$env.language $env.platform]",
    async ({ state, options, steps, env }) => {
      const tree = await treeAfter(
        load,
        {
          ...options,
          lang: env.language,
          platform: env.platform,
          route: { name: "CategoriesScreen" },
        },
        env,
        steps
      )
      expectParity(parityName(state, env), tree)
    }
  )
})

describe.each(PARITY_MATRIX)(
  "CategoriesScreen presses [$language $platform]",
  (env: ParityEnv) => {
    const open = (options: RenderScreenOptions = {}) =>
      openScreen(load, {
        ...SIGNED,
        ...options,
        lang: env.language,
        platform: env.platform,
        route: { name: "CategoriesScreen" },
      })
    type Session = Awaited<ReturnType<typeof open>>
    const act = (session: Session, press: () => void) =>
      session.act(() => {
        press()
      })
    const navigated = (session: Session) =>
      session.navigation.actions.map((action) => ({
        type: action.type,
        ...(action.payload as object),
      }))
    const name = (service: { nameEn?: string; nameAr?: string }) =>
      env.language === "ar" ? service.nameAr! : service.nameEn!

    it("a service row opens its sub-categories", async () => {
      const session = await open()
      try {
        await act(session, () => pressText(session.root, name(SERVICE)))
        expect(navigated(session)).toEqual([
          expect.objectContaining({
            name: "SubCategoriesScreen",
            params: { service: expect.objectContaining({ id: SERVICE.id }) },
          }),
        ])
      } finally {
        session.unmount()
      }
    })

    it("a sub-category result opens the address sheet, and its rows go to the results", async () => {
      const session = await open()
      try {
        await act(session, () => typeInto(session.root, 0, "plumbing"))
        await session.settle(400)
        expect(JSON.stringify(session.tree())).not.toContain("last_used")
        await act(session, () => pressText(session.root, name(CATEGORY)))
        // The sheet is up: the saved addresses are on offer.
        expect(JSON.stringify(session.tree())).toContain("12 Tahrir Street")
        await act(session, () => pressContaining(session.root, "12 Tahrir Street"))
        expect(navigated(session)).toEqual([
          expect.objectContaining({
            name: "SearchAnimationScreen",
            params: {
              nextParams: expect.objectContaining({
                categoryId: CATEGORY.id,
                serviceId: SERVICE.id,
                categoryName: name(CATEGORY),
              }),
            },
          }),
        ])
      } finally {
        session.unmount()
      }
    })

    it("the back chevron goes back and the clear X empties the search", async () => {
      const session = await open()
      try {
        await act(session, () => pressIcon(session.root, { icon: "svg:chevron-left", nth: 0 }))
        expect(navigated(session)).toEqual([
          expect.objectContaining({ type: "GO_BACK" }),
        ])
        await act(session, () => typeInto(session.root, 0, "zzz"))
        await session.settle(400)
        expect(JSON.stringify(session.tree())).toContain(copy(env, "no_results_found"))
        await act(session, () => pressIcon(session.root, { icon: "svg:close" }))
        await session.settle(400)
        const tree = JSON.stringify(session.tree())
        expect(tree).not.toContain(copy(env, "no_results_found"))
        expect(tree).toContain(name(SERVICE))
      } finally {
        session.unmount()
      }
    })
  }
)

describe("what the search rows drew", () => {
  const draw = async (steps: Step[], api = DATA) => {
    const env: ParityEnv = { language: "en", platform: "ios" }
    return JSON.stringify(
      await treeAfter(
        load,
        {
          ...SIGNED,
          api: { ...api, ...WITH_WIDE },
          lang: env.language,
          platform: env.platform,
          route: { name: "CategoriesScreen" },
        },
        env,
        steps
      )
    )
  }

  it("a service match lists the service; a sub-category match its category; a keyword its category", async () => {
    const service = await draw(typed("clean"))
    expect(service).toContain("Cleaning and household help")
    expect(service).not.toContain("Plumbing")
    const sub = await draw(typed("plumbing"))
    expect(sub).toContain("Plumbing")
    expect(sub).not.toContain("Cleaning and household help")
    const keyword = await draw(typed("SPARKLE"))
    expect(keyword).toContain("Deep cleaning")
    expect(keyword).not.toContain("Plumbing")
    const both = await draw(typed("home"))
    expect(both).toContain("Home repairs")
    expect(both).toContain("Home-cooked meals")
  })

  it("no match says so, and the unfiltered list has every service", async () => {
    expect(await draw(typed("zzz"))).toContain("No results found")
    const all = await draw([])
    for (const words of ["Home repairs", "Food", "Cleaning and household help"]) {
      expect(all).toContain(words)
    }
  })
})
