import { describe, it } from "@jest/globals"
import path from "path"

/*
 * MessageComponent (a chat bubble), pinned to what it drew before its
 * conversion: the prop sets its call site hands it (the eight combinations
 * of the grouping and read receipt flags), and by hand every kind of message
 * the chat holds (own and pro, text, links, photos of every count, a local
 * photo, documents, a location, an orphaned attachment, every system line and
 * an offer revision), a mid-group and a first message, the read receipt, the
 * stamp left off, and an upload in flight; at the two phone widths the
 * bubble's width follows (the component reads the window as it loads).
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/MessageComponent.cases.json; the site passes no
 * class names. The photos and the map are the kit's stand-ins. The trees in
 * __parity__ were captured from MessageComponent before its conversion (each
 * case names the commit). Both languages, both platforms.
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
  expectClassFree,
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestOptions,
  type HarvestedCase,
} from "testing/harvest"
/* eslint-enable import/first */

/**
 * The messages the chat screen hands the row (its list's `item.message`), by
 * the name a case gives them. Times are the kit's clock (a text's stamp reads
 * the same in every run); the photos' and the pdf's urls are made up.
 */
const AT = "2026-10-20T08:47:00.000Z"
const base = (ownerType: "customer" | "pro" | "system", id: number) => ({
  id,
  chatId: 6001,
  ownerType,
  createdAt: AT,
  readAt: null,
})
const photo = (n: number) => ({
  id: n,
  fileName: `photo-${n}.jpg`,
  extension: "jpg",
  originalName: `photo-${n}.jpg`,
  mimeType: "image/jpeg",
  storageKey: `parity/photo-${n}.jpg`,
  url: `https://example.com/parity/photo-${n}.jpg`,
  url720: `https://example.com/parity/photo-${n}-720.jpg`,
  url1920: `https://example.com/parity/photo-${n}-1920.jpg`,
})
const pdf = (name: string) => ({
  id: 90,
  fileName: "quote.pdf",
  extension: "pdf",
  originalName: name,
  mimeType: "application/pdf",
  storageKey: "parity/quote.pdf",
  url: "https://example.com/parity/quote.pdf",
})
const pin = { id: 1, latitude: 30.0444, longitude: 31.2357 }
const LONG =
  "I can come on Thursday at 10 with the parts and a second pair of hands, so it should take under an hour, but I will confirm the day before in case the supplier is late."

const MESSAGES: Record<string, unknown> = {
  "pro text": {
    ...base("pro", 1),
    text: "Hello! I can come on Thursday at 10.",
  },
  "own text": { ...base("customer", 2), text: "Thursday at 10 works for me." },
  "own links": {
    ...base("customer", 3),
    text: "Call 01000000001 or write to me@example.com, the photo is at https://example.com/sink",
  },
  "pro links": {
    ...base("pro", 4),
    text: "My quote is at https://example.com/quote or call 01000000002",
  },
  "pro long text": { ...base("pro", 5), text: LONG },
  "own long text": { ...base("customer", 6), text: LONG },
  "pro one photo": { ...base("pro", 7), files: [photo(1)] },
  "own two photos": { ...base("customer", 8), files: [photo(1), photo(2)] },
  "pro three photos": {
    ...base("pro", 9),
    files: [photo(1), photo(2), photo(3)],
  },
  "own five photos": {
    ...base("customer", 10),
    files: [1, 2, 3, 4, 5].map(photo),
  },
  "pro photo with text": {
    ...base("pro", 11),
    files: [photo(1)],
    text: "This is the part I will bring.",
  },
  "own a local photo": {
    ...base("customer", 12),
    files: [
      {
        ...photo(1),
        url720: "file:///parity/photo-1.jpg",
        url: "file:///parity/photo-1.jpg",
      },
    ],
  },
  "own document": {
    ...base("customer", 13),
    files: [pdf("Bathroom plan.pdf")],
  },
  "pro document, a long name": {
    ...base("pro", 14),
    files: [
      pdf(
        "The quote for the full kitchen refit, with the parts and the labour.pdf"
      ),
    ],
  },
  "pro document and photo": {
    ...base("pro", 15),
    files: [photo(1), pdf("Quote.pdf")],
    text: "Quote and the photo.",
  },
  "own location": { ...base("customer", 16), location: pin },
  "pro location with text": {
    ...base("pro", 17),
    location: pin,
    text: "I am here.",
  },
  "own orphaned attachment": { ...base("customer", 18) },
  "pro orphaned attachment": { ...base("pro", 19) },
  "system, a pro action": {
    ...base("system", 20),
    text: "opportunity_declined",
  },
  "system, own action": { ...base("system", 21), text: "opportunity_accepted" },
  "system, job expired": { ...base("system", 22), text: "job_expired" },
  "system, cancelled by customer": {
    ...base("system", 23),
    text: "job_cancelled_by_customer",
  },
  "system, food cancelled by the place": {
    ...base("system", 24),
    text: "food_order_cancelled_by_pro",
  },
  "system, food declined": {
    ...base("system", 25),
    text: "food_order_declined_by_pro",
  },
  "system, food preparing": {
    ...base("system", 26),
    text: "food_order_preparing",
  },
  "system, food with courier": {
    ...base("system", 27),
    text: "food_order_with_courier",
  },
  "system, food ready for pickup": {
    ...base("system", 28),
    text: "food_order_ready_for_pickup",
  },
  "system, food delivered": {
    ...base("system", 29),
    text: "food_order_delivered",
  },
  "system, an offer revised": {
    ...base("system", 30),
    text: "offer_updated:250:220",
  },
}

