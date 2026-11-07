import { beforeAll, describe, expect, it, jest } from "@jest/globals"
import React, { act } from "react"
import { StyleSheet } from "react-native"
import TestRenderer from "react-test-renderer"

import type { ProType } from "types/pro"

/*
 * The pros listing's card (#522): a pro's stickers sit in the OFFERS box
 * (tappler-shared's OffersBox: the red tab over a white bordered box, the
 * stickers in thirds, or halves for a pair, from the start edge) after the
 * trust stickers, where the pink band at the card's foot was. The promo line
 * is the pro's text offer in the same box (#533): a pink box under the one
 * OFFERS tab, after the stickers if there are any, alone under the tab if
 * not. A pro with neither gets no tab at all. The rating is one red star and
 * "x of 5 (N Reviews)" (tappler-shared's RatingSummary); a pro with no
 * reviews keeps "New on Tappler" (RateComponent's).
 *
 * UI primitives are stand-ins that keep their props; OffersBox and the copy
 * are the real ones.
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
      {
        serviceCategoryId: 3,
        status: "active",
        isFeatured: false,
        subscriptions,
      },
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
// Every red banner tab on the card (the OFFERS box's, or the old promo
// line's OFFER), by its label, in tree order: found by the words they draw,
// not by a class string.
const tabLabels = (card: Node) =>
  findAll(card, (n) =>
    (n.children ?? []).some((c) => typeof c === "string" && /^OFFERS?$/.test(c))
  ).map((n) => (n.children ?? []).filter((c) => typeof c === "string").join(""))
const isBand = (n: Node) =>
  StyleSheet.flatten(n.props.style)?.backgroundColor === "#FFF8F8"
// The OFFERS box's two boxes (#533), by their grounds: the stickers' white
// one with its grey edge, and the text offer's pink one.
const isStickerBox = (n: Node) => {
  const style = StyleSheet.flatten(n.props.style)
  return (
    style?.backgroundColor === "#FFFFFF" && style?.borderColor === "#CCCCCC"
  )
}
const isTextOffer = (n: Node) =>
  StyleSheet.flatten(n.props.style)?.backgroundColor === "#FFEBEB"

// What a node's texts say, joined as one line.
const textOf = (node: Node | string): string =>
  typeof node === "string" ? node : (node.children ?? []).map(textOf).join("")

describe("ProCard: the OFFERS box", () => {
  beforeAll(async () => {
    await act(() => i18n.changeLanguage("en"))
  })

  it("puts the stickers and then the promo line's text in one OFFERS box", () => {
    const card = render([promoLine, sticker(1), sticker(2)])

    // One OFFERS tab over both (#533): the promo line has no OFFER tab of
    // its own any more.
    expect(tabLabels(card)).toEqual(["OFFERS"])
    // The stickers' white box, then the pink text offer under it, 8 below
    // and rounded at every corner, with the promo line's words.
    const nodes = findAll(card, () => true)
    const boxes = nodes.filter(isStickerBox)
    const texts = nodes.filter(isTextOffer)
    expect(boxes).toHaveLength(1)
    expect(texts).toHaveLength(1)
    expect(nodes.indexOf(boxes[0])).toBeLessThan(nodes.indexOf(texts[0]))
    expect(textOf(texts[0])).toBe("20% off on Tuesdays")
    expect(StyleSheet.flatten(texts[0].props.style)).toMatchObject({
      marginTop: 8,
      borderTopLeftRadius: 10,
    })
    // The stickers, one to a cell, each fitted into its slot at 45 tall.
    const art = findAll(card, (n) => n.type === "SvgUriContainer")
    expect(art.map((n) => n.props.uri)).toEqual(["en-1.svg", "en-2.svg"])
    expect(art.map((n) => [n.props.width, n.props.height])).toEqual([
      ["100%", 45],
      ["100%", 45],
    ])
    // The pink footer band is gone, and nothing bleeds past the card's edges.
    expect(findAll(card, isBand)).toHaveLength(0)
    expect(
      findAll(
        card,
        (n) => StyleSheet.flatten(n.props.style)?.marginHorizontal === -15
      )
    ).toHaveLength(0)
    // The buttons are the card's foot again.
    const foot = kids(card)[kids(card).length - 1]
    expect(JSON.stringify(foot)).toContain("Select me")
  })

  it("draws a lone promo line as the text offer under the OFFERS tab", () => {
    const card = render([promoLine])

    // The OFFERS box's tab over the pink text offer (#533), with no
    // stickers' box: the box is square only under the tab, its words 12 in
    // from every side.
    expect(tabLabels(card)).toEqual(["OFFERS"])
    expect(findAll(card, isStickerBox)).toHaveLength(0)
    const texts = findAll(card, isTextOffer)
    expect(texts).toHaveLength(1)
    expect(textOf(texts[0])).toBe("20% off on Tuesdays")
    const style = StyleSheet.flatten(texts[0].props.style)
    expect(style).toMatchObject({
      borderTopLeftRadius: 0,
      borderTopRightRadius: 10,
      borderBottomLeftRadius: 10,
      borderBottomRightRadius: 10,
      borderWidth: 1,
      borderColor: "#CCCCCC",
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 12,
      paddingBottom: 12,
    })
    expect(style).not.toHaveProperty("marginTop")
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
