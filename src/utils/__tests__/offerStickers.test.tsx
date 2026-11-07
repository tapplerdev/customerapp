import { describe, expect, it, jest } from "@jest/globals"
import React from "react"

import { stickerCell, stickersOf, withoutFailedPicture } from "../offerStickers"

/*
 * The last step of a sticker's fallback (#533): a sticker whose icon and then
 * picture failed to load is drawn as its caption alone; one that only ever
 * had a picture keeps it when it fails. stickerCell reports a picture's
 * failure as offerStickerCell reports an icon's.
 */

// Hoisted above the imports: offerStickers draws with this stand-in.
jest.mock("components/SvgUriContainer/SvgUriContainer", () => {
  const { createElement } = jest.requireActual("react") as typeof React
  return (props: object) => createElement("SvgUriContainer", props)
})

const ICON = {
  pictureEn: "en-1.svg",
  pictureAr: "ar-1.svg",
  icon: "icon-1.svg",
  labelEn: "Installments",
  labelAr: "الدفع بالتقسيط",
}
const PICTURE = { pictureEn: "en-2.svg", pictureAr: "ar-2.svg" }
const sub = (id: number, product: object) => ({
  id,
  product: { subType: "motivational", ...product },
})

describe("withoutFailedPicture", () => {
  it("drops the language's picture once the icon and that picture failed", () => {
    const failed = new Set(["icon-1.svg", "en-1.svg"])

    expect(withoutFailedPicture(ICON, false, failed)).toEqual({
      ...ICON,
      pictureEn: "",
    })
    // The Arabic picture hasn't failed.
    expect(withoutFailedPicture(ICON, true, failed)).toBe(ICON)
  })

  it("keeps the picture while only one of the two failed", () => {
    expect(withoutFailedPicture(ICON, false, new Set(["icon-1.svg"]))).toBe(
      ICON
    )
    expect(withoutFailedPicture(ICON, false, new Set(["en-1.svg"]))).toBe(ICON)
  })

  it("keeps the picture of a sticker with no icon", () => {
    expect(withoutFailedPicture(PICTURE, false, new Set(["en-2.svg"]))).toBe(
      PICTURE
    )
  })
})

describe("stickersOf", () => {
  const subs = [sub(9, PICTURE), sub(4, ICON)]

  it("draws an icon sticker whose icon and picture failed as its caption alone, oldest first", () => {
    const failed = new Set(["icon-1.svg", "en-1.svg", "en-2.svg"])

    expect(stickersOf(subs, false, failed)).toEqual([
      { kind: "stacked", icon: "", label: "Installments", key: "4" },
      { kind: "picture", picture: "en-2.svg", key: "9" },
    ])
  })

  it("falls back to the picture while it hasn't failed", () => {
    expect(stickersOf(subs, true, new Set(["icon-1.svg"]))).toEqual([
      { kind: "picture", picture: "ar-1.svg", key: "4" },
      { kind: "picture", picture: "ar-2.svg", key: "9" },
    ])
  })
})

describe("stickerCell", () => {
  it("reports a picture's failure by its uri", () => {
    const onArtError = jest.fn()
    const cell = stickerCell(
      { kind: "picture", picture: "en-2.svg", key: "9" },
      onArtError
    ) as React.ReactElement<{ uri: string; onError: () => void }>

    expect(cell.props.uri).toBe("en-2.svg")
    cell.props.onError()
    expect(onArtError).toHaveBeenCalledWith("en-2.svg")
  })

  it("reports an icon's failure through offerStickerCell", () => {
    const onArtError = jest.fn()
    const cell = stickerCell(
      { kind: "stacked", icon: "icon-1.svg", label: "Installments", key: "4" },
      onArtError
    ) as React.ReactElement<{
      icon: React.ReactElement<{ onError: () => void }>
    }>

    cell.props.icon.props.onError()
    expect(onArtError).toHaveBeenCalledWith("icon-1.svg")
  })
})
