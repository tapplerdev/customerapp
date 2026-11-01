import { beforeAll, describe, expect, it, jest } from "@jest/globals"
import React, { act } from "react"
import { StyleSheet } from "react-native"
import TestRenderer from "react-test-renderer"

import type { ProType } from "types/pro"

/*
 * The pros listing's card (#522): a pro's stickers sit in the OFFERS box
 * (tappler-shared's OffersBox: the red tab over a white bordered box, the
 * stickers spread evenly) after the trust stickers and before the promo
 * line, where the pink band at the card's foot was. A pro with only a promo
 * line keeps that line's own OFFER tab and gets no OFFERS box; a pro with
 * neither gets no tab at all. The rating is one red star and "x of 5 (N
 * Reviews)" (tappler-shared's RatingSummary); a pro with no reviews keeps
 * "New on Tappler" (RateComponent's).
 *
 * UI primitives are stand-ins that keep their props; OffersBox, the promo
 * line (tappler-shared's) and the copy are the real ones.
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
jest.mock("components/RateComponent/RateComponent", () => {
  const { createElement } = jest.requireActual("react") as typeof React
  return (props: object) => createElement("RateComponent", props)
})
jest.mock("@tappler/shared/src/components/RatingStarIcon", () => {
  const { createElement } = jest.requireActual("react") as typeof React
  return (props: object) => createElement("RatingStarIcon", props)
})
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
const proWith = (
  subscriptions: object[],
  reviewScore = { overallScore: 4, reviewsCount: 3 }
) =>
  ({
    id: 1,
    registeredName: "Omar Hassan",
    proType: "individual",
    reviewScore,
    serviceCategories: [
      { serviceCategoryId: 3, status: "active", isFeatured: false, subscriptions },
    ],
  }) as unknown as ProType

const render = (
  subscriptions: object[],
  reviewScore?: { overallScore: number; reviewsCount: number }
) => {
  let renderer!: TestRenderer.ReactTestRenderer
  act(() => {
    renderer = TestRenderer.create(
      <ProCard
        pro={proWith(subscriptions, reviewScore)}
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

// What a node's texts say, joined as one line.
const textOf = (node: Node | string): string =>
  typeof node === "string" ? node : (node.children ?? []).map(textOf).join("")

describe("ProCard: the OFFERS box", () => {
  beforeAll(async () => {
    await act(() => i18n.changeLanguage("en"))
  })

  it("puts the stickers in the OFFERS box, before the promo line", () => {
    const card = render([promoLine, sticker(1), sticker(2)])

    // The box's OFFERS tab, then the promo line's OFFER tab.
    expect(tabLabels(card)).toEqual(["OFFERS", "OFFER"])
    // The stickers, one to a cell, each as wide as its cell at 30 tall.
    const art = findAll(card, (n) => n.type === "SvgUriContainer")
    expect(art.map((n) => n.props.uri)).toEqual(["en-1.svg", "en-2.svg"])
    expect(art.map((n) => [n.props.width, n.props.height])).toEqual([
      ["100%", 30],
      ["100%", 30],
    ])
    // The pink footer band is gone, and nothing bleeds past the card's edges.
    expect(findAll(card, isBand)).toHaveLength(0)
    expect(
      findAll(card, (n) => StyleSheet.flatten(n.props.style)?.marginHorizontal === -15)
    ).toHaveLength(0)
    // The buttons are the card's foot again.
    const foot = kids(card)[kids(card).length - 1]
    expect(JSON.stringify(foot)).toContain("Select me")
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

describe("ProCard: the rating", () => {
  beforeAll(async () => {
    await act(() => i18n.changeLanguage("en"))
  })

  it("draws one red star and the score with its count", () => {
    const card = render([], { overallScore: 4.5, reviewsCount: 12 })

    expect(findAll(card, (n) => n.type === "RatingStarIcon")).toHaveLength(1)
    expect(findAll(card, (n) => n.type === "RateComponent")).toHaveLength(0)
    expect(findAll(card, (n) => n.type === "Text").map(textOf)).toContain(
      "4.5 of 5 (12 Reviews)"
    )
  })

  it("keeps New on Tappler for a pro with no reviews", () => {
    const card = render([], { overallScore: 0, reviewsCount: 0 })

    // RateComponent's own no-rating line, not "No reviews yet".
    const rate = findAll(card, (n) => n.type === "RateComponent")
    expect(rate).toHaveLength(1)
    expect(rate[0].props).toMatchObject({ rate: 0, reviewsCount: 0 })
    expect(findAll(card, (n) => n.type === "RatingStarIcon")).toHaveLength(0)
    expect(JSON.stringify(card)).not.toContain("No reviews yet")
  })
})
