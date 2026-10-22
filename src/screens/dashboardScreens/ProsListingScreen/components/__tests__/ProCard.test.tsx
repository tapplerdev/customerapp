import { beforeAll, describe, expect, it, jest } from "@jest/globals"
import React, { act } from "react"
import { StyleSheet } from "react-native"
import TestRenderer from "react-test-renderer"

import type { ProType } from "types/pro"

/*
 * The pros listing's card shows the profile page's OFFERS tab over a pro's
 * sticker band at its foot (#503). A pro with only a promo line keeps that
 * line's own OFFER tab and gets no OFFERS tab, as on the profile page; a pro
 * with neither gets no tab at all.
 *
 * UI primitives are stand-ins that keep their props; OffersSection,
 * BannerContainer, the promo line (tappler-shared's) and the copy are the
 * app's real ones.
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
jest.mock("react-native-fast-image", () =>
  Object.assign(() => null, { resizeMode: { cover: "cover" } })
)
jest.mock("rn-tourguide", () => ({
  TourGuideZone: ({ children }: { children?: React.ReactNode }) => children,
}))
jest.mock("components/RateComponent/RateComponent", () => () => null)
jest.mock("components/SvgUriContainer/SvgUriContainer", () => {
  const { createElement } = jest.requireActual("react") as typeof React
  return (props: object) => createElement("SvgUriContainer", props)
})
jest.mock("assets/icons/location-red.svg", () => () => null)
jest.mock("assets/icons/delivery-truck.svg", () => () => null)
jest.mock("assets/icons/pickup-bag.svg", () => () => null)
jest.mock("assets/icons/individual.svg", () => () => null)
jest.mock("assets/icons/business.svg", () => () => null)
jest.mock("assets/icons/messages-red.svg", () => () => null)
jest.mock("assets/icons/reply.svg", () => () => null)

import i18n from "locales/i18n"
import ProCard from "../ProCard"

type Node = TestRenderer.ReactTestRendererJSON

const sticker = (id: number) => ({
  id,
  product: { subType: "motivational", pictureEn: `en-${id}.svg` },
})
const promoLine = {
  id: 7,
  promoStickerMessage: "20% off on Tuesdays",
  product: { subType: "promoLine" },
}
// The search API's pro, with only what the card reads. The subscriptions
// carry their product, which ProSubscriptionType doesn't declare.
const proWith = (subscriptions: object[]) =>
  ({
    id: 1,
    registeredName: "Omar Hassan",
    proType: "individual",
    serviceCategories: [
      { serviceCategoryId: 3, status: "active", isFeatured: false, subscriptions },
    ],
  }) as unknown as ProType

const render = (subscriptions: object[]) => {
  let renderer!: TestRenderer.ReactTestRenderer
  act(() => {
    renderer = TestRenderer.create(
      <ProCard
        pro={proWith(subscriptions)}
        isSelected={false}
        onSelect={() => {}}
      />
    )
  })
  // The card itself, inside its list margins.
  return kids(renderer.toJSON() as Node)[0]
}
const kids = (node: Node) =>
  (node.children ?? []).filter(
    (child): child is Node => typeof child !== "string"
  )
const findAll = (node: Node, match: (n: Node) => boolean): Node[] => [
  ...(match(node) ? [node] : []),
  ...kids(node).flatMap((child) => findAll(child, match)),
]
// Every red banner tab on the card (BannerContainer's and the promo line's),
// by its label, in tree order: found by the words they draw, not by a class
// string, since shared's PromoLine draws through the design system now.
const tabLabels = (card: Node) =>
  findAll(card, (n) =>
    (n.children ?? []).some((c) => typeof c === "string" && /^OFFERS?$/.test(c))
  ).map((n) => (n.children ?? []).filter((c) => typeof c === "string").join(""))
const isBand = (n: Node) =>
  StyleSheet.flatten(n.props.style)?.backgroundColor === "#FFF8F8"

describe("ProCard: the OFFERS tab", () => {
  beforeAll(async () => {
    await act(() => i18n.changeLanguage("en"))
  })

  it("puts the OFFERS tab on the sticker band at the card's foot", () => {
    const card = render([promoLine, sticker(1), sticker(2)])

    // The promo line's OFFER tab, then the band's OFFERS tab.
    expect(tabLabels(card)).toEqual(["OFFER", "OFFERS"])
    // The footer band: the tab right over the stickers' band.
    const footer = kids(card)[kids(card).length - 1]
    expect(footer.props.className).toBe("mt-[14] overflow-hidden")
    const [tab, band] = kids(kids(footer)[0])
    expect(tabLabels(tab)).toEqual(["OFFERS"])
    expect(isBand(band)).toBe(true)
    expect(kids(band).map((art) => art.props.uri)).toEqual([
      "en-1.svg",
      "en-2.svg",
    ])
  })

  it("keeps a lone promo line's OFFER tab, with no OFFERS tab", () => {
    const card = render([promoLine])

    expect(tabLabels(card)).toEqual(["OFFER"])
    expect(JSON.stringify(card)).toContain("20% off on Tuesdays")
    expect(JSON.stringify(card)).not.toContain("OFFERS")
    expect(findAll(card, isBand)).toHaveLength(0)
  })

  it("has no tab for a pro with no stickers or promo line", () => {
    const card = render([])

    expect(tabLabels(card)).toEqual([])
    expect(JSON.stringify(card)).not.toContain("OFFER")
    expect(findAll(card, isBand)).toHaveLength(0)
  })
})
