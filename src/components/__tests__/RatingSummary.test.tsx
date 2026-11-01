import { afterAll, beforeEach, describe, expect, it, jest } from "@jest/globals"
import React, { act } from "react"
import TestRenderer from "react-test-renderer"

/*
 * tappler-shared's RatingSummary with this app's copy (#522): the score to one
 * decimal (none for a whole one, rounded first), "(1 Review)" for exactly one
 * review and "(N Reviews)" otherwise, in both languages, and "No reviews yet"
 * with none. The star icons are stand-ins; the texts are the design system's
 * real Text, read as drawn.
 */

/* eslint-disable global-require, @typescript-eslint/no-var-requires -- a
   jest.mock factory must require lazily: it is hoisted above every import. */
jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)
jest.mock("@tappler/shared/src/assets/icons/star-line-duotone.svg", () =>
  require("testing/svgStub").svgStub("star-line-duotone")
)
jest.mock("@tappler/shared/src/components/RatingStarIcon", () => {
  const { createElement } = jest.requireActual("react") as typeof React
  return (props: object) => createElement("RatingStarIcon", props)
})

import i18n from "locales/i18n"
import RatingSummary, {
  formatRate,
} from "@tappler/shared/src/components/RatingSummary"

type Node = TestRenderer.ReactTestRendererJSON

const textOf = (node: Node | string): string =>
  typeof node === "string" ? node : (node.children ?? []).map(textOf).join("")

// What the row says, as one line.
const said = (element: React.ReactElement) => {
  let renderer!: TestRenderer.ReactTestRenderer
  act(() => {
    renderer = TestRenderer.create(element)
  })
  return textOf(renderer.toJSON() as Node)
}

describe("formatRate", () => {
  it.each([
    [4, "4"],
    [3.857, "3.9"],
    [3.96, "4"],
    [4.96, "5"],
    [4.35, "4.4"],
    [3.85, "3.9"],
    [4.05, "4.1"],
    [4.6, "4.6"],
    [0, "0"],
  ])("%p reads %p", (rate, text) => {
    expect(formatRate(rate)).toBe(text)
  })
})

describe("RatingSummary", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage("en"))
  })

  afterAll(async () => {
    await act(() => i18n.changeLanguage("en"))
  })

  it("says one review in the singular", () => {
    expect(said(<RatingSummary rate={5} reviewsCount={1} />)).toBe(
      "5 of 5 (1 Review)"
    )
  })

  it("says more than one in the plural", () => {
    expect(said(<RatingSummary rate={3.96} reviewsCount={2} />)).toBe(
      "4 of 5 (2 Reviews)"
    )
  })

  it("says one review in the Arabic singular", async () => {
    await act(() => i18n.changeLanguage("ar"))
    expect(said(<RatingSummary rate={4.35} reviewsCount={1} />)).toBe(
      "4.4 من 5 (1 تقييم)"
    )
    expect(said(<RatingSummary rate={4.35} reviewsCount={12} />)).toBe(
      "4.4 من 5 (12 تقييمات)"
    )
  })

  it("says No reviews yet with none", () => {
    expect(said(<RatingSummary rate={0} reviewsCount={0} />)).toBe(
      "No reviews yet"
    )
  })
})
