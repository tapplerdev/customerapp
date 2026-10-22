import { describe, it } from "@jest/globals"
import path from "path"

/*
 * CancelJobFeedbackModal ("why are you cancelling"), pinned to what it drew
 * before its conversion, for every prop set its call sites hand it, with the
 * cancel hook's value in each state the card is drawn in (nothing picked, a
 * reason, "other" with the field empty and typed, submitting).
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/CancelJobFeedbackModal.cases.json; the sites pass no
 * class names. The card is shared's MainModal, whose button classes draw
 * here. The trees in __parity__ were captured from CancelJobFeedbackModal
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

/** What Button draws differently from the ActionBtn it replaced (listed deltas only, on its root). */
const SUBMIT_BUTTON: ParityAllowance[] = ["buttonHeight", "buttonAccessibility"]

const FILES = harvestFilesFor(__dirname, "CancelJobFeedbackModal")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("CancelJobFeedbackModal"),
  props: {
    isVisible: "bool",
    onClose: "fn",
    onModalHide: "fn",
    cancel: "any",
  },
}

/** The cancel hook's value (useCancelJob) in the states the card is drawn in. */
const REASONS = [
  "I did not receive enough offers",
  "Offers are expensive or not suitable",
  "I hired a local pro",
  "Other Reasons",
] as const

const noop = () => undefined
const STATES: Record<
  string,
  {
    selectedReasons: string[]
    other: string
    submitting: boolean
    canSubmit: boolean
  }
> = {
  "nothing picked": {
    selectedReasons: [],
    other: "",
    submitting: false,
    canSubmit: false,
  },
  "one picked": {
    selectedReasons: [REASONS[1]],
    other: "",
    submitting: false,
    canSubmit: true,
  },
  "other picked, empty": {
    selectedReasons: [REASONS[3]],
    other: "",
    submitting: false,
    canSubmit: false,
  },
  "other picked, typed": {
    selectedReasons: [REASONS[0], REASONS[3]],
    other: "Found someone through a friend",
    submitting: false,
    canSubmit: true,
  },
  submitting: {
    selectedReasons: [REASONS[2]],
    other: "",
    submitting: true,
    canSubmit: true,
  },
}
const VARIANTS = Object.fromEntries(
  Object.keys(STATES).map((name) => [name, name])
)

const cancelFor = (variant: string, key: string) => {
  if (key !== "cancel") throw new Error(`no value for ${key}`)
  const state = STATES[variant]
  return {
    cancelReasons: REASONS,
    selectedReasons: state.selectedReasons,
    toggleReason: noop,
    otherReasonText: state.other,
    setOtherReasonText: noop,
    handleSubmitCancel: noop,
    isSubmitting: state.submitting,
    hasOtherSelected: state.selectedReasons.includes("Other Reasons"),
    canSubmit: state.canSubmit,
  }
}

/** A row's component, loaded in the row's own registry (the kit's rule). */
const loaderFor =
  (entry: HarvestedCase, variant = "") =>
  () => {
    /* eslint-disable global-require, @typescript-eslint/no-var-requires */
    const React = require("react") as typeof import("react")
    const { buildProps } =
      require("testing/harvest") as typeof import("testing/harvest")
    const Component = require("../CancelJobFeedbackModal").default
    /* eslint-enable global-require, @typescript-eslint/no-var-requires */
    const Harness = () =>
      React.createElement(
        Component,
        buildProps(entry.props, {
          opaque: (key: string) => cancelFor(variant, key),
        })
      )
    return { default: Harness }
  }

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "CancelJobFeedbackModal", OPTIONS, captureCommit())
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
      Object.keys(VARIANTS).map((variant) => ({
        id: `${id} ${variant}`,
        site: entry.sites[0],
        entry,
        variant,
      }))
    ),
    PARITY_MATRIX
  )
  describe("CancelJobFeedbackModal draws as before", () => {
    it.each(rows)("$id ($site) [$env.language $env.platform]", async (row) => {
      const { id, entry, env } = row
      const tree = await renderScreen(loaderFor(entry, row.variant), {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
      })
      expectParity(parityName(id, env), tree, {
        // Submit, once the card is open: the ActionBtn became a Button.
        allow: entry.props.isVisible === true ? SUBMIT_BUTTON : undefined,
      })
    })
  })
}
