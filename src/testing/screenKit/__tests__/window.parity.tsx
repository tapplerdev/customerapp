/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry, so the
   probe is passed as a loader. */
import { describe, expect, it } from "@jest/globals"

import {
  LOADED_AS_BEFORE,
  loadedPlatform,
  loadedWindow,
  renderScreen,
  type KitPlatform,
} from "testing/screenKit"
import type { HostNode } from "testing/hostTreeParity"

/*
 * A row's window is part of its module registry and applied before the app
 * loads, so what a module works out from Dimensions when it loads follows
 * the row: tappler-shared's isSmallPhone (width under 393), which
 * RegistrationFlowScreen, SocialMediaItem, FilterScreen and five components
 * branch on, and SCREEN_WIDTH / SCREEN_HEIGHT. Set at render time only, the
 * branch stayed the large phone's whatever the row asked for.
 */

const probe = () => require("../__fixtures__/SmallPhoneProbe")

const text = (tree: HostNode | null, testID: string): string => {
  const find = (node: HostNode | string): HostNode | undefined => {
    if (typeof node === "string") return undefined
    if (node.props.testID === testID) return node
    for (const child of node.children) {
      const found = find(child)
      if (found) return found
    }
    return undefined
  }
  const node = tree ? find(tree) : undefined
  return (node?.children ?? []).join("")
}

const style = (tree: HostNode | null, testID: string) => {
  const find = (node: HostNode | string): HostNode | undefined => {
    if (typeof node === "string") return undefined
    if (node.props.testID === testID) return node
    return node.children.map(find).find(Boolean)
  }
  return (tree ? find(tree)?.props.style : undefined) as
    | Record<string, unknown>
    | undefined
}

// Platform by platform, and back to 390 after 402: each switch is a fresh
// registry booted with the row's window.
const ROWS = (["ios", "android"] as KitPlatform[]).flatMap((platform) =>
  [390, 402, 390].map((width) => ({ platform, width }))
)

describe("a row's window reaches what the app works out when it loads", () => {
  it.each(ROWS)(
    "isSmallPhone at width $width [$platform]",
    async ({ platform, width }) => {
      const tree = await renderScreen(probe, {
        platform,
        navigation: "none",
        window: { width },
      })
      const small = width < 393
      expect(text(tree, "branch")).toBe(small ? "small phone" : "large phone")
      expect(style(tree, "branch")).toMatchObject({
        fontSize: small ? 11 : 13,
      })
      expect(text(tree, "loaded")).toBe(`${width}x874 tall`)
      expect(text(tree, "now")).toBe(String(width))
      expect(loadedPlatform()).toBe(platform)
      expect(loadedWindow()).toBe(`${width}x874@3x/1`)
    }
  )

  it("loads as it always has when a row gives no window, and renders at the default", async () => {
    // jest's own Dimensions while the app loads (the fixtures captured so
    // far hold what that draws), the iPhone 16 Pro's at render
    const tree = await renderScreen(probe, { navigation: "none" })
    expect(text(tree, "branch")).toBe("large phone")
    expect(text(tree, "loaded")).toBe("750x1334 tall")
    expect(text(tree, "now")).toBe("402")
    expect(loadedWindow()).toBe(LOADED_AS_BEFORE)
    // a window given, even the default one, is applied before the app loads
    const given = await renderScreen(probe, {
      navigation: "none",
      window: { width: 402 },
    })
    expect(text(given, "loaded")).toBe("402x874 tall")
  })

  it("follows the height too: isSmallPhoneHeight at 864 and below", async () => {
    const tree = await renderScreen(probe, {
      navigation: "none",
      window: { width: 375, height: 812 },
    })
    expect(text(tree, "branch")).toBe("small phone")
    expect(text(tree, "loaded")).toBe("375x812 short")
  })
})
