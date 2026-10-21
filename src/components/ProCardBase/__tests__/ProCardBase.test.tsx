import { beforeAll, describe, expect, it, jest } from "@jest/globals"
import React, { act } from "react"
import TestRenderer from "react-test-renderer"

/*
 * The Other Pros card (ProCardBase) shows the profile page's OFFERS tab over
 * a pro's sticker band at its foot (#503). A pro with only a promo line keeps
 * that line's own OFFER tab and gets no OFFERS tab, as on the profile page;
 * a pro with neither gets no tab at all.
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
  return {
    DmView: host("DmView"),
    DmText: host("DmText"),
    ActionBtn: host("ActionBtn"),
  }
})
jest.mock("react-native-fast-image", () =>
  Object.assign(() => null, { resizeMode: { cover: "cover" } })
)
jest.mock("components/RateComponent/RateComponent", () => () => null)
jest.mock("components/SvgUriContainer/SvgUriContainer", () => {
  const { createElement } = jest.requireActual("react") as typeof React
  return (props: object) => createElement("SvgUriContainer", props)
})
jest.mock("assets/icons/chat-bubble.svg", () => () => null)
jest.mock("assets/icons/individual.svg", () => () => null)
jest.mock("assets/icons/business.svg", () => () => null)
jest.mock("assets/icons/mail.svg", () => () => null)

import i18n from "locales/i18n"
import ProCardBase from "../ProCardBase"

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

const render = (subscriptions: object[]) => {
  let renderer!: TestRenderer.ReactTestRenderer
  act(() => {
    renderer = TestRenderer.create(
      <ProCardBase
        displayName="Omar Hassan"
        isCompany={false}
        overallScore={4}
        reviewsCount={3}
        subscriptions={subscriptions}
      />
    )
  })
  return renderer.toJSON() as Node
}
const kids = (node: Node) =>
  (node.children ?? []).filter(
    (child): child is Node => typeof child !== "string"
  )
const findAll = (node: Node, match: (n: Node) => boolean): Node[] => [
  ...(match(node) ? [node] : []),
  ...kids(node).flatMap((child) => findAll(child, match)),
]
// Every red banner tab on the card (BannerContainer's and the promo line's
// share these classes), by its label.
const tabLabels = (card: Node) =>
  findAll(
    card,
    (n) => n.type === "DmView" && n.props.className === "bg-red px-[4] py-[2]"
  ).map((tab) => kids(tab)[0].children?.join(""))
const isBand = (n: Node) => n.props.style?.backgroundColor === "#FFF8F8"

describe("ProCardBase: the OFFERS tab", () => {
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
