/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, it } from "@jest/globals"

import { renderScreen, rowsByPlatform } from "testing/screenKit"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"

/*
 * OffersSection's OFFERS banner (BannerContainer), as ProProfileScreen draws
 * it (default) and FoodOrderView does (compact), at the two phone widths the
 * stickers' size follows (OffersSection reads the window as it loads), and
 * the strip the pro cards draw. Captured before W1's prep deleted the
 * `className` OffersSection hands BannerContainer (:108): BannerContainer is
 * imported by file path, so NativeWind hands it that class as a style it
 * never reads. The `containerClassName` beside it is NOT dead (the banner's
 * flex-row, wrap, centring and padding), and these rows pin it.
 */

const load = () => require("../OffersSection")

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
const STICKERS = [sticker(1), sticker(2), sticker(3)]

type Case = {
  name: string
  props: Record<string, unknown>
  width: number
}

const CASES: Case[] = [390, 402].flatMap((width) => [
  { name: `banner at ${width}`, props: { subscriptions: STICKERS }, width },
  {
    name: `banner, one sticker at ${width}`,
    props: { subscriptions: STICKERS.slice(0, 1) },
    width,
  },
  {
    name: `compact at ${width}`,
    props: { subscriptions: STICKERS, compact: true },
    width,
  },
  {
    name: `strip at ${width}`,
    props: { subscriptions: STICKERS, variant: "strip" },
    width,
  },
])
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("OffersSection, captured before the dead className went", () => {
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
