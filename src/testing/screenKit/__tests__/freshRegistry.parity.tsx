/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry, so the
   probe is required in the loader. */
import { describe, expect, it } from "@jest/globals"

import { renderScreen } from "testing/screenKit"

/*
 * What `yarn test:parity:fresh` is for: a leak with a source on both sides
 * of a row (review-ca-w0, the K re-check). The probe keeps a string at
 * module scope that no reset renews. In this file's order one row leaves
 * "left behind" in it, the next only reads it, and a third leaves it again:
 * so the reader follows a row that left it in file order, and reversed
 * (`yarn test:parity:reverse`) too. It reads "left behind" both ways, which
 * is how a fixture captured with such a leak in matched in both passes.
 * Under the fresh pass (freshEnvironment.js) every row has a registry of its
 * own, so the reader draws what it draws run alone, and the leak shows. A
 * row's own renders keep sharing its registry.
 */

const freshRows =
  typeof (globalThis as { __screenKitFreshRow?: unknown })
    .__screenKitFreshRow === "number"

const probe = () => require("../__fixtures__/KeptStateProbe")

const drawn = async (keep?: string) => {
  const tree = await renderScreen(probe, {
    navigation: "none",
    props: keep === undefined ? {} : { keep },
  })
  return tree?.children.join("")
}

describe("module state nobody resets, left by the rows on both sides", () => {
  it("a row leaves it behind", async () => {
    expect(await drawn("left behind")).toBe("left behind")
  })

  it("the next row reads what an earlier row left, in either order, unless each row has a registry of its own", async () => {
    expect(await drawn()).toBe(freshRows ? "nothing kept" : "left behind")
  })

  it("another row leaves it behind", async () => {
    expect(await drawn("left behind")).toBe("left behind")
  })

  it("a row's renders share its registry", async () => {
    expect(await drawn("this row's")).toBe("this row's")
    expect(await drawn()).toBe("this row's")
  })
})
