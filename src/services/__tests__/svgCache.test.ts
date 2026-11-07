import { afterAll, describe, expect, it, jest } from "@jest/globals"

import { collectProStickerUrls, loadSvg, peekSvg } from "../svgCache"

/*
 * What the listing warms before the cards draw (#533): each sticker's art as
 * the card draws it, the icon when it has one and a caption in the language,
 * else its picture for the language, in catalogue order (product id); then
 * the approved trust badges, as before.
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
  it("warms the icon a sticker is drawn with, else its picture, in catalogue order", () => {
    const pro = proWith([
      sticker(4, { id: 61 }),
      sticker(9, { id: 18, icon: ICON, labelEn: "Installments", labelAr: "" }),
      { id: 1, product: { subType: "promoLine" } },
    ])

    expect(collectProStickerUrls([pro], false)).toEqual([
      ICON,
      "https://example.com/4-en.svg",
    ])
    // No Arabic caption: the Arabic picture, never the English one.
    expect(collectProStickerUrls([pro], true)).toEqual([
      "https://example.com/9-ar.svg",
      "https://example.com/4-ar.svg",
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

/*
 * What loadSvg keeps (#533): only a body SvgXml can draw. One without <svg
 * (an error page answered with a 200) or one that doesn't parse (cut short)
 * resolves to nothing, so SvgUriContainer reports a failed load and a
 * sticker's icon falls back, and it isn't cached for the session. The parse
 * is react-native-svg's own, the one SvgXml runs.
 */
describe("loadSvg", () => {
  const realFetch = global.fetch
  const answer = (body: string) => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ text: () => Promise.resolve(body) })
    ) as unknown as typeof fetch
  }

  afterAll(() => {
    global.fetch = realFetch
  })

  it("keeps an SVG that parses", async () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M0 0L24 24"/></svg>'
    answer(svg)

    await expect(loadSvg("https://example.com/ok.svg")).resolves.toBe(svg)
    expect(peekSvg("https://example.com/ok.svg")).toBe(svg)
  })

  it("keeps nothing for a body without <svg", async () => {
    answer("<html><body>Bad gateway</body></html>")

    await expect(loadSvg("https://example.com/html.svg")).resolves.toBeNull()
    expect(peekSvg("https://example.com/html.svg")).toBeNull()
  })

  it("keeps nothing for an SVG that doesn't parse", async () => {
    answer('<svg viewBox="0 0 24 24"><path d="M0 0L24')

    await expect(loadSvg("https://example.com/cut.svg")).resolves.toBeNull()
    expect(peekSvg("https://example.com/cut.svg")).toBeNull()
  })
})
