/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, it } from "@jest/globals"

import { renderScreen, rowsByPlatform } from "testing/screenKit"
import { PRO_INDIVIDUAL } from "testing/screenKit/fixtures/entities"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"

/*
 * The ProsListing card's promo line. PromoLine is imported by file path, so
 * the `className` the card gave it (:274) reached the component as a style it
 * never read: captured before W1's prep deleted it.
 */

/*
 * #522 redrew the pro card (one red star and "x of 5 (N Reviews)" for a
 * reviewed pro, "New on Tappler" kept for the rest; trust stickers in slots
 * as tall as their art; the OFFERS box after the trust stickers in place of
 * the pink footer band), so the states that draw one are drawn again under a
 * "#522 card" name and captured beside the frozen ones, which no row draws
 * any more.
 */
const load = () => require("../ProCard")

const promoLine = {
  id: 7,
  promoStickerMessage: "20% off on Tuesdays",
  product: { subType: "promoLine" },
}
// The sticker art the screen fetches: a plain rectangle, so the stickers draw.
const SVG_ART =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 118 31"><rect width="118" height="31" fill="#CC0000"/></svg>'

const sticker = (id: number) => ({
  id,
  product: {
    subType: "motivational",
    pictureEn: `https://example.com/parity/sticker-${id}-en.svg`,
    pictureAr: `https://example.com/parity/sticker-${id}-ar.svg`,
  },
})
const proWith = (subscriptions: object[]) =>
  ({
    ...PRO_INDIVIDUAL,
    serviceCategories: [
      { serviceCategoryId: 301, status: "active", isFeatured: false, subscriptions },
    ],
  }) as never

const CASES = [
  { name: "promo line only, #522 card", subscriptions: [promoLine] },
  {
    name: "promo line and stickers, #522 card",
    subscriptions: [promoLine, sticker(1), sticker(2)],
  },
  { name: "stickers only, #522 card", subscriptions: [sticker(1)] },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("ProCard promo line, captured before the dead className went", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (row) => {
    const tree = await renderScreen(load, {
      lang: row.env.language,
      platform: row.env.platform,
      http: () => ({ text: SVG_ART }),
      navigation: "none",
      props: {
        pro: proWith(row.subscriptions),
        isSelected: false,
        onSelect: () => {},
      },
    })
    expectParity(parityName(row.name, row.env), tree)
  })
})
