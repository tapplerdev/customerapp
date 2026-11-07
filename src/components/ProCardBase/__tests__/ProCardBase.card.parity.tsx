/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"
import path from "path"

import {
  copy,
  openScreen,
  pressTitled,
  renderScreen,
  rowsByPlatform,
} from "testing/screenKit"
import {
  PARITY_MATRIX,
  captureCommit,
  expectParity,
  parityName,
  type ParityAllowance,
} from "testing/hostTreeParity"
import {
  buildProps,
  componentImport,
  expectClassFree,
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestOptions,
} from "testing/harvest"

/*
 * ProCardBase as its one call site draws it (JobDetailScreen:499, the Other
 * Pros list: the offer badge and the opportunity notes always on, the Select
 * and Pass buttons while the job is active, the Rejected label once passed),
 * over the pro data a card can hold: a bare individual, and a company with
 * every optional part (photo, Featured badge, description, trust badges of
 * both kinds, a promo line and stickers, an offer amount, unread mail, an
 * opportunity note), and an offer with no amount. Beside the promo-line rows
 * of ProCardBase.promoLine.parity.tsx. The kit, for the icons, the image and
 * the sticker art.
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/ProCardBase.cases.json (the data props are the
 * hand cases below). The trees in __parity__ were captured from the
 * component before its conversion (each case names the commit).
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
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
 * #532 groups thousands in every price ("1,250 EGP"), and the card's amount
 * takes the app's own EGP word (it was a hard-coded "EGP", so Arabic read
 * "450 EGP"). The states that draw an amount are drawn again under a
 * "#532 commas" name and captured beside the frozen ones, which no row draws
 * any more.
 */
const load = () => require("../ProCardBase")

/** Button's listed deltas, for the two ActionBtns the conversion turns into Buttons. */
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const FILES = harvestFilesFor(__dirname, "ProCardBase")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("ProCardBase"),
  props: {
    displayName: "any",
    photoUrl: "any",
    isCompany: "any",
    overallScore: "any",
    reviewsCount: "any",
    isFeatured: "any",
    trustDocs: "any",
    subscriptions: "any",
    offerAmount: "any",
    opportunityNotes: "any",
    showOfferBadge: "bool",
    showOpportunityNotes: "bool",
    showSelectPassButtons: "bool",
    isRejected: "bool",
    isAr: "any",
    onPress: "fn",
    onSelect: "fn",
    onPass: "fn",
  },
}

const SVG_ART =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 118 31"><rect width="118" height="31" fill="#CC0000"/></svg>'
const art = (name: string) => `https://example.com/parity/${name}.svg`
const sticker = (id: number) => ({
  id,
  product: {
    subType: "motivational",
    pictureEn: art(`sticker-${id}-en`),
    pictureAr: art(`sticker-${id}-ar`),
  },
})
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
    pictureEn: `https://example.com/parity/sticker-${id}-en.svg`,
    pictureAr: `https://example.com/parity/sticker-${id}-ar.svg`,
    icon: `https://example.com/parity/icon-${id}.svg`,
    labelEn,
    labelAr,
    id,
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

const PROMO = {
  id: 7,
  promoStickerMessage: "20% off on Tuesdays",
  product: { subType: "promoLine" },
}

