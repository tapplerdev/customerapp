import { describe, it } from "@jest/globals"
import path from "path"

/*
 * ImageViewerModal (the full-screen photo viewer a chat photo opens), pinned
 * to what it drew before its conversion, for the prop set its call site
 * hands it, with one photo and with three (the dots), opened on the first
 * and the second, at the two phone widths the page size follows (the modal
 * reads the window as it loads).
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/ImageViewerModal.cases.json; the site passes no
 * class names. The photos are made-up urls (the image is the kit's stand-in).
 * The trees in __parity__ were captured from ImageViewerModal before its
 * conversion (each case names the commit). Both languages, both platforms.
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
} from "testing/hostTreeParity"
import {
  componentImport,
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestedCase,
  type HarvestOptions,
} from "testing/harvest"
/* eslint-enable import/first */

const FILES = harvestFilesFor(__dirname, "ImageViewerModal")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("ImageViewerModal"),
  props: {
    isVisible: "bool",
    onClose: "fn",
    images: "any",
    initialIndex: "any",
  },
}

/** What a message bubble computes: the chat's photos (full size) and the one tapped. */
const PHOTOS = [1, 2, 3].map((n) => ({
  uri: `https://example.com/parity/chat-${n}.jpg`,
}))
const VIEWER: Record<string, { images: { uri: string }[]; index: number }> = {
  "one photo": { images: PHOTOS.slice(0, 1), index: 0 },
  "three photos, the first": { images: PHOTOS, index: 0 },
  "three photos, the second": { images: PHOTOS, index: 1 },
}
const VARIANTS = Object.fromEntries(
  Object.keys(VIEWER).map((name) => [name, name])
)

const viewerValue = (variant: string, key: string) => {
  if (key === "mediaItems") return VIEWER[variant].images
  if (key === "viewerIndex") return VIEWER[variant].index
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
    const Component = require("../ImageViewerModal").default
    /* eslint-enable global-require, @typescript-eslint/no-var-requires */
    const Harness = () =>
      React.createElement(
        Component,
        buildProps(entry.props, {
          opaque: (key: string) => viewerValue(variant, key),
        })
      )
    return { default: Harness }
  }

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "ImageViewerModal", OPTIONS, captureCommit())
    })
  })
} else {
  const harvested = readHarvest(FILES)
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
  describe("ImageViewerModal draws as before", () => {
    it.each(rows)("$id ($site) [$env.language $env.platform]", async (row) => {
      const { id, entry, env } = row
      const tree = await renderScreen(loaderFor(entry, row.variant), {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
        window: { width: row.width },
      })
      expectParity(parityName(id, env), tree)
    })
  })
}
