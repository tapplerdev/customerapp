/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, it } from "@jest/globals"

import { openScreen, rowsByPlatform } from "testing/screenKit"
import { PARITY_MATRIX, expectParity, parityName } from "testing/hostTreeParity"

/*
 * ScaleableDistinctLabelComponent: nothing imports it (W3's strip can delete
 * it; it is converted here anyway, so the tree has no class left), so there
 * are no call sites to harvest and the cases are by hand: before its first
 * layout (no size yet), laid out at the full 91pt and at a narrower 60pt, with
 * the default word and with a title (a bigger base text size). The layout is
 * sent as the device sends it (the outer view's onLayout). The kit, for
 * i18next.
 *
 *   yarn ds:parity:capture <this file> --force   recapture, on the old code only
 */

const load = () => require("../ScaleableDistinctLabelComponent")

const CASES: {
  name: string
  props: Record<string, unknown>
  width?: number
}[] = [
  { name: "before layout", props: {} },
  { name: "91 wide", props: {}, width: 91 },
  { name: "60 wide", props: {}, width: 60 },
  { name: "91 wide with a title", props: { title: "Sponsored" }, width: 91 },
  { name: "60 wide with a title", props: { title: "Sponsored" }, width: 60 },
  { name: "wider than the box", props: {}, width: 140 },
]
const rows = rowsByPlatform(CASES, PARITY_MATRIX)

describe("ScaleableDistinctLabelComponent draws as before", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (row) => {
    const session = await openScreen(load, {
      lang: row.env.language,
      platform: row.env.platform,
      navigation: "none",
      props: row.props,
    })
    try {
      if (row.width !== undefined) {
        await session.act(() => {
          const outer = session.root.findAll(
            (node) => typeof node.props.onLayout === "function"
          )[0]
          outer.props.onLayout({
            nativeEvent: { layout: { width: row.width, height: 20 } },
          })
        })
      }
      expectParity(parityName(row.name, row.env), session.tree())
    } finally {
      session.unmount()
    }
  })
})
