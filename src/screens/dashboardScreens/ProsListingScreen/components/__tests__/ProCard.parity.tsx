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

/*
 * #522 redrew the pro card (one red star and "x of 5 (N Reviews)" for a
 * reviewed pro, "New on Tappler" kept for the rest; trust stickers in slots
 * as tall as their art; the OFFERS box after the trust stickers in place of
 * the pink footer band), so the states that draw one are drawn again under a
 * "#522 card" name and captured beside the frozen ones, which no row draws
 * any more.
 */
/*
 * #525 enlarged the OFFERS box (the stickers' art 39 tall in a 59pt box) and
 * gave every sticker a third of the row from the start edge, empty thirds
 * filling a short row, so the states that draw the box are drawn again under
 * a "#525 offers" name and captured beside the frozen ones, which no row
 * draws any more.
 */
/*
 * #525's second pass made every sticker bigger and the same size: its art 45
 * tall in a slot of its own (the box still 59pt), a pair sharing the row in
 * halves with slots as wide as a third's, one sticker still a third at the
 * start edge. The states that draw the box are drawn again under a
 * "#525 equal slots" name and captured beside the frozen ones, which no row
 * draws any more.
 */
/*
 * #533 draws a sticker that has an icon and a caption in the language as the
 * icon above the caption, top-aligned in its cell, else as its picture as
 * before; the stickers go in catalogue order (newest product first, as the
 * catalogue lists them, Omar 2026-11-07); an icon that fails to load falls
 * back to the picture, and when there's no picture or it fails too, to the
 * caption alone. Those states are new, under a "#533 offers" name; every
 * state above draws what it drew.
 */
/*
 * #533's text offer: the promo line is drawn in the OFFERS box's frame, its
 * text in a pink box under the one OFFERS tab (it was a banner with an OFFER
 * tab of its own, under the stickers' box), after the stickers when there
 * are any. The states above that draw a promo line are captured again in
 * place (recipe B); the three under a "#533 text offer" name are new. A
 * pro's text is shown as they typed it, so an Arabic one draws in English
 * rows too.
 */
/*
 * #533's corner fix: the OFFERS box names its corners by start and end
 * (borderTopStartRadius and its three fellows), so the square one sits under
 * the tab in Arabic on iOS too, where the physical top-left one stayed on
 * the left. Only those style keys change, with the same values; the states
 * that draw the box are captured again in place (recipe B, the frozen
 * Buttons grafted back).
 */
const load = () => {
  const React = require("react") as typeof import("react")
  const ProCard = require("../ProCard").default
  const Harness = ({
    pro,
    ...rest
  }: { pro: ProType } & Record<string, unknown>) =>
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
// #533: a promo line with its own text, and the longest a pro can write
// (PROMO_LINE_MAX_LENGTH, 50), in Arabic.
const textOffer = (promoStickerMessage: string) => ({
  id: 7,
  promoStickerMessage,
  product: { subType: "promoLine" },
})
const DESIGN_OFFER = "20% off your service on Tuesdays and Wednesdays"
const LONG_ARABIC_OFFER = "خصم 25% على كل الخدمات يومي الثلاثاء والأربعاء فقط"
// The sticker art the screen fetches: a plain rectangle, so the stickers draw.
const SVG_ART =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 118 31"><rect width="118" height="31" fill="#CC0000"/></svg>'

// #533: a sticker with an icon (one for both languages) and a caption in each,
// its legacy pictures kept as the fallback. A caption left empty is one the
// sticker doesn't have in that language. Its product has no id unless
// `product` gives one (its place in the catalogue, the order stickers are
// drawn in): the sort keeps stickers with no id in the order given, so a row
// whose order isn't the point lists them in the order they're drawn.
const iconSticker = (
  id: number,
  labelEn: string,
  labelAr: string,
  product: object = {}
) => ({
  id,
  product: {
    subType: "motivational",
    pictureEn: `https://example.com/parity/sticker-${id}-en.svg`,
    pictureAr: `https://example.com/parity/sticker-${id}-ar.svg`,
    icon: `https://example.com/parity/icon-${id}.svg`,
    labelEn,
    labelAr,
    ...product,
  },
})
const BROKEN_ICON = { icon: "https://example.com/parity/icon-broken.svg" }
// An icon whose pictures fail to load too (#533).
const BROKEN_ART = {
  ...BROKEN_ICON,
  pictureEn: "https://example.com/parity/picture-broken-en.svg",
  pictureAr: "https://example.com/parity/picture-broken-ar.svg",
}
// The icon art: a circle, so an icon is told apart from a picture in a tree.
const ICON_ART =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#3F73DB"/></svg>'
// The icons answer with ICON_ART, a broken icon or picture with a 404, the
// rest SVG_ART.
const ICON_HTTP = (key: string) =>
  /-broken/.test(key)
    ? { status: 404, text: "Not Found" }
    : /\/icon-/.test(key)
      ? { text: ICON_ART }
      : { text: SVG_ART }

const proWith = (
  changes: Partial<ProType> = {},
  subscriptions?: object[],
  featured = false
) =>
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
  /** The art's answers, when not SVG_ART for every url (#533's icons). */
  http?: (key: string) => { status?: number; text: string }
}