/** The data a card is handed (what JobDetail reads off the pro and the offer). */
const DATA: { name: string; props: Record<string, unknown> }[] = [
  {
    name: "bare individual, #522 card, #532 commas",
    props: {
      displayName: "Omar Hassan",
      isCompany: false,
      overallScore: 4,
      reviewsCount: 3,
      subscriptions: [],
      trustDocs: [],
      offerAmount: 450,
    },
  },
  {
    name: "company with everything, #522 card, #525 offers, #525 equal slots, #532 commas",
    props: {
      displayName: "Nile Plumbing Co.",
      photoUrl: "https://example.com/parity/pro.jpg",
      isCompany: true,
      overallScore: 4.5,
      reviewsCount: 27,
      isFeatured: true,
      informationAbout: "Ten years fixing plumbing and electrics in Giza.",
      trustDocs: [
        {
          id: 1,
          trustDocumentData: {
            trustProduct: {
              pictureEn: art("trust-en"),
              pictureAr: art("trust-ar"),
            },
          },
        },
        {
          id: 2,
          trustDocumentData: {
            trustProduct: {
              descriptionEn: "ID verified",
              descriptionAr: "الهوية موثقة",
            },
          },
        },
        { id: 3 },
      ],
      subscriptions: [PROMO, sticker(1), sticker(2)],
      offerAmount: 1250,
      opportunityNotes: "I can start tomorrow morning and bring the parts.",
      unreadCount: 3,
    },
  },
  {
    name: "offer with no amount, #522 card, #525 offers, #525 equal slots",
    props: {
      displayName: "Mona Adel",
      isCompany: false,
      overallScore: 0,
      reviewsCount: 0,
      subscriptions: [sticker(1)],
      trustDocs: [],
      offerAmount: null,
      opportunityNotes: "",
      unreadCount: 0,
    },
  },
  // #533: icon stickers (the icon above the caption, top-aligned in its
  // cell), in catalogue order (product id; the first capture went oldest
  // subscription first and stays beside it), one captioned in English only
  // (its picture in Arabic), an icon that fails to load drawn as its
  // picture, and one whose picture fails too drawn as its caption alone.
  // New, under a "#533 offers" name; the rows above draw what they drew.
  {
    name: "icon stickers, in catalogue order, #533 offers",
    props: {
      displayName: "Mona Adel",
      isCompany: false,
      overallScore: 4,
      reviewsCount: 3,
      subscriptions: [
        // Neither the order given nor the subscriptions' (11, 12, 15): the
        // catalogue's, Fast Response (3), Installments (22), Free delivery
        // on orders (40).
        iconSticker(12, "Free delivery on orders", "توصيل مجاني لكل الطلبات", {
          id: 40,
        }),
        iconSticker(11, "Installments", "الدفع بالتقسيط", { id: 22 }),
        iconSticker(15, "Fast Response", "", { id: 3 }),
      ],
      trustDocs: [],
      offerAmount: 450,
    },
  },
  {
    name: "an icon that fails to load, drawn as its picture, #533 offers",
    props: {
      displayName: "Mona Adel",
      isCompany: false,
      overallScore: 4,
      reviewsCount: 3,
      subscriptions: [
        iconSticker(11, "Installments", "الدفع بالتقسيط"),
        iconSticker(16, "Free Manicure", "مانيكير مجاني", BROKEN_ICON),
      ],
      trustDocs: [],
      offerAmount: 450,
    },
  },
  {
    name: "a failed icon whose picture fails too, its caption alone, #533 offers",
    props: {
      displayName: "Mona Adel",
      isCompany: false,
      overallScore: 4,
      reviewsCount: 3,
      subscriptions: [
        iconSticker(11, "Installments", "الدفع بالتقسيط"),
        iconSticker(18, "Free Manicure", "مانيكير مجاني", BROKEN_ART),
      ],
      trustDocs: [],
      offerAmount: 450,
    },
  },
]

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "ProCardBase", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)

  it("the cases hand it no class, no DmText and no ActionBtn", () => {
    expectClassFree(cases.cases)
  })

  const sets = Object.entries(cases.cases).flatMap(([id, entry]) =>
    DATA.map(({ name, props }) => ({
      name: `${id} ${name}`,
      props: {
        ...buildProps(entry.props, { opaque: () => undefined }),
        ...props,
      },
    }))
  )
  const rows = rowsByPlatform(sets, PARITY_MATRIX)

  describe("the class-name path draws as before", () => {
    it.each(rows)("$name [$env.language $env.platform]", async (row) => {
      const tree = await renderScreen(load, {
        lang: row.env.language,
        platform: row.env.platform,
        // ICON_HTTP answers SVG_ART for every url but #533's icons.
        http: ICON_HTTP,
        navigation: "none",
        props: { ...row.props, isAr: row.env.language === "ar" },
      })
      // Select me and Pass are ActionBtns the conversion turned into Buttons:
      // their listed deltas, on the rows that draw them.
      const buttons = row.props.showSelectPassButtons && !row.props.isRejected
      expectParity(
        parityName(row.name, row.env),
        tree,
        buttons ? { allow: BUTTON } : undefined
      )
    })
  })

  // The converted buttons' handlers run (functions don't show in a tree).
  describe("Select me and Pass take a press", () => {
    it.each(PARITY_MATRIX)("[$language $platform]", async (env) => {
      const onSelect = jest.fn()
      const onPass = jest.fn()
      const session = await openScreen(load, {
        lang: env.language,
        platform: env.platform,
        http: () => ({ text: SVG_ART }),
        navigation: "none",
        props: {
          ...DATA[0].props,
          showSelectPassButtons: true,
          isAr: env.language === "ar",
          onSelect,
          onPass,
        },
      })
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "select_me").toUpperCase())
        })
        expect(onSelect).toHaveBeenCalledTimes(1)
        expect(onPass).not.toHaveBeenCalled()
        await session.act(() => {
          pressTitled(session.root, copy(env, "pass").toUpperCase())
        })
        expect(onPass).toHaveBeenCalledTimes(1)
        expect(onSelect).toHaveBeenCalledTimes(1)
      } finally {
        session.unmount()
      }
    })
  })
}
