/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's platform registry,
   so the screen is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import {
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
import { DATA } from "testing/screenKit/fixtures/api"
import { ROUTE_PARAMS } from "testing/screenKit/fixtures/routes"
import { CATEGORY, PRO_COMPANY, PRO_INDIVIDUAL } from "testing/screenKit/fixtures/entities"
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

const load = () => require("../ProProfileScreen")

const img = (n: number, extra: Partial<ProWorkPhotoType> = {}): ProWorkPhotoType => ({
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
  img(3, { mimeType: "video/mp4", url: "https://example.com/parity/work-3.mp4", posterUrl: "https://example.com/parity/work-3-poster.jpg" }),
  img(4, { mimeType: "video/mp4", url: "https://example.com/parity/work-4.mp4", posterUrl: null }),
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

const withCategory = (pro: ProType, subscriptions: object[] = [], featured = false): ProType => ({
  ...pro,
  serviceCategories: [
    { serviceCategoryId: CATEGORY.id, status: "active", isFeatured: featured, subscriptions } as never,
  ],
})

const FULL: ProType = {
  ...withCategory(
    PRO_COMPANY,
    [
      sticker(1, "featuredPro"),
      { id: 8, promoStickerMessage: "20% off on Tuesdays", product: { subType: "promoLine" } },
      sticker(2, "motivational"),
      sticker(3, "motivational"),
    ],
    true
  ),
  documents: [
    trust(1, { pictureEn: "https://example.com/parity/trust-en.svg", pictureAr: "https://example.com/parity/trust-ar.svg" }),
    trust(2, { descriptionEn: "ID verified" }),
    trust(3, { pictureEn: "https://example.com/parity/pending.svg" }, "pending"),
  ] as never,
  workPhotos: WORK,
  hours: [
    { id: 1, dayOfWeek: "Sunday", openingTime: "09:00", closingTime: "17:30" },
    { id: 2, dayOfWeek: "monday", openingTime: "08:00", closingTime: "20:00" },
    { id: 3, dayOfWeek: "Wednesday", openingTime: "00:00", closingTime: "23:59" },
    { id: 4, dayOfWeek: "friday", openingTime: "13:05", closingTime: "" },
  ],
  paymentMethods: ["cash", "credit card", "bank transfer"],
  socials: [
    { id: 1, socialMedia: "facebook", socialLink: "https://facebook.com/hassan.home" },
    { id: 2, socialMedia: "instagram", socialLink: "https://instagram.com/hassan.home" },
    { id: 3, socialMedia: "linkedin", socialLink: "https://linkedin.com/company/hassan-home-services-and-everything-else-they-do" },
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

const NO_PHOTO: ProType = { ...FULL, profilePhoto: undefined, profilePhoto150: undefined, profilePhoto720: undefined }

const SIGNED = screenState("data")
const withPro = (pro: ProType, params: object = {}) => ({
  ...SIGNED,
  api: { ...DATA, getProProfile: { data: pro } },
  http: () => ({ text: SVG_ART }),
  route: { name: "ProProfileScreen", params: { ...ROUTE_PARAMS.ProProfileScreen, ...params } },
})

const scrollTo = (y: number): Step => (root) =>
  fireHost(root, "RCTScrollView", "onScroll", [{ nativeEvent: { contentOffset: { y } } }], { nth: 0 })
const openViewer = (nth: number): Step => (root) => pressIcon(root, { icon: "FastImage", nth })

type Case = {
  state: string
  options: Omit<RenderScreenOptions, "lang" | "platform">
  steps?: Step[]
}

const CASES: Case[] = [
  // (A failed profile draws the same loading overlay as one still loading.)
  { state: "loading", options: { ...SIGNED, api: { ...DATA, getProProfile: "loading" }, route: withPro(PRO_INDIVIDUAL).route } },
  { state: "the plain individual", options: SIGNED_PLAIN() },
  { state: "a full company profile", options: withPro(FULL) },
  { state: "a minimal profile", options: withPro(MINIMAL) },
  { state: "no photo: the initial letter", options: withPro(NO_PHOTO) },
  { state: "no photo, an individual", options: withPro({ ...MINIMAL, profilePhoto: undefined, registeredName: "Mona Adel" }) },
  { state: "a long name", options: withPro({ ...FULL, businessName: "Hassan Home Services, Heating, Plumbing and Everything Else Around the House Company Limited" }) },
  { state: "a long name, featured, an individual", options: withPro({ ...withCategory(PRO_INDIVIDUAL, [sticker(1, "featuredPro")], true), registeredName: "Abdel Rahman Mohamed Ibrahim El Sayed Hassan Mahmoud Fahmy" }) },
  { state: "the listing's categories win over the pro's", options: withPro(MINIMAL, { serviceCategories: FULL.serviceCategories }) },
  // OffersSection's banner sizes its stickers from the window it loaded with.
  { state: "four stickers", options: withPro(withCategory(PRO_COMPANY, [sticker(2, "motivational"), sticker(3, "motivational"), sticker(4, "motivational"), sticker(5, "motivational")])) },
  { state: "four stickers, a 390-wide phone", options: { ...withPro(withCategory(PRO_COMPANY, [sticker(2, "motivational"), sticker(3, "motivational"), sticker(4, "motivational"), sticker(5, "motivational")])), window: { width: 390 } } },
  { state: "scrolled past the photo", options: withPro(FULL), steps: [scrollTo(300), wait(300)] },
  { state: "scrolled halfway into the header", options: withPro(FULL), steps: [scrollTo(260), wait(300)] },
  { state: "scrolled back up", options: withPro(FULL), steps: [scrollTo(300), wait(300), scrollTo(0), wait(300)] },
  { state: "the work-photo viewer open on the first tile", options: withPro(FULL), steps: [openViewer(0), wait(600)] },
  { state: "the work-photo viewer open on a video", options: withPro(FULL), steps: [openViewer(2), wait(600)] },
  { state: "no top inset", options: { ...withPro(FULL), insets: { top: 0 } } },
  { state: "a notch", options: { ...withPro(FULL), insets: { top: 59 } } },
]

function SIGNED_PLAIN() {
  return withPro(PRO_INDIVIDUAL)
}

const rows = rowsByPlatform(CASES, PARITY_MATRIX)
// A window's rows together (each window is a registry of its own).
const ordered = [...rows.filter((r) => !r.options.window), ...rows.filter((r) => r.options.window)]

describe("ProProfileScreen, captured from the unconverted code", () => {
  it.each(ordered)("$state [$env.language $env.platform]", async ({ state, options, steps, env }) => {
    const tree = await treeAfter(
      load,
      { ...options, lang: env.language, platform: env.platform },
      env,
      steps
    )
    expectParity(parityName(state, env), tree)
  })
})

describe.each(PARITY_MATRIX)("ProProfileScreen presses [$language $platform]", (env: ParityEnv) => {
  const open = (options: object) =>
    openScreen(load, { ...options, lang: env.language, platform: env.platform } as RenderScreenOptions)

  it("both close buttons go back, each once", async () => {
    const session = await open(withPro(FULL))
    try {
      const closes = () =>
        session.root.findAll((node) => (node.type as unknown) === "svg:close" && node.parent !== null).length
      expect(closes()).toBeGreaterThanOrEqual(2)
      await session.act(() => {
        pressIcon(session.root, { icon: "svg:close", nth: 0 })
      })
      await session.act(() => {
        pressIcon(session.root, { icon: "svg:close", nth: 1 })
      })
      expect(session.navigation.actions.map((action) => action.type)).toEqual(["GO_BACK", "GO_BACK"])
    } finally {
      session.unmount()
    }
  })

  it("a work tile opens the viewer on it and the scroll past the photo changes the status bar", async () => {
    const session = await open(withPro(FULL))
    try {
      const before = JSON.stringify(session.tree())
      await session.act(() => {
        fireHost(session.root, "RCTScrollView", "onScroll", [{ nativeEvent: { contentOffset: { y: 300 } } }], { nth: 0 })
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
})