const BASE_CASES: Case[] = [
  { state: "an individual, #522 card", pro: proWith() },
  { state: "a company, #522 card", pro: PRO_COMPANY },
  {
    state: "an individual, selected, #522 card",
    pro: proWith(),
    props: { isSelected: true },
  },
  { state: "featured, #522 card", pro: proWith({}, undefined, true) },
  {
    state: "no photo, no location, no description, no response time, #522 card",
    pro: proWith({
      ...PHOTOLESS,
      address: undefined,
      informationAbout: undefined,
      responseTimeHours: undefined,
    }),
  },
  {
    state: "only the full-size photo, #522 card",
    pro: proWith({ profilePhoto150: undefined }),
  },
  {
    state: "a city only, #522 card",
    pro: proWith({ address: { address: { city: "Zamalek" } } }),
  },
  {
    state: "a long name and description, #522 card",
    pro: proWith({
      businessName:
        "Al Salam International Plumbing, Heating and Electrical Maintenance Company",
      informationAbout:
        "We have been working across Greater Cairo for more than twenty years, with teams for every trade, a call centre and same-day visits for urgent jobs.",
    }),
  },
  {
    state: "responds in minutes, #522 card",
    pro: proWith({ responseTimeHours: 0.25 }),
  },
  {
    state: "responds in one hour, #522 card",
    pro: proWith({ responseTimeHours: 1 }),
  },
  {
    state: "responds in a day, #522 card",
    pro: proWith({ responseTimeHours: 24 }),
  },
  {
    state: "responds in days, #522 card",
    pro: proWith({ responseTimeHours: 72 }),
  },
  { state: "no reviews", pro: proWith({ reviewScore: undefined }) },
  {
    state: "trust badges: art, words and the fallback, #522 card",
    pro: proWith({
      documents: [
        trust(1, {
          pictureEn: "https://example.com/parity/trust-en.svg",
          pictureAr: "https://example.com/parity/trust-ar.svg",
        }),
        trust(2, {
          descriptionEn: "ID verified",
          descriptionAr: "الهوية موثقة",
        }),
        trust(3, {}),
        {
          id: 4,
          type: "trust",
          status: "pending",
          trustDocumentData: {
            trustProduct: {
              descriptionEn: "Pending, hidden",
              descriptionAr: "قيد المراجعة",
            },
          },
        },
      ] as never,
    }),
  },
  { state: "a promo line, #522 card", pro: proWith({}, [promoLine]) },
  {
    state:
      "a promo line and stickers, #522 card, #525 offers, #525 equal slots",
    pro: proWith({}, [promoLine, sticker(1), sticker(2)]),
  },
  {
    state: "stickers only, #522 card, #525 offers, #525 equal slots",
    pro: proWith({}, [sticker(1), sticker(2), sticker(3), sticker(4)]),
  },
  {
    state: "the food card, both modes, #522 card",
    pro: PRO_FOOD,
    props: { foodMode: true },
  },
  {
    state: "the food card, a screen name and metres away, #522 card",
    pro: { ...PRO_FOOD, screenName: "Laila", distanceKm: 0.35 },
    props: { foodMode: true },
  },
  {
    state: "the food card, pickup only, #522 card",
    pro: { ...PRO_FOOD, isDeliveryEnabled: false, distanceKm: 12.34 },
    props: { foodMode: true },
  },
  {
    state: "the food card, delivery only, #522 card",
    pro: { ...PRO_FOOD, isPickupEnabled: false, distanceKm: undefined },
    props: { foodMode: true },
  },
  {
    state: "the food card, neither mode, #522 card",
    pro: { ...PRO_FOOD, isPickupEnabled: false, isDeliveryEnabled: false },
    props: { foodMode: true },
  },
  {
    state:
      "the food card with a promo line and a sticker, #522 card, #525 offers, #525 equal slots",
    pro: {
      ...PRO_FOOD,
      serviceCategories: [
        {
          serviceCategoryId: 302,
          status: "active",
          isFeatured: true,
          subscriptions: [promoLine, sticker(1)],
        },
      ],
    } as unknown as ProType,
    props: { foodMode: true },
  },
  { state: "a non-food card is not a food card, #522 card", pro: PRO_FOOD },
  {
    state: "an icon sticker, #533 offers",
    pro: proWith({}, [iconSticker(11, "Installments", "الدفع بالتقسيط")]),
    http: ICON_HTTP,
  },
  {
    state: "two icon stickers, #533 offers",
    pro: proWith({}, [
      iconSticker(11, "Installments", "الدفع بالتقسيط"),
      iconSticker(12, "Free Shoot", "تصوير مجاني"),
    ]),
    http: ICON_HTTP,
  },
  {
    state: "three icon stickers, in catalogue order, #533 offers",
    pro: proWith({}, [
      // Neither the order given nor the subscriptions' (11, 12, 13): the
      // catalogue's, Installments (30), Discounts (9), Free Shoot (5).
      iconSticker(13, "Discounts", "خصومات فورية", { id: 9 }),
      iconSticker(11, "Installments", "الدفع بالتقسيط", { id: 30 }),
      iconSticker(12, "Free Shoot", "تصوير مجاني", { id: 5 }),
    ]),
    http: ICON_HTTP,
  },
  {
    state: "a caption long enough to wrap, #533 offers",
    pro: proWith({}, [
      iconSticker(11, "Installments", "الدفع بالتقسيط"),
      iconSticker(12, "Free Shoot", "تصوير مجاني"),
      iconSticker(14, "Free delivery on orders", "توصيل مجاني لكل الطلبات"),
    ]),
    http: ICON_HTTP,
  },
  {
    state:
      "an icon sticker, a picture sticker and one captioned in English only, #533 offers",
    pro: proWith({}, [
      sticker(2),
      iconSticker(11, "Installments", "الدفع بالتقسيط"),
      iconSticker(15, "Fast Response", ""),
    ]),
    http: ICON_HTTP,
  },
  {
    state: "an icon that fails to load, drawn as its picture, #533 offers",
    pro: proWith({}, [
      iconSticker(11, "Installments", "الدفع بالتقسيط"),
      iconSticker(16, "Free Manicure", "مانيكير مجاني", BROKEN_ICON),
    ]),
    http: ICON_HTTP,
  },
  {
    state: "a failed icon with no picture, its caption alone, #533 offers",
    pro: proWith({}, [
      iconSticker(11, "Installments", "الدفع بالتقسيط"),
      iconSticker(17, "Free Manicure", "مانيكير مجاني", {
        ...BROKEN_ICON,
        pictureEn: "",
        pictureAr: "",
      }),
    ]),
    http: ICON_HTTP,
  },
  {
    state:
      "a failed icon whose picture fails too, its caption alone, #533 offers",
    pro: proWith({}, [
      iconSticker(11, "Installments", "الدفع بالتقسيط"),
      iconSticker(18, "Free Manicure", "مانيكير مجاني", BROKEN_ART),
    ]),
    http: ICON_HTTP,
  },
  {
    state: "a text offer, #533 text offer",
    pro: proWith({}, [textOffer(DESIGN_OFFER)]),
  },
  {
    state: "icon stickers and a text offer, #533 text offer",
    pro: proWith({}, [
      textOffer(DESIGN_OFFER),
      iconSticker(11, "Installments", "الدفع بالتقسيط"),
      iconSticker(12, "Free Shoot", "تصوير مجاني"),
    ]),
    http: ICON_HTTP,
  },
  {
    state: "a long Arabic text offer that wraps, #533 text offer",
    pro: proWith({}, [textOffer(LONG_ARABIC_OFFER)]),
  },
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
  it.each(rows)(
    "$state [$env.language $env.platform]",
    async ({ state, pro, props, http, env }) => {
      const tree = await renderScreen(load, {
        ...options(env),
        ...(http && { http }),
        props: { pro, isSelected: false, ...props },
      })
      expectParity(parityName(state, env), tree)
    }
  )
})

