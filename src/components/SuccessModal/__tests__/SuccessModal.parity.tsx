/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"
import path from "path"

import {
  copy,
  openScreen,
  pressTitled,
  renderScreen,
  rowsByPlatform,
} from "testing/screenKit"
import {
  PARITY_MATRIX,
  captureCommit,
  expectParity,
  parityName,
  type ParityAllowance,
} from "testing/hostTreeParity"
import {
  buildProps,
  componentImport,
  expectClassFree,
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

/** Button's listed deltas, for the one ActionBtn the conversion turns into one. */
const BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

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
    it("writes the cases", () => {
      writeHarvest(FILES, "SuccessModal", OPTIONS, captureCommit())
    })
  })
} else {
  const cases = readHarvest(FILES)

  it("the cases hand it no class, no DmText and no ActionBtn", () => {
    expectClassFree(cases.cases)
  })

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
      // OK is an ActionBtn the conversion turned into a Button: its listed
      // deltas, on the rows that draw it (the hidden ones draw nothing).
      expectParity(
        parityName(row.name, row.env),
        tree,
        row.props.isVisible ? { allow: BUTTON } : undefined
      )
    })
  })

  // The converted button's handler runs (a handler lost in the conversion
  // draws the same tree: functions don't show in it).
  describe("OK closes the modal", () => {
    it.each(PARITY_MATRIX)("[$language $platform]", async (env) => {
      const onClose = jest.fn()
      const session = await openScreen(load, {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
        props: { isVisible: true, onClose, title: "Done" },
      })
      try {
        await session.act(() => {
          pressTitled(session.root, copy(env, "OK"))
        })
        expect(onClose).toHaveBeenCalledTimes(1)
      } finally {
        session.unmount()
      }
    })
  })
}
