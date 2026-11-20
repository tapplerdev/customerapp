import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import React from "react"
import TestRenderer, { act } from "react-test-renderer"

/*
 * SvgUriContainer's onError: called once a load settles with nothing to draw,
 * never for art that loads or is already cached. FeaturedSticker passes it
 * through so ProProfileScreen can drop a sticker whose art failed instead of
 * keeping its empty window.
 */

jest.mock("react-native-svg", () => {
  const { createElement } = jest.requireActual("react") as typeof React
  return {
    SvgXml: (props: object) => createElement("SvgXml", props),
  }
})

const mockLoad = jest.fn<(uri: string) => Promise<string | null>>()
const mockPeek = jest.fn<(uri?: string | null) => string | null>()
jest.mock("services/svgCache", () => ({
  loadSvg: (uri: string) => mockLoad(uri),
  peekSvg: (uri?: string | null) => mockPeek(uri),
}))

const SvgUriContainer = require("../SvgUriContainer").default

const SVG = "<svg></svg>"

const draw = async (uri: string, onError: () => void) => {
  let renderer: TestRenderer.ReactTestRenderer | undefined
  await act(async () => {
    renderer = TestRenderer.create(
      <SvgUriContainer uri={uri} onError={onError} />
    )
  })
  await act(async () => {
    await Promise.resolve()
  })
  return renderer!
}

beforeEach(() => {
  mockLoad.mockReset()
  mockPeek.mockReset()
  mockPeek.mockReturnValue(null)
})

describe("SvgUriContainer onError", () => {
  it("fires when the art can't be loaded", async () => {
    mockLoad.mockResolvedValue(null)
    const onError = jest.fn()

    const renderer = await draw("https://cdn/bad.svg", onError)

    expect(onError).toHaveBeenCalledTimes(1)
    expect(renderer.toJSON()).toBeNull()
  })

  it("stays quiet when the art loads", async () => {
    mockLoad.mockResolvedValue(SVG)
    const onError = jest.fn()

    await draw("https://cdn/good.svg", onError)

    expect(onError).not.toHaveBeenCalled()
  })

  it("stays quiet for cached art, which never loads", async () => {
    mockPeek.mockReturnValue(SVG)
    const onError = jest.fn()

    await draw("https://cdn/cached.svg", onError)

    expect(mockLoad).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it("stays quiet when it unmounts before the load fails", async () => {
    let fail: (v: null) => void = () => undefined
    mockLoad.mockReturnValue(new Promise((r) => (fail = r)))
    const onError = jest.fn()

    const renderer = await draw("https://cdn/slow.svg", onError)
    act(() => renderer.unmount())
    await act(async () => {
      fail(null)
    })

    expect(onError).not.toHaveBeenCalled()
  })
})

/*
 * Where the art sits in its box (the trust sticker on the pro cards). The CMS
 * art is not the slot's shape and react-native-svg centres it, so it starts
 * ~20pt in. preserveAspectRatio pins it to an edge and changes nothing else.
 */
describe("SvgUriContainer places the art in its box", () => {
  const ART =
    '<svg viewBox="0 0 137.715 23.465"><g transform="translate(20898.5 -20327.309)">' +
    '<g transform="translate(-20890 20330.996)"><path d="M1 1L10 10"/></g></g></svg>'

  const drawArt = async (preserveAspectRatio?: string) => {
    mockLoad.mockResolvedValue(ART)
    let renderer: TestRenderer.ReactTestRenderer | undefined
    await act(async () => {
      renderer = TestRenderer.create(
        <SvgUriContainer
          uri="https://cdn/trust.svg"
          preserveAspectRatio={preserveAspectRatio}
        />
      )
    })
    await act(async () => {
      await Promise.resolve()
    })
    return (renderer!.toJSON() as TestRenderer.ReactTestRendererJSON).props
  }

  it("pins the art where asked, drawing it as fetched", async () => {
    const svg = await drawArt("xMinYMid meet")

    expect(svg.preserveAspectRatio).toBe("xMinYMid meet")
    expect(svg.xml).toBe(ART)
  })

  it("leaves react-native-svg's default, centred, when not asked", async () => {
    const svg = await drawArt()

    expect(svg).not.toHaveProperty("preserveAspectRatio")
    expect(svg.xml).toBe(ART)
  })
})