describe.each(PARITY_MATRIX)(
  "ProCard presses [$language $platform]",
  (env: ParityEnv) => {
    const open = (props: Record<string, unknown>) =>
      openScreen(load, {
        ...options(env),
        props: { pro: proWith(), isSelected: false, ...props },
      })
    type Session = Awaited<ReturnType<typeof open>>
    const act = (session: Session, press: () => void) =>
      session.act(() => {
        press()
      })

    it("the photo and info area opens the profile, Chat messages, Select me selects", async () => {
      const onPressProfile = jest.fn()
      const onMessage = jest.fn()
      const onSelect = jest.fn()
      const pro = proWith()
      const session = await open({ pro, onPressProfile, onMessage, onSelect })
      try {
        await act(session, () =>
          pressContaining(session.root, pro.registeredName)
        )
        expect(onPressProfile).toHaveBeenCalledTimes(1)
        expect(onPressProfile).toHaveBeenCalledWith(pro)
        await act(session, () =>
          pressIcon(session.root, { icon: "svg:messages-red" })
        )
        expect(onMessage).toHaveBeenCalledTimes(1)
        expect(onMessage).toHaveBeenCalledWith(pro)
        await act(session, () =>
          pressText(session.root, copy(env, "select_me"))
        )
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
      const session = await open({
        pro: PRO_FOOD,
        foodMode: true,
        onViewMenu,
        onSelect,
      })
      try {
        const tree = JSON.stringify(session.tree())
        expect(tree).not.toContain(copy(env, "select_me"))
        await act(session, () =>
          pressContaining(session.root, copy(env, "food_menu"))
        )
        expect(onViewMenu).toHaveBeenCalledTimes(1)
        expect(onViewMenu).toHaveBeenCalledWith(PRO_FOOD)
        expect(onSelect).not.toHaveBeenCalled()
      } finally {
        session.unmount()
      }
    })
  }
)
