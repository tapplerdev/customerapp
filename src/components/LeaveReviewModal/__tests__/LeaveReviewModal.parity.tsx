import { describe, it } from "@jest/globals"
import path from "path"

/*
 * LeaveReviewModal ("how was your service for ...?" sheet on the Talabati
 * screen), pinned to what it drew before its conversion, for every prop set
 * its call site hands it.
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/LeaveReviewModal.cases.json; the site passes no
 * class names. The category name the site computes is a made-up one. The
 * sheet is the kit's stand-in for the native sheet. The trees in __parity__
 * were captured from LeaveReviewModal before its conversion (each case names
 * the commit). Both languages, both platforms.
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

/** What Button draws differently from the ActionBtn it replaced (listed deltas only, on its root): the sheet's button */
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const FILES = harvestFilesFor(__dirname, "LeaveReviewModal")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("LeaveReviewModal"),
  props: {
    isVisible: "bool",
    onClose: "fn",
    onLeaveReview: "fn",
    categoryName: "any",
  },
}

/** A row's component, loaded in the row's own registry (the kit's rule). */
const loaderFor =
  (entry: HarvestedCase, variant = "") =>
  () => {
    /* eslint-disable global-require, @typescript-eslint/no-var-requires */
    const React = require("react") as typeof import("react")
    const { buildProps } =
      require("testing/harvest") as typeof import("testing/harvest")
    const Component = require("../LeaveReviewModal").default
    /* eslint-enable global-require, @typescript-eslint/no-var-requires */
    const Harness = () =>
      React.createElement(
        Component,
        buildProps(entry.props, {
          opaque: (key: string) =>
            key.includes("nameAr") ? "سباكة" : "Plumbing",
        })
      )
    return { default: Harness }
  }

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "LeaveReviewModal", OPTIONS, captureCommit())
    })
  })
} else {
  const harvested = readHarvest(FILES)

  it("the cases hand it no class, no DmText and no ActionBtn", () => {
    expectClassFree(harvested.cases)
  })

  const cases: Record<string, HarvestedCase> = harvested.cases
  const rows = rowsByPlatform(
    Object.entries(cases).map(([id, entry]) => ({
      id,
      site: entry.sites[0],
      entry,
    })),
    PARITY_MATRIX
  )
  describe("LeaveReviewModal draws as before", () => {
    it.each(rows)("$id ($site) [$env.language $env.platform]", async (row) => {
      const { id, entry, env } = row
      const tree = await renderScreen(loaderFor(entry), {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
      })
      expectParity(parityName(id, env), tree, {
        allow: entry.props.isVisible === true ? BUTTON : undefined,
      })
    })
  })
}
