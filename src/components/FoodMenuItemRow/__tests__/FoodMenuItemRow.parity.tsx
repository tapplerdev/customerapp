import { describe, it } from "@jest/globals"
import path from "path"

/*
 * FoodMenuItemRow (a dish on the food menu), pinned to what it drew before
 * its conversion, for the prop set its call site hands it, with the item and
 * the cart's quantity of it in each state the row is drawn in (a price, a
 * discount, price on selection, pre-order only, out of stock, a photo; not in
 * the cart and in it), at the two phone widths the image's size follows.
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/FoodMenuItemRow.cases.json; the site passes no
 * class names. The trees in __parity__ were captured from FoodMenuItemRow
 * before its conversion (each case names the commit). Both languages, both
 * platforms.
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest (writes the cases)
 *   yarn ds:parity:capture <this file> --force                recapture, on the old code only
 */

/* eslint-disable import/first */
import { renderScreen, rowsByPlatform } from "testing/screenKit"
import {
  PARITY_MATRIX,
  captureCommit,
  expectParity,
  parityName,
  type ParityAllowance,
} from "testing/hostTreeParity"
import {
  componentImport,
  expectClassFree,
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestOptions,
  type HarvestedCase,
} from "testing/harvest"
/* eslint-enable import/first */

/** What Button draws differently from the ActionBtn it replaced (listed deltas only, on its root): the pre-order badge (a Button with no onPress) */
const BUTTON: ParityAllowance[] = ["buttonHeight"]

const FILES = harvestFilesFor(__dirname, "FoodMenuItemRow")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("FoodMenuItemRow"),
  props: {
    item: "any",
    onPress: "fn",
    cartQty: "any",
    onQuickAdd: "fn",
    onQuickRemove: "fn",
    key: "any",
  },
}

/**
 * What the menu screen computes for a row: the menu item, and the quantity
 * of it across the cart's lines. The image's size follows the window, which
 * the row's styles read as they load (rows at 390 and 402).
 */
const ITEM = {
  id: 7001,
  name: "Chicken shawarma",
  description: "Grilled chicken, garlic sauce and pickles in a thin saj bread.",
  price: 85,
  discountPrice: 0,
  isExpressDeliveryAvailable: true,
  isPreOrderOnly: false,
  leadTimeHours: null,
  photo: "",
  inStock: true,
}
const ROW: Record<string, { item: Record<string, unknown>; qty: number }> = {
  "priced, not in the cart": { item: ITEM, qty: 0 },
  "priced, two in the cart": { item: ITEM, qty: 2 },
  discounted: { item: { ...ITEM, price: 100, discountPrice: 80 }, qty: 0 },
  "price on selection": { item: { ...ITEM, price: 0 }, qty: 0 },
  "pre-order only": { item: { ...ITEM, isPreOrderOnly: true }, qty: 0 },
  "out of stock": { item: { ...ITEM, inStock: false }, qty: 0 },
  "with a photo": {
    item: { ...ITEM, photo: "https://example.com/parity/shawarma.jpg" },
    qty: 1,
  },
}
const VARIANTS = Object.fromEntries(
  Object.keys(ROW).map((name) => [name, name])
)

const rowValue = (variant: string, key: string) => {
  if (key === "menuItem.id") return ITEM.id
  if (key === "menuItem") return ROW[variant].item
  if (key === "qtyByItemId[menuItem.id]") return ROW[variant].qty
  throw new Error(`no value for ${key}`)
}

/** A row's component, loaded in the row's own registry (the kit's rule). */
const loaderFor =
  (entry: HarvestedCase, variant = "") =>
  () => {
    /* eslint-disable global-require, @typescript-eslint/no-var-requires */
    const React = require("react") as typeof import("react")
    const { buildProps } =
      require("testing/harvest") as typeof import("testing/harvest")
    const Component = require("../FoodMenuItemRow").default
    /* eslint-enable global-require, @typescript-eslint/no-var-requires */
    const Harness = () =>
      React.createElement(
        Component,
        buildProps(entry.props, {
          opaque: (key: string) => rowValue(variant, key),
        })
      )
    return { default: Harness }
  }

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "FoodMenuItemRow", OPTIONS, captureCommit())
    })
  })
} else {
  const harvested = readHarvest(FILES)

  it("the cases hand it no class, no DmText and no ActionBtn", () => {
    expectClassFree(harvested.cases)
  })

  const cases: Record<string, HarvestedCase> = harvested.cases
  const rows = rowsByPlatform(
    Object.entries(cases).flatMap(([id, entry]) =>
      Object.keys(VARIANTS).flatMap((variant) =>
        [390, 402].map((width) => ({
          id: `${id} ${variant} at ${width}`,
          site: entry.sites[0],
          entry,
          variant,
          width,
        }))
      )
    ),
    PARITY_MATRIX
  )
  describe("FoodMenuItemRow draws as before", () => {
    it.each(rows)("$id ($site) [$env.language $env.platform]", async (row) => {
      const { id, entry, env } = row
      const tree = await renderScreen(loaderFor(entry, row.variant), {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
        window: { width: row.width },
      })
      expectParity(parityName(id, env), tree, {
        allow: row.variant === "pre-order only" ? BUTTON : undefined,
      })
    })
  })
}
