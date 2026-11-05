import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import React from "react"
import TestRenderer, { act } from "react-test-renderer"

/*
 * SvgUriContainer's onError: called once a load settles with nothing to draw,
 * never for art that loads or is already cached. FeaturedSticker passes it
 * through so ProProfileScreen can drop a sticker whose art failed instead of
 * keeping its empty window.
 */

jest.mock("react-native-svg", () => ({
  SvgXml: () => null,
}))

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
