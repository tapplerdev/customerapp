import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals"
import React, { act } from "react"
import { StyleSheet } from "react-native"
import TestRenderer from "react-test-renderer"

/*
 * The pro card's sticker band (the strip) carries the OFFERS tab the profile
 * page shows over the same stickers (#503), as the pro app's preview of this
 * card does since proapp #63: BannerContainer's red tab, same classes and the
 * same `offers` copy ("OFFERS", Arabic "عروض"), on the band's top edge. A pro
 * without stickers gets no band and no tab.
 *
 * UI primitives are stand-ins that keep their props, so the classes can be
 * read; BannerContainer and the copy are the app's real ones.
 */

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)
jest.mock("@tappler/shared/src/components/UI", () => {
  const { createElement } = jest.requireActual("react") as typeof React
  const host =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      createElement(name, props, children)
  return { DmView: host("DmView"), DmText: host("DmText") }
})
jest.mock("components/SvgUriContainer/SvgUriContainer", () => {
  const { createElement } = jest.requireActual("react") as typeof React
  return (props: object) => createElement("SvgUriContainer", props)
})

import i18n from "locales/i18n"
import OffersSection from "../OffersSection"

type Node = TestRenderer.ReactTestRendererJSON

const sticker = (id: number) => ({
  id,
  product: {
    subType: "motivational",
    pictureEn: `en-${id}.svg`,
    pictureAr: `ar-${id}.svg`,
  },
})
const promoLine = {
  id: 7,
  promoStickerMessage: "20% off on Tuesdays",
  product: { subType: "promoLine" },
}
const featuredPro = { id: 8, product: { subType: "featuredPro" } }

const render = (element: React.ReactElement) => {
  let renderer!: TestRenderer.ReactTestRenderer
  act(() => {
    renderer = TestRenderer.create(element)
  })
  return renderer.toJSON() as Node | null
}
const kids = (node: Node) =>
  (node.children ?? []).filter(
    (child): child is Node => typeof child !== "string"
  )
// A tab row's red tab, and the label in it.
const tabIn = (row: Node) => kids(row)[0]
const labelOf = (tab: Node) => kids(tab)[0]

describe("OffersSection's strip: the OFFERS tab", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage("en"))
  })

  afterAll(async () => {
    await act(() => i18n.changeLanguage("en"))
  })

  it("puts the profile's OFFERS tab on the band of a pro's stickers", () => {
    const strip = render(
      <OffersSection
        subscriptions={[sticker(1), promoLine, sticker(2)]}
        variant="strip"
      />
    ) as Node

    // The tab, then the band right under it.
    expect(kids(strip)).toHaveLength(2)
    const [inset, band] = kids(strip)
    // From the start edge, inset 10pt over the first sticker.
    expect(inset.type).toBe("DmView")
    expect(StyleSheet.flatten(inset.props.style)).toEqual({
      paddingLeft: 10,
      paddingRight: 10,
    })
    // BannerContainer's tab and the profile's copy: the tab itself is
    // BannerContainer's (its own parity rows pin what it draws), so it is
    // found by its words here, and the next test pins it against the banner's.
    const tabRow = kids(inset)[0]
    expect(labelOf(tabIn(tabRow)).children).toEqual(["OFFERS"])
    // The band itself is unchanged: its tint, and only the stickers in it.
    expect(StyleSheet.flatten(band.props.style)).toEqual({
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 10,
      paddingRight: 10,
      backgroundColor: "#FFF8F8",
      rowGap: 6,
    })
    expect(kids(band).map((art) => art.props.uri)).toEqual([
      "en-1.svg",
      "en-2.svg",
    ])
  })

  it("draws the same tab as the profile page's banner", () => {
    const subscriptions = [sticker(1), sticker(2)]
    const banner = render(<OffersSection subscriptions={subscriptions} />) as Node
    const strip = render(
      <OffersSection subscriptions={subscriptions} variant="strip" />
    ) as Node

    // The banner (ProProfileScreen) keeps its tab, as its first row.
    const bannerTabRow = kids(banner)[0]
    expect(labelOf(tabIn(bannerTabRow)).children).toEqual(["OFFERS"])
    expect(kids(kids(strip)[0])[0]).toEqual(bannerTabRow)
  })

  it("reads the Arabic label, عروض, over the Arabic stickers", async () => {
    await act(() => i18n.changeLanguage("ar"))
    const strip = render(
      <OffersSection subscriptions={[sticker(1), sticker(2)]} variant="strip" />
    ) as Node

    const [inset, band] = kids(strip)
    expect(labelOf(tabIn(kids(inset)[0])).children).toEqual(["عروض"])
    expect(kids(band).map((art) => art.props.uri)).toEqual([
      "ar-1.svg",
      "ar-2.svg",
    ])
  })

  it("has no band and no tab for a pro without stickers", () => {
    expect(render(<OffersSection subscriptions={[]} variant="strip" />)).toBeNull()
    // A promo line has its own OFFER banner (PromoLine), so on its own it
    // gets no OFFERS tab here, as on the profile page.
    expect(
      render(
        <OffersSection subscriptions={[promoLine, featuredPro]} variant="strip" />
      )
    ).toBeNull()
  })
})
