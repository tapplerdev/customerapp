/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import {
  openScreen,
  pressIcon,
  pressText,
  rowsByPlatform,
  treeAfter,
  type RenderScreenOptions,
  type Step,
} from "testing/screenKit"
import { guestState, screenState } from "testing/screenKit/states"
import { CATEGORY, SERVICE, some } from "testing/screenKit/fixtures/entities"
import { pressContaining } from "testing/pressContaining"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"
import type { ServiceCategoryType, ServiceType } from "types/cms"

/*
 * SubCategoriesScreen (a service's categories), captured from the
 * unconverted code: one category, several with a long Arabic name, none (a
 * guest's list draws the same); then the presses: a row opens the address sheet (a category with a
 * place of service the address matters to), a remote-only one skips the sheet
 * and goes on with the last-used address, the sheet's rows go to the results
 * and the back chevron goes back.
 */

const load = () => require("../SubCategoriesScreen")

const CATEGORIES = [
  some<ServiceCategoryType>({
    id: 3041,
    nameEn: "Window cleaning",
    nameAr: "تنظيف النوافذ",
    serviceId: 204,
    placeOfService: ["customerPlace"],
  }),
  some<ServiceCategoryType>({
    id: 3042,
    nameEn: "Online tutoring for school students in every subject at any level",
    nameAr: "دروس خصوصية عبر الإنترنت لطلاب المدارس في جميع المواد وفي كل المستويات",
    serviceId: 204,
    placeOfService: ["remoteOrOnline"],
  }),
  some<ServiceCategoryType>({
    id: 3043,
    nameEn: "Gardening",
    nameAr: "البستنة",
    serviceId: 204,
    placeOfService: ["fixedLocations"],
  }),
  some<ServiceCategoryType>({
    id: 3044,
    nameEn: "Anything",
    nameAr: "أي شيء",
    serviceId: 204,
  }),
]

const MANY: ServiceType = {
  id: 204,
  nameEn: "Household services and everything else around the home",
  nameAr: "خدمات منزلية وكل شيء آخر حول المنزل بما في ذلك الصيانة",
  categories: CATEGORIES,
}
const NONE: ServiceType = { id: 205, nameEn: "Nothing yet", nameAr: "لا شيء بعد", categories: [] }

type Case = {
  state: string
  options: Omit<RenderScreenOptions, "lang" | "platform">
  steps?: Step[]
}

const SIGNED = screenState("data")
const withService = (service: ServiceType) => ({
  route: { name: "SubCategoriesScreen", params: { service } },
})

const CASES: Case[] = [
  { state: "one category", options: { ...SIGNED, ...withService(SERVICE) } },
  { state: "several categories, long names", options: { ...SIGNED, ...withService(MANY) } },
  { state: "no categories", options: { ...SIGNED, ...withService(NONE) } },
  {
    state: "the address sheet open, signed in",
    options: { ...SIGNED, ...withService(MANY) },
    steps: [(root, env) => pressText(root, env.language === "ar" ? CATEGORIES[0].nameAr! : CATEGORIES[0].nameEn!)],
  },
  {
    state: "the address sheet open, guest",
    options: { ...guestState("data"), ...withService(MANY) },
    steps: [(root, env) => pressText(root, env.language === "ar" ? CATEGORIES[3].nameAr! : CATEGORIES[3].nameEn!)],
  },
]

const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("SubCategoriesScreen, captured from the unconverted code", () => {
  it.each(rows)(
    "$state [$env.language $env.platform]",
    async ({ state, options, steps, env }) => {
      const tree = await treeAfter(
        load,
        { ...options, lang: env.language, platform: env.platform },
        env,
        steps
      )
      expectParity(parityName(state, env), tree)
    }
  )
})

describe.each(PARITY_MATRIX)(
  "SubCategoriesScreen presses [$language $platform]",
  (env: ParityEnv) => {
    const open = (options: RenderScreenOptions = {}) =>
      openScreen(load, {
        ...SIGNED,
        ...withService(MANY),
        ...options,
        lang: env.language,
        platform: env.platform,
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
    const name = (category: { nameEn?: string; nameAr?: string }) =>
      env.language === "ar" ? category.nameAr! : category.nameEn!

    it("a row opens the address sheet, and its rows go to the results", async () => {
      const session = await open()
      try {
        expect(JSON.stringify(session.tree())).not.toContain("Tahrir")
        await act(session, () => pressText(session.root, name(CATEGORIES[0])))
        expect(JSON.stringify(session.tree())).toContain("12 Tahrir Street")
        await act(session, () => pressContaining(session.root, "3 Nile Corniche"))
        expect(navigated(session)).toEqual([
          expect.objectContaining({
            name: "SearchAnimationScreen",
            params: {
              nextParams: expect.objectContaining({
                categoryId: 3041,
                serviceId: 204,
                categoryName: name(CATEGORIES[0]),
                address: expect.objectContaining({ city: "Zamalek" }),
              }),
            },
          }),
        ])
      } finally {
        session.unmount()
      }
    })

    it("a remote-only or fixed-location category skips the sheet when an address is known", async () => {
      const session = await open(guestState("data"))
      try {
        await act(session, () => pressText(session.root, name(CATEGORIES[1])))
        expect(navigated(session)).toEqual([
          expect.objectContaining({
            name: "SearchAnimationScreen",
            params: {
              nextParams: expect.objectContaining({
                categoryId: 3042,
                address: expect.objectContaining({ city: "Dokki" }),
              }),
            },
          }),
        ])
        expect(JSON.stringify(session.tree())).not.toContain("Tahrir Street, Dokki")
        await act(session, () => pressText(session.root, name(CATEGORIES[2])))
        expect(navigated(session)).toHaveLength(2)
        expect(navigated(session)[1]).toEqual(
          expect.objectContaining({
            params: { nextParams: expect.objectContaining({ categoryId: 3043 }) },
          })
        )
      } finally {
        session.unmount()
      }
    })

    it("the back chevron goes back", async () => {
      const session = await open()
      try {
        await act(session, () => pressIcon(session.root, { icon: "svg:chevron-left" }))
        expect(navigated(session)).toEqual([
          expect.objectContaining({ type: "GO_BACK" }),
        ])
      } finally {
        session.unmount()
      }
    })
  }
)
