/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, it } from "@jest/globals"
import path from "path"

import { renderScreen, rowsByPlatform } from "testing/screenKit"
import {
  PARITY_MATRIX,
  captureCommit,
  expectParity,
  parityName,
} from "testing/hostTreeParity"
import {
  buildProps,
  componentImport,
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestOptions,
} from "testing/harvest"

/*
 * SuccessModal as its three call sites draw it (ChangePassword, UpdateEmail,
 * UpdateMobileNumber: a title, a description, its OK button), shown and
 * hidden, plus the two optional lines left out (the component draws each only
 * when given). The kit, for the Modal, the check icon and i18next.
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/SuccessModal.cases.json (a `t("key")` is drawn as
 * `t:key`). The trees in __parity__ were captured from the component before
 * its conversion (each case names the commit).
 *
 *   DS_HARVEST=1 jest -c jest.parity.config.js <this file>   re-harvest
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

const load = () => require("../SuccessModal")

const FILES = harvestFilesFor(__dirname, "SuccessModal")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("SuccessModal"),
  props: {
    isVisible: "bool",
    onClose: "fn",
    title: "text",
    descr: "text",
  },
}

type Case = { name: string; props: Record<string, unknown> }

/** The optional lines, left out one by one. */
const HAND: Case[] = [
  {
    name: "title only",
    props: { isVisible: true, title: "Password changed" },
  },
  {
    name: "description only",
    props: { isVisible: true, descr: "Your password was changed." },
  },
  { name: "no text", props: { isVisible: true } },
]

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases (and an empty classes file)", () => {
      writeHarvest(FILES, "SuccessModal", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)
  const harvested: Case[] = Object.entries(cases.cases).map(([id, entry]) => ({
    name: `${id} (${entry.sites[0]})`,
    props: buildProps(entry.props),
  }))
  const rows = rowsByPlatform([...harvested, ...HAND], PARITY_MATRIX)

  describe("the class-name path draws as before", () => {
    it.each(rows)("$name [$env.language $env.platform]", async (row) => {
      const tree = await renderScreen(load, {
        lang: row.env.language,
        platform: row.env.platform,
        navigation: "none",
        props: { onClose: () => {}, ...row.props },
      })
      expectParity(parityName(row.name, row.env), tree)
    })
  })
}
