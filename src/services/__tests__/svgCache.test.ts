import { describe, expect, it } from "@jest/globals"

import { collectProStickerUrls } from "../svgCache"

/*
 * What the listing warms before the cards draw (#533): each sticker's art as
 * the card draws it, the icon when it has one and a caption in the language,
 * else its picture for the language, oldest first; then the approved trust
 * badges, as before.
 */

const ICON = "https://example.com/icon.svg"
const sticker = (id: number, product: object) => ({
  id,
  product: {
    subType: "motivational",
    pictureEn: `https://example.com/${id}-en.svg`,
    pictureAr: `https://example.com/${id}-ar.svg`,
    ...product,
  },
})
const proWith = (subscriptions: object[], documents: object[] = []) => ({
  serviceCategories: [{ subscriptions }],
  documents,
})

describe("collectProStickerUrls", () => {
  it("warms the icon a sticker is drawn with, else its picture, oldest first", () => {
    const pro = proWith([
      sticker(9, {}),
      sticker(4, { icon: ICON, labelEn: "Installments", labelAr: "" }),
      { id: 1, product: { subType: "promoLine" } },
    ])

    expect(collectProStickerUrls([pro], false)).toEqual([
      ICON,
      "https://example.com/9-en.svg",
    ])
    // No Arabic caption: the Arabic picture, never the English one.
    expect(collectProStickerUrls([pro], true)).toEqual([
      "https://example.com/4-ar.svg",
      "https://example.com/9-ar.svg",
    ])
  })

  it("warms nothing for a sticker with no art in the language", () => {
    const pro = proWith([sticker(2, { pictureAr: "" })])

    expect(collectProStickerUrls([pro], true)).toEqual([])
  })

  it("still warms the approved trust badges, after the stickers", () => {
    const pro = proWith(
      [sticker(3, {})],
      [
        {
          type: "trust",
          status: "approved",
          trustDocumentData: {
            trustProduct: { pictureEn: "https://example.com/trust-en.svg" },
          },
        },
        { type: "trust", status: "pending" },
      ]
    )

    expect(collectProStickerUrls([pro], false)).toEqual([
      "https://example.com/3-en.svg",
      "https://example.com/trust-en.svg",
    ])
  })

  it("stops at the limit", () => {
    const pros = [proWith([sticker(1, {})]), proWith([sticker(2, {})])]

    expect(collectProStickerUrls(pros, false, 1)).toEqual([
      "https://example.com/1-en.svg",
    ])
  })
})