const messageValue = (key: string) => {
  if (key === "item.message") return MESSAGES["pro text"]
  if (key === "context.proName") return "Omar Hassan"
  if (key === "attachments.isMessageUploading(item.message.id)") return false
  if (key in MESSAGES) return MESSAGES[key]
  throw new Error(`no value for ${key}`)
}

const FILES = harvestFilesFor(__dirname, "MessageComponent")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("MessageComponent"),
  props: {
    item: "any",
    isFirstInGroup: "bool",
    isLastInGroup: "bool",
    showTimestamp: "bool",
    showReadReceipt: "bool",
    readByName: "any",
    isUploading: "any",
  },
}

type Flags = {
  isFirstInGroup?: boolean
  isLastInGroup?: boolean
  showTimestamp?: boolean
  showReadReceipt?: boolean
  isUploading?: boolean
}

/** A hand case: one named message, and how the screen's grouping and receipts set the row. */
const by = (name: string, flags: Flags = {}): HarvestedCase => ({
  props: {
    item: { $opaque: name },
    isFirstInGroup: false,
    isLastInGroup: true,
    readByName: { $opaque: "context.proName" },
    ...flags,
  },
  sites: ["by hand"],
})

/**
 * By hand: the screen's one site passes the same message to all eight
 * combinations of its flags (the harvested rows), so every other kind of
 * message (own and pro, text, links, photos, documents, a location, an
 * orphaned attachment, every system line) is one named case here, as the
 * screen draws it last in its group, then the middle of a group and a
 * first message, the stamp left off, a read receipt, and an upload.
 */
const HAND: Record<string, HarvestedCase> = {
  ...Object.fromEntries(
    Object.keys(MESSAGES)
      .filter((name) => name !== "pro text")
      .map((name) => [`hand ${name}`, by(name)])
  ),
  "hand own text, mid group": by("own text", { isLastInGroup: false }),
  "hand own text, first in group": by("own text", {
    isFirstInGroup: true,
    isLastInGroup: false,
  }),
  "hand pro text, mid group": by("pro text", { isLastInGroup: false }),
  "hand own text, read receipt": by("own text", { showReadReceipt: true }),
  "hand own photo, read receipt": by("own two photos", {
    showReadReceipt: true,
  }),
  "hand own text, no stamp": by("own text", { showTimestamp: false }),
  "hand system, mid group": by("system, job expired", { isLastInGroup: false }),
  "hand own photos, uploading": by("own two photos", { isUploading: true }),
  "hand own document, uploading": by("own document", { isUploading: true }),
  "hand own location, uploading": by("own location", { isUploading: true }),
  "hand own text, uploading": by("own text", { isUploading: true }),
  "hand pro photo, uploading": by("pro one photo", { isUploading: true }),
}

/** A row's component, loaded in the row's own registry (the kit's rule). */
const loaderFor =
  (entry: HarvestedCase, variant = "") =>
  () => {
    /* eslint-disable global-require, @typescript-eslint/no-var-requires */
    const React = require("react") as typeof import("react")
    const { buildProps } =
      require("testing/harvest") as typeof import("testing/harvest")
    const Component = require("../MessageComponent").default
    /* eslint-enable global-require, @typescript-eslint/no-var-requires */
    const Harness = () =>
      React.createElement(
        Component,
        buildProps(entry.props, { opaque: (key: string) => messageValue(key) })
      )
    return { default: Harness }
  }

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "MessageComponent", OPTIONS, captureCommit())
    })
  })
} else {
  const harvested = readHarvest(FILES)

  it("the cases hand it no class, no DmText and no ActionBtn", () => {
    expectClassFree(harvested.cases)
  })

  const cases: Record<string, HarvestedCase> = { ...harvested.cases, ...HAND }
  const rows = rowsByPlatform(
    Object.entries(cases).flatMap(([id, entry]) =>
      [390, 402].map((width) => ({
        id: `${id} at ${width}`,
        site: entry.sites[0],
        entry,
        width,
      }))
    ),
    PARITY_MATRIX
  )
  describe("MessageComponent draws as before", () => {
    it.each(rows)("$id ($site) [$env.language $env.platform]", async (row) => {
      const { id, entry, env } = row
      const tree = await renderScreen(loaderFor(entry), {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
        window: { width: row.width },
      })
      expectParity(parityName(id, env), tree)
    })
  })
}
