/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import {
  copy,
  fireHost,
  openScreen,
  pressIcon,
  rowsByPlatform,
  treeAfter,
  wait,
  type RenderScreenOptions,
  type Step,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { asProfile } from "testing/screenKit/fixtures/proViews"
import { DATA } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import {
  CATEGORY,
  PRO_COMPANY,
  PRO_INDIVIDUAL,
} from "testing/screenKit/fixtures/entities"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"
import type { ProType, ProWorkPhotoType } from "types/pro"

/*
 * ProProfileScreen (a pro's profile), captured from the unconverted code:
 * loading, the plain individual, a full profile (a company with a photo, a
 * featured sticker, trust badges, a promo line, the OFFERS stickers, an
 * about text, work photos and videos, hours with closed days, payment methods
 * and every social link), a pro with no photo (the initial letter, drawn in
 * the screen's own size, which draws nothing today), no about / hours /
 * payments / socials, a long name, the categories the listing passes along,
 * the header that fades in once the photo is scrolled past, the work-photo
 * viewer opened by pressing a tile, and the platform's own top inset and none.
 * The close buttons go back, each exactly once.
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
const load = () => require("../ProProfileScreen")

const img = (
  n: number,
  extra: Partial<ProWorkPhotoType> = {}
): ProWorkPhotoType => ({
  id: 5000 + n,
  url: `https://example.com/parity/work-${n}.jpg`,
  url720: `https://example.com/parity/work-${n}-720.jpg`,
  url150: `https://example.com/parity/work-${n}-150.jpg`,
  urlThumb: `https://example.com/parity/work-${n}-thumb.jpg`,
  mimeType: "image/jpeg",
  posterUrl: null,
  ...extra,
})
const WORK: ProWorkPhotoType[] = [
  img(1),
  img(2, { urlThumb: "" }),
  img(3, {
    mimeType: "video/mp4",
    url: "https://example.com/parity/work-3.mp4",
    posterUrl: "https://example.com/parity/work-3-poster.jpg",
  }),
  img(4, {
    mimeType: "video/mp4",
    url: "https://example.com/parity/work-4.mp4",
    posterUrl: null,
  }),
  img(5, { mimeType: null }),
]

const trust = (id: number, data: object, status = "approved") => ({
  id,
  type: "trust",
  status,
  trustDocumentData: { trustProduct: data },
})
const sticker = (id: number, subType: string, extra: object = {}) => ({
  id,
  product: {
    subType,
    pictureEn: `https://example.com/parity/${subType}-${id}-en.svg`,
    pictureAr: `https://example.com/parity/${subType}-${id}-ar.svg`,
  },
  ...extra,
})
const SVG_ART =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 118 31"><rect width="118" height="31" fill="#CC0000"/></svg>'

// #533: a sticker with an icon (one for both languages) and a caption in each,
// its legacy pictures kept as the fallback. A caption left empty is one the
// sticker doesn't have in that language. Its product's id, its place in the
// catalogue (the order stickers are drawn in), is the subscription's unless
// `product` gives one.
const iconSticker = (
  id: number,
  labelEn: string,
  labelAr: string,
  product: object = {}
) => ({
  id,
  product: {
    subType: "motivational",
    pictureEn: `https://example.com/parity/motivational-${id}-en.svg`,
    pictureAr: `https://example.com/parity/motivational-${id}-ar.svg`,
    icon: `https://example.com/parity/icon-${id}.svg`,
    labelEn,
    labelAr,
    id,
    ...product,
  },
})
// A picture-only sticker with its product's id, its place in the catalogue.
const withProductId = <S extends { product: object }>(sub: S, id: number) => ({
  ...sub,
  product: { ...sub.product, id },
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

const withCategory = (
  pro: ProType,
  subscriptions: object[] = [],
  featured = false
): ProType => ({
  ...pro,
  serviceCategories: [
    {
      serviceCategoryId: CATEGORY.id,
      status: "active",
      isFeatured: featured,
      subscriptions,
    } as never,
  ],
})

const FULL: ProType = {
  ...withCategory(
    PRO_COMPANY,
    [
      sticker(1, "featuredPro"),
      {
        id: 8,
        promoStickerMessage: "20% off on Tuesdays",
        product: { subType: "promoLine" },
      },
      sticker(2, "motivational"),
      sticker(3, "motivational"),
    ],
    true
  ),
  documents: [
    trust(1, {
      pictureEn: "https://example.com/parity/trust-en.svg",
      pictureAr: "https://example.com/parity/trust-ar.svg",
    }),
    trust(2, { descriptionEn: "ID verified" }),
    trust(
      3,
      { pictureEn: "https://example.com/parity/pending.svg" },
      "pending"
    ),
  ] as never,
  workPhotos: WORK,
  hours: [
    { id: 1, dayOfWeek: "Sunday", openingTime: "09:00", closingTime: "17:30" },
    { id: 2, dayOfWeek: "monday", openingTime: "08:00", closingTime: "20:00" },
    {
      id: 3,
      dayOfWeek: "Wednesday",
      openingTime: "00:00",
      closingTime: "23:59",
    },
    { id: 4, dayOfWeek: "friday", openingTime: "13:05", closingTime: "" },
  ],
  paymentMethods: ["cash", "credit card", "bank transfer"],
  socials: [
    {
      id: 1,
      socialMedia: "facebook",
      socialLink: "https://facebook.com/hassan.home",
    },
    {
      id: 2,
      socialMedia: "instagram",
      socialLink: "https://instagram.com/hassan.home",
    },
    {
      id: 3,
      socialMedia: "linkedin",
      socialLink:
        "https://linkedin.com/company/hassan-home-services-and-everything-else-they-do",
    },
    { id: 4, socialMedia: "tiktok", socialLink: "https://tiktok.com/@hassan" },
    { id: 5, socialMedia: "website", socialLink: "https://hassan.example.com" },
    { id: 6, socialMedia: "telegram", socialLink: "https://t.me/hassan" },
  ],
}

const MINIMAL: ProType = {
  ...withCategory(PRO_INDIVIDUAL),
  informationAbout: undefined,
  hours: [],
  paymentMethods: [],
  socials: [],
  workPhotos: [],
  documents: [],
}

// A pro nobody has reviewed yet: the no-reviews box (#522).
const UNREVIEWED: ProType = {
  ...MINIMAL,
  reviewScore: {
    ...PRO_INDIVIDUAL.reviewScore,
    overallScore: 0,
    reviewsCount: 0,
  } as ProType["reviewScore"],
}

const NO_PHOTO: ProType = {
  ...FULL,
  profilePhoto: undefined,
  profilePhoto150: undefined,
  profilePhoto720: undefined,
}

const SIGNED = screenState("data")
const withPro = (pro: ProType, params: object = {}) => ({
  ...SIGNED,
  api: { ...DATA, getProProfile: { data: pro } },
  http: () => ({ text: SVG_ART }),
  route: {
    name: "ProProfileScreen",
    params: { ...ROUTE_PARAMS.ProProfileScreen, ...params },
  },
})

const scrollTo =
  (y: number): Step =>
  (root) =>
    fireHost(
      root,
      "RCTScrollView",
      "onScroll",
      [{ nativeEvent: { contentOffset: { y } } }],
      { nth: 0 }
    )
const openViewer =
  (nth: number): Step =>
  (root) =>
    pressIcon(root, { icon: "FastImage", nth })

/*
 * #533 draws a sticker that has an icon and a caption in the language as the
 * icon above the caption, top-aligned in its cell, else as its picture as
 * before; the stickers go in catalogue order (product id, Omar 2026-11-07,
 * where the first captures went oldest subscription first: the states whose
 * order that changed are captured again under new names, beside them); an
 * icon that fails to load falls back
 * to the picture, and when there's no picture or it fails too, to the caption
 * alone. Those states are new, under a "#533 offers" name; every state above
 * draws what it drew.
 */
/*
 * #533's text offer: the promo line is drawn in the OFFERS box's frame, its
 * text in a pink box under the one OFFERS tab, after the stickers (it was a
 * banner with an OFFER tab of its own, above the stickers' box). The states
 * above that draw a promo line are captured again in place (recipe B); the
 * three under a "#533 text offer" name are new. A pro's text is shown as they
 * typed it, so an Arabic one draws in English rows too.
 */
const textOffer = (promoStickerMessage: string) => ({
  id: 8,
  promoStickerMessage,
  product: { subType: "promoLine" },
})
const DESIGN_OFFER = "20% off your service on Tuesdays and Wednesdays"
// The longest a pro can write (PROMO_LINE_MAX_LENGTH, 50), in Arabic.
const LONG_ARABIC_OFFER = "خصم 25% على كل الخدمات يومي الثلاثاء والأربعاء فقط"

const withStickers = (subscriptions: object[]) => ({
  ...withPro(withCategory(PRO_COMPANY, subscriptions)),
  http: ICON_HTTP,
})

type Case = {
  state: string
  options: Omit<RenderScreenOptions, "lang" | "platform">
  steps?: Step[]
}

const CASES: Case[] = [
  // (A failed profile draws the same loading overlay as one still loading.)
  {
    state: "loading",
    options: {
      ...SIGNED,
      api: { ...DATA, getProProfile: "loading" },
      route: withPro(PRO_INDIVIDUAL).route,
    },
  },
  {
    state: "the plain individual, #522 profile hero, pill as tall as Featured",
    options: SIGNED_PLAIN(),
  },
  {
    state:
      "a full company profile, #522 profile hero, pill as tall as Featured, #525 offers, #525 equal slots",
    options: withPro(FULL),
  },
  {
    state: "a minimal profile, #522 profile hero, pill as tall as Featured",
    options: withPro(MINIMAL),
  },
  {
    state:
      "a pro nobody has reviewed yet, #522 profile hero, pill as tall as Featured",
    options: withPro(UNREVIEWED),
  },
  {
    state:
      "no photo: the initial letter, #522 profile hero, pill as tall as Featured, #525 offers, #525 equal slots",
    options: withPro(NO_PHOTO),
  },
  {
    state:
      "no photo, an individual, #522 profile hero, pill as tall as Featured",
    options: withPro({
      ...MINIMAL,
      profilePhoto: undefined,
      registeredName: "Mona Adel",
    }),
  },
  {
    state:
      "a long name, #522 profile hero, pill as tall as Featured, #525 offers, #525 equal slots",
    options: withPro({
      ...FULL,
      businessName:
        "Hassan Home Services, Heating, Plumbing and Everything Else Around the House Company Limited",
    }),
  },
  {
    state:
      "a long name, featured, an individual, #522 profile hero, pill as tall as Featured",
    options: withPro({
      ...withCategory(PRO_INDIVIDUAL, [sticker(1, "featuredPro")], true),
      registeredName:
        "Abdel Rahman Mohamed Ibrahim El Sayed Hassan Mahmoud Fahmy",
    }),
  },
  {
    state:
      "the listing's categories win over the pro's, #522 profile hero, pill as tall as Featured, #525 offers, #525 equal slots",
    options: withPro(MINIMAL, { serviceCategories: FULL.serviceCategories }),
  },
  // OffersSection's banner sizes its stickers from the window it loaded with.
  {
    state:
      "four stickers, #522 profile hero, pill as tall as Featured, #525 offers, #525 equal slots",
    options: withPro(
      withCategory(PRO_COMPANY, [
        sticker(2, "motivational"),
        sticker(3, "motivational"),
        sticker(4, "motivational"),
        sticker(5, "motivational"),
      ])
    ),
  },
  {
    state:
      "four stickers, a 390-wide phone, #522 profile hero, pill as tall as Featured, #525 offers, #525 equal slots",
    options: {
      ...withPro(
        withCategory(PRO_COMPANY, [
          sticker(2, "motivational"),
          sticker(3, "motivational"),
          sticker(4, "motivational"),
          sticker(5, "motivational"),
        ])
      ),
      window: { width: 390 },
    },
  },
  {
    state:
      "scrolled past the photo, #522 profile hero, pill as tall as Featured, #525 offers, #525 equal slots",
    options: withPro(FULL),
    steps: [scrollTo(300), wait(300)],
  },
  {
    state:
      "scrolled halfway into the header, #522 profile hero, pill as tall as Featured, #525 offers, #525 equal slots",
    options: withPro(FULL),
    steps: [scrollTo(260), wait(300)],
  },
  {
    state:
      "scrolled back up, #522 profile hero, pill as tall as Featured, #525 offers, #525 equal slots",
    options: withPro(FULL),
    steps: [scrollTo(300), wait(300), scrollTo(0), wait(300)],
  },
  {
    state:
      "the work-photo viewer open on the first tile, #522 profile hero, pill as tall as Featured, #525 offers, #525 equal slots",
    options: withPro(FULL),
    steps: [openViewer(0), wait(600)],
  },
  {
    state:
      "the work-photo viewer open on a video, #522 profile hero, pill as tall as Featured, #525 offers, #525 equal slots",
    options: withPro(FULL),
    steps: [openViewer(2), wait(600)],
  },
  {
    state:
      "no top inset, #522 profile hero, pill as tall as Featured, #525 offers, #525 equal slots",
    options: { ...withPro(FULL), insets: { top: 0 } },
  },
  {
    state:
      "a notch, #522 profile hero, pill as tall as Featured, #525 offers, #525 equal slots",
    options: { ...withPro(FULL), insets: { top: 59 } },
  },
  // The Featured art can't be loaded (a bad upload, offline before it was
  // cached): no sticker beside the name or the pill, as with no art at all,
  // rather than its empty window and margin.
  {
    state:
      "the Featured art fails to load, #522 profile hero, pill as tall as Featured, #525 offers, #525 equal slots",
    options: {
      ...withPro(FULL),
      http: (key) =>
        /featuredPro/.test(key)
          ? { status: 404, text: "Not Found" }
          : { text: SVG_ART },
    },
  },
  {
    state: "an icon sticker, #533 offers",
    options: withStickers([iconSticker(11, "Installments", "الدفع بالتقسيط")]),
  },
  {
    state: "two icon stickers, #533 offers",
    options: withStickers([
      iconSticker(11, "Installments", "الدفع بالتقسيط"),
      iconSticker(12, "Free Shoot", "تصوير مجاني"),
    ]),
  },
  {
    state: "three icon stickers, in catalogue order, #533 offers",
    options: withStickers([
      // Neither the order given nor the subscriptions' (11, 12, 13): the
      // catalogue's, Free Shoot (5), Discounts (9), Installments (30).
      iconSticker(13, "Discounts", "خصومات فورية", { id: 9 }),
      iconSticker(11, "Installments", "الدفع بالتقسيط", { id: 30 }),
      iconSticker(12, "Free Shoot", "تصوير مجاني", { id: 5 }),
    ]),
  },
  {
    state: "a caption long enough to wrap, #533 offers",
    options: withStickers([
      iconSticker(11, "Installments", "الدفع بالتقسيط"),
      iconSticker(14, "Free delivery on orders", "توصيل مجاني لكل الطلبات"),
      iconSticker(12, "Free Shoot", "تصوير مجاني"),
    ]),
  },
  {
    state:
      "an icon sticker, a picture sticker and one captioned in English only, #533 offers",
    options: withStickers([
      iconSticker(11, "Installments", "الدفع بالتقسيط"),
      withProductId(sticker(2, "motivational"), 2),
      iconSticker(15, "Fast Response", ""),
    ]),
  },
  {
    state: "an icon that fails to load, drawn as its picture, #533 offers",
    options: withStickers([
      iconSticker(11, "Installments", "الدفع بالتقسيط"),
      iconSticker(16, "Free Manicure", "مانيكير مجاني", BROKEN_ICON),
    ]),
  },
  {
    state: "a failed icon with no picture, its caption alone, #533 offers",
    options: withStickers([
      iconSticker(11, "Installments", "الدفع بالتقسيط"),
      iconSticker(17, "Free Manicure", "مانيكير مجاني", {
        ...BROKEN_ICON,
        pictureEn: "",
        pictureAr: "",
      }),
    ]),
  },
  {
    state:
      "a failed icon whose picture fails too, its caption alone, #533 offers",
    options: withStickers([
      iconSticker(11, "Installments", "الدفع بالتقسيط"),
      iconSticker(18, "Free Manicure", "مانيكير مجاني", BROKEN_ART),
    ]),
  },
  {
    state: "a text offer, #533 text offer",
    options: withStickers([textOffer(DESIGN_OFFER)]),
  },
  {
    state: "icon stickers and a text offer, #533 text offer",
    options: withStickers([
      textOffer(DESIGN_OFFER),
      iconSticker(11, "Installments", "الدفع بالتقسيط"),
      iconSticker(12, "Free Shoot", "تصوير مجاني"),
    ]),
  },
  {
    state: "a long Arabic text offer that wraps, #533 text offer",
    options: withStickers([textOffer(LONG_ARABIC_OFFER)]),
  },
]

function SIGNED_PLAIN() {
  return withPro(PRO_INDIVIDUAL)
}

const rows = rowsByPlatform(CASES, PARITY_MATRIX)
// A window's rows together (each window is a registry of its own).
const ordered = [
  ...rows.filter((r) => !r.options.window),
  ...rows.filter((r) => r.options.window),
]

describe("ProProfileScreen, captured from the unconverted code", () => {
  it.each(ordered)(
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

/*
 * The same rows from `?view=profile` (backend #423): each pro cut to the
 * profile shape must draw exactly what the whole pro drew, which proves every
 * field the screen reads is in the shape. The shape has no serviceCategories
 * (the full GET /pros/:id never sent them either): the listing hands them over
 * as the route param, so a row whose pro carried them gets them that way.
 */
const fromProfileView = (options: Case["options"]): Case["options"] => {
  const answer = (options.api as Record<string, unknown> | undefined)
    ?.getProProfile as { data?: ProType } | undefined
  const pro = answer?.data
  if (!pro) return options
  const route = options.route as {
    name: string
    params: Record<string, unknown>
  }
  const passed = route.params.serviceCategories ?? pro.serviceCategories
  return {
    ...options,
    api: { ...options.api, getProProfile: { data: asProfile(pro) } },
    route: {
      ...route,
      params: {
        ...route.params,
        ...(passed ? { serviceCategories: passed } : {}),
      },
    },
  }
}

// The carousel takes the work photos whole as a prop, so the tree shows each
// photo's url150 although nothing reads it (tiles never use it, shared's
// constants/workPhotoTile.ts). The profile shape leaves it out; that is the
// only key let go.
const withoutUnread = (tree: unknown) =>
  JSON.stringify(tree, (key, value) => (key === "url150" ? undefined : value))

describe("ProProfileScreen, drawn from the profile view", () => {
  it.each(ordered)(
    "$state [$env.language $env.platform]",
    async ({ options, steps, env }) => {
      const draw = (from: Case["options"]) =>
        treeAfter(
          load,
          { ...from, lang: env.language, platform: env.platform },
          env,
          steps
        )
      const whole = await draw(options)
      const slim = await draw(fromProfileView(options))
      expect(withoutUnread(slim)).toEqual(withoutUnread(whole))
    }
  )
})

describe.each(PARITY_MATRIX)(
  "ProProfileScreen presses [$language $platform]",
  (env: ParityEnv) => {
    const open = (options: object) =>
      openScreen(load, {
        ...options,
        lang: env.language,
        platform: env.platform,
      } as RenderScreenOptions)

    // #522: what the hero says, by the words a customer reads.
    const heroText = async (pro: ProType) => {
      const session = await open(withPro(pro))
      try {
        return JSON.stringify(session.tree())
      } finally {
        session.unmount()
      }
    }

    it("a reviewed pro: the one-star score, the type in its pill, no box", async () => {
      const text = await heroText(MINIMAL)
      expect(text).toContain(copy(env, "individual"))
      expect(text).toContain(
        `"${copy(env, "rating_score_of_5").replace("{{rate}}", "4.6")} "`
      )
      expect(text).toContain(
        copy(env, "rating_reviews_count").replace("{{number}}", "18")
      )
      expect(text).not.toContain(
        copy(env, "be_the_first_to_share_your_experience")
      )
    })

    it("one review, in the singular, in the hero and the collapsed header", async () => {
      const text = await heroText({
        ...MINIMAL,
        reviewScore: {
          ...MINIMAL.reviewScore,
          overallScore: 5,
          reviewsCount: 1,
        } as ProType["reviewScore"],
      })
      const single = copy(env, "rating_reviews_count_single")
      expect(text.split(JSON.stringify(single)).length - 1).toBe(2)
      expect(text).not.toContain(
        copy(env, "rating_reviews_count").replace("{{number}}", "1")
      )
    })

    it("a pro nobody reviewed: the no-reviews box, no score", async () => {
      const text = await heroText(UNREVIEWED)
      expect(text).toContain(copy(env, "no_reviews_yet"))
      expect(text).toContain(copy(env, "be_the_first_to_share_your_experience"))
      expect(text).not.toContain(
        copy(env, "rating_score_of_5").replace("{{rate}}", "0")
      )
    })

    it("both close buttons go back, each once", async () => {
      const session = await open(withPro(FULL))
      try {
        const closes = () =>
          session.root.findAll(
            (node) =>
              (node.type as unknown) === "svg:close" && node.parent !== null
          ).length
        expect(closes()).toBeGreaterThanOrEqual(2)
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:close", nth: 0 })
        })
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:close", nth: 1 })
        })
        expect(session.navigation.actions.map((action) => action.type)).toEqual(
          ["GO_BACK", "GO_BACK"]
        )
      } finally {
        session.unmount()
      }
    })

    it("a work tile opens the viewer on it and the scroll past the photo changes the status bar", async () => {
      const session = await open(withPro(FULL))
      try {
        const before = JSON.stringify(session.tree())
        await session.act(() => {
          fireHost(
            session.root,
            "RCTScrollView",
            "onScroll",
            [{ nativeEvent: { contentOffset: { y: 300 } } }],
            { nth: 0 }
          )
        })
        expect(JSON.stringify(session.tree())).not.toEqual(before)
        await session.act(() => {
          pressIcon(session.root, { icon: "FastImage", nth: 1 })
        })
        await session.settle(600)
        expect(JSON.stringify(session.tree())).not.toEqual(before)
      } finally {
        session.unmount()
      }
    })
  }
)
