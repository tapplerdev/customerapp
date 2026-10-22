/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, it } from "@jest/globals"

import { renderScreen, rowsByPlatform } from "testing/screenKit"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"
import { buildProps } from "testing/harvest"

import { OPAQUE, WRAPPERS, type WrapperName } from "../__fixtures__/scrollSets"

/*
 * The three scroll wrappers' class-name path, pinned to what they drew before
 * their style twins, for every distinct prop set their call sites hand them
 * (__fixtures__/scrollSets.tsx: read off the sites; each wrapper threads its
 * `className` onto the inner scroll view, where NativeWind resolves it). A
 * wrapper is drawn with two rows of content, a list with two items, so the
 * content container shows.
 *
 * scroll.twins.parity.tsx draws the same sets through the twins the codemod
 * writes, against these same trees.
 *
 *   yarn ds:parity:capture <this file> --force   recapture, on the old code only
 */

/**
 * The wrapper, in the registry the row loads. The sets file is required here
 * too, so its class strings are compiled in the row's registry.
 */
const loaderFor = (name: WrapperName) => () => {
  require("../__fixtures__/scrollSets")
  const React = require("react") as typeof import("react")
  const Wrapper = require("../index")[name] as React.ComponentType<
    Record<string, unknown>
  >
  const Harness = (props: Record<string, unknown>) =>
    React.createElement(Wrapper, props)
  return { default: Harness }
}

const NAMES = Object.keys(WRAPPERS) as WrapperName[]

describe.each(NAMES)("%s, the class-name path draws as before", (name) => {
  const rows = rowsByPlatform(
    WRAPPERS[name].map((set) => ({ set })),
    PARITY_MATRIX
  )
  it.each(rows)("$set.id [$env.language $env.platform]", async (row) => {
    const tree = await renderScreen(loaderFor(name), {
      lang: row.env.language,
      platform: row.env.platform,
      navigation: "none",
      props: buildProps(row.set.props as never, { opaque: OPAQUE }),
    })
    expectParity(parityName(`${name}: ${row.set.id}`, row.env), tree)
  })
})
