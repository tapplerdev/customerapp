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
const PROMO = {
  id: 7,
  promoStickerMessage: "20% off on Tuesdays",
  product: { subType: "promoLine" },
}

/** The data a card is handed (what JobDetail reads off the pro and the offer). */
const DATA: { name: string; props: Record<string, unknown> }[] = [
  {
    name: "bare individual, #522 card",
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
    name: "company with everything, #522 card",
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
    name: "offer with no amount, #522 card",
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
        http: () => ({ text: SVG_ART }),
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
