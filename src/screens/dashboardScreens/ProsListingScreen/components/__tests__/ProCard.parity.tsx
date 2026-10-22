/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
  renderScreen,
  rowsByPlatform,
  type RenderScreenOptions,
} from "testing/screenKit"
import {
  CATEGORY,
  PRO_COMPANY,
  PRO_FOOD,
  PRO_INDIVIDUAL,
} from "testing/screenKit/fixtures/entities"
import { pressContaining } from "testing/pressContaining"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"
import type { ProType } from "types/pro"

/*
 * ProCard (a pro on the listing), captured from the unconverted code: the
 * individual and the company, with and without a photo, a location, a
 * response time (in minutes, hours, days), a rating, a description and the
 * featured tag; trust badges (the art, the words, the fallback words), the
 * promo line and the stickers' band; selected and not; the food card (the
 * distance in metres and in km, both modes, either one alone, none) with its
 * Food Menu action. Then the presses: the photo area, Chat, Select me and
 * Food Menu, each once.
 */

const load = () => {
  const React = require("react") as typeof import("react")
  const ProCard = require("../ProCard").default
  const Harness = ({ pro, ...rest }: { pro: ProType } & Record<string, unknown>) =>
    React.createElement(ProCard, { pro, onSelect: () => undefined, ...rest })
  return { default: Harness }
}

const sticker = (id: number) => ({
  id,
  product: {
    subType: "motivational",
    pictureEn: `https://example.com/parity/sticker-${id}-en.svg`,
    pictureAr: `https://example.com/parity/sticker-${id}-ar.svg`,
  },
})
const promoLine = {
  id: 7,
  promoStickerMessage: "20% off on Tuesdays",
  product: { subType: "promoLine" },
}
// The sticker art the screen fetches: a plain rectangle, so the stickers draw.
const SVG_ART =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 118 31"><rect width="118" height="31" fill="#CC0000"/></svg>'

const proWith = (changes: Partial<ProType> = {}, subscriptions?: object[], featured = false) =>
  ({
    ...PRO_INDIVIDUAL,
    ...changes,
    serviceCategories: [
      {
        serviceCategoryId: CATEGORY.id,
        status: "active",
        isFeatured: featured,
        ...(subscriptions && { subscriptions }),
      },
    ],
  }) as ProType

const trust = (id: number, data: object) => ({
  id,
  type: "trust",
  status: "approved",
  trustDocumentData: { trustProduct: data },
})

const PHOTOLESS = { profilePhoto: undefined, profilePhoto150: undefined }

type Case = {
  state: string
  pro: ProType
  props?: Record<string, unknown>
}

const BASE_CASES: Case[] = [
  { state: "an individual", pro: proWith() },
  { state: "a company", pro: PRO_COMPANY },
  { state: "an individual, selected", pro: proWith(), props: { isSelected: true } },
  { state: "featured", pro: proWith({}, undefined, true) },
  { state: "no photo, no location, no description, no response time", pro: proWith({ ...PHOTOLESS, address: undefined, informationAbout: undefined, responseTimeHours: undefined }) },
  { state: "only the full-size photo", pro: proWith({ profilePhoto150: undefined }) },
  { state: "a city only", pro: proWith({ address: { address: { city: "Zamalek" } } }) },
  { state: "a long name and description", pro: proWith({ businessName: "Al Salam International Plumbing, Heating and Electrical Maintenance Company", informationAbout: "We have been working across Greater Cairo for more than twenty years, with teams for every trade, a call centre and same-day visits for urgent jobs." }) },
  { state: "responds in minutes", pro: proWith({ responseTimeHours: 0.25 }) },
  { state: "responds in one hour", pro: proWith({ responseTimeHours: 1 }) },
  { state: "responds in a day", pro: proWith({ responseTimeHours: 24 }) },
  { state: "responds in days", pro: proWith({ responseTimeHours: 72 }) },
  { state: "no reviews", pro: proWith({ reviewScore: undefined }) },
  {
    state: "trust badges: art, words and the fallback",
    pro: proWith({
      documents: [
        trust(1, { pictureEn: "https://example.com/parity/trust-en.svg", pictureAr: "https://example.com/parity/trust-ar.svg" }),
        trust(2, { descriptionEn: "ID verified", descriptionAr: "الهوية موثقة" }),
        trust(3, {}),
        { id: 4, type: "trust", status: "pending", trustDocumentData: { trustProduct: { descriptionEn: "Pending, hidden", descriptionAr: "قيد المراجعة" } } },
      ] as never,
    }),
  },
  { state: "a promo line", pro: proWith({}, [promoLine]) },
  { state: "a promo line and stickers", pro: proWith({}, [promoLine, sticker(1), sticker(2)]) },
  { state: "stickers only", pro: proWith({}, [sticker(1), sticker(2), sticker(3), sticker(4)]) },
  { state: "the food card, both modes", pro: PRO_FOOD, props: { foodMode: true } },
  { state: "the food card, a screen name and metres away", pro: { ...PRO_FOOD, screenName: "Laila", distanceKm: 0.35 }, props: { foodMode: true } },
  { state: "the food card, pickup only", pro: { ...PRO_FOOD, isDeliveryEnabled: false, distanceKm: 12.34 }, props: { foodMode: true } },
  { state: "the food card, delivery only", pro: { ...PRO_FOOD, isPickupEnabled: false, distanceKm: undefined }, props: { foodMode: true } },
  { state: "the food card, neither mode", pro: { ...PRO_FOOD, isPickupEnabled: false, isDeliveryEnabled: false }, props: { foodMode: true } },
  { state: "the food card with a promo line and a sticker", pro: { ...PRO_FOOD, serviceCategories: [{ serviceCategoryId: 302, status: "active", isFeatured: true, subscriptions: [promoLine, sticker(1)] }] } as unknown as ProType, props: { foodMode: true } },
  { state: "a non-food card is not a food card", pro: PRO_FOOD },
]

