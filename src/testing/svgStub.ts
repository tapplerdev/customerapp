/**
 * Jest only. An SVG icon module's stand-in that stays visible in a host tree:
 * it renders a host element named after the icon, carrying the props the
 * icon was given (width, height, color), where a `() => null` mock would
 * leave nothing to compare.
 *
 *   jest.mock("assets/icons/close.svg", () =>
 *     require("testing/svgStub").svgStub("close")
 *   )
 */
import React from "react"

export const svgStub = (name: string) => {
  const Icon = (props: Record<string, unknown>) =>
    React.createElement(`svg:${name}`, props)
  Icon.displayName = `Svg(${name})`
  return Icon
}
