/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, it } from "@jest/globals"

import { renderScreen, rowsByPlatform } from "testing/screenKit"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"

/*
 * OffersSection over the subscription lists its four call sites hand it
 * (ProCardBase:268 and ProCard:332 the strip, FoodOrderView:477 compact,
 * ProProfileScreen:316 the banner), beside the banner rows of
 * OffersSection.banner.parity.tsx: a pro's list holds more than stickers
 * (a promo line, a featured-pro marker), a sticker with art in one language
 * only draws nothing in the other (`uri ? ... : null`), and a list with no
 * sticker draws nothing. At the two phone widths the stickers' size follows.
 * The banner rows' sticker art answer (a plain rectangle) is this file's too.
 *
 *   yarn ds:parity:capture <this file> --force   recapture, on the old code only
 */

const load = () => require("../OffersSection")

const SVG_ART =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 118 31"><rect width="118" height="31" fill="#CC0000"/></svg>'

const sticker = (id: number, art: { en?: string; ar?: string } = {}) => ({
  id,
  product: {
    subType: "motivational",
    pictureEn: art.en ?? `https://example.com/parity/sticker-${id}-en.svg`,
    pictureAr: art.ar ?? `https://example.com/parity/sticker-${id}-ar.svg`,
  },
})
const PROMO = {
  id: 7,
  promoStickerMessage: "20% off on Tuesdays",
  product: { subType: "promoLine" },
}
const FEATURED = { id: 8, product: { subType: "featuredPro" } }

const LISTS: { name: string; subscriptions: object[] }[] = [
  {
    name: "stickers among a promo line and a featured marker",
    subscriptions: [PROMO, sticker(1), FEATURED, sticker(2)],
  },
  { name: "promo line and featured only", subscriptions: [PROMO, FEATURED] },
  { name: "no subscriptions", subscriptions: [] },
  {
    name: "a sticker with no Arabic art",
    subscriptions: [sticker(1), sticker(2, { ar: "" }), sticker(3)],
  },
  {
    name: "two stickers",
    subscriptions: [sticker(1), sticker(2)],
  },
  {
    name: "five stickers",
    subscriptions: [1, 2, 3, 4, 5].map((id) => sticker(id)),
  },
]
const VARIANTS = [
  { name: "banner", props: {} },
  { name: "compact", props: { compact: true } },
  { name: "strip", props: { variant: "strip" } },
]
const WINDOWS = [390, 402]

const rows = WINDOWS.flatMap((width) =>
  rowsByPlatform(
    LISTS.flatMap((list) =>
      VARIANTS.map((variant) => ({
        name: `${list.name}, ${variant.name} at ${width}`,
        width,
        props: { subscriptions: list.subscriptions, ...variant.props },
      }))
    ),
    PARITY_MATRIX
  )
)

describe("OffersSection over its call sites' lists, captured before the conversion", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (row) => {
    const tree = await renderScreen(load, {
      lang: row.env.language,
      platform: row.env.platform,
      window: { width: row.width },
      http: () => ({ text: SVG_ART }),
      navigation: "none",
      props: row.props,
    })
    expectParity(parityName(row.name, row.env), tree)
  })
})