// No 390-wide rows: OffersSection reads the window as it loads, but its strip
// (the only part a card draws) has fixed sizes, so a 390-wide phone draws the
// same tree as the 402-wide default (checked: every such row repeated its
// 402 twin, so they were dropped).
const rows = rowsByPlatform(BASE_CASES, PARITY_MATRIX)

const options = (env: ParityEnv): RenderScreenOptions => ({
  lang: env.language,
  platform: env.platform,
  http: () => ({ text: SVG_ART }),
  navigation: "none",
})

describe("ProCard, captured from the unconverted code", () => {
  it.each(rows)("$state [$env.language $env.platform]", async ({ state, pro, props, env }) => {
    const tree = await renderScreen(load, {
      ...options(env),
      props: { pro, isSelected: false, ...props },
    })
    expectParity(parityName(state, env), tree)
  })
})

describe.each(PARITY_MATRIX)("ProCard presses [$language $platform]", (env: ParityEnv) => {
  const open = (props: Record<string, unknown>) =>
    openScreen(load, { ...options(env), props: { pro: proWith(), isSelected: false, ...props } })
  type Session = Awaited<ReturnType<typeof open>>
  const act = (session: Session, press: () => void) => session.act(() => { press() })

  it("the photo and info area opens the profile, Chat messages, Select me selects", async () => {
    const onPressProfile = jest.fn()
    const onMessage = jest.fn()
    const onSelect = jest.fn()
    const pro = proWith()
    const session = await open({ pro, onPressProfile, onMessage, onSelect })
    try {
      await act(session, () => pressContaining(session.root, pro.registeredName))
      expect(onPressProfile).toHaveBeenCalledTimes(1)
      expect(onPressProfile).toHaveBeenCalledWith(pro)
      await act(session, () => pressIcon(session.root, { icon: "svg:messages-red" }))
      expect(onMessage).toHaveBeenCalledTimes(1)
      expect(onMessage).toHaveBeenCalledWith(pro)
      await act(session, () => pressText(session.root, copy(env, "select_me")))
      expect(onSelect).toHaveBeenCalledTimes(1)
      expect(onSelect).toHaveBeenCalledWith(pro)
      expect(onPressProfile).toHaveBeenCalledTimes(1)
    } finally {
      session.unmount()
    }
  })

  it("the food card's action opens the menu and Select me is gone", async () => {
    const onViewMenu = jest.fn()
    const onSelect = jest.fn()
    const session = await open({ pro: PRO_FOOD, foodMode: true, onViewMenu, onSelect })
    try {
      const tree = JSON.stringify(session.tree())
      expect(tree).not.toContain(copy(env, "select_me"))
      await act(session, () => pressContaining(session.root, copy(env, "food_menu")))
      expect(onViewMenu).toHaveBeenCalledTimes(1)
      expect(onViewMenu).toHaveBeenCalledWith(PRO_FOOD)
      expect(onSelect).not.toHaveBeenCalled()
    } finally {
      session.unmount()
    }
  })
})
