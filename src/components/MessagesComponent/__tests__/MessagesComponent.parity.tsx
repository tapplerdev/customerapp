import { describe, it } from "@jest/globals"
import path from "path"

/*
 * MessagesComponent (a row of the chat list), pinned to what it drew before
 * its conversion, for the prop sets its call sites hand it (the chat list's,
 * which can archive a row, and the archived list's, which cannot), with the
 * chat in each state a row is drawn in (unread counts, the pro's photo or
 * initial, the last message's kind and the time label), at the two phone
 * widths the archive action follows (the row reads the window as it loads).
 *
 * The prop sets are harvested from the call sites (testing/harvest) and
 * frozen in __fixtures__/MessagesComponent.cases.json; the sites pass no
 * class names. The photos are the kit's stand-ins. The trees in __parity__
 * were captured from MessagesComponent before its conversion (each case
 * names the commit). Both languages, both platforms.
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
import {
  CHAT_PREVIEW,
  DAYS_AGO,
  HOURS_AGO,
} from "testing/screenKit/fixtures/entities"
/* eslint-enable import/first */

const FILES = harvestFilesFor(__dirname, "MessagesComponent")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("MessagesComponent"),
  props: {
    item: "any",
    onPress: "fn",
    onArchive: "fn",
  },
}

/**
 * The chat list's rows (`item`, a ChatPreviewType) in each state the list
 * draws one: unread counts, the pro's photo or initial, the last message's
 * kind (text, system line, an offer revision, photos, a document, a
 * location, none yet) and the time label (today, yesterday, older).
 * The window is the kit's clock (2026-10-20, 08:00 UTC).
 */
const file = (id: number, mimeType: string, name: string) => ({
  id,
  fileName: name,
  extension: name.split(".").pop() as string,
  originalName: name,
  mimeType,
  storageKey: `parity/${name}`,
  url: `https://example.com/parity/${name}`,
  url150: `https://example.com/parity/150-${name}`,
})
const photos = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    file(index + 1, "image/jpeg", `photo-${index + 1}.jpg`)
  )
const message = (patch: Record<string, unknown>) => ({
  ...CHAT_PREVIEW.lastMessage,
  text: undefined,
  files: undefined,
  location: undefined,
  ...patch,
})
const preview = (patch: Record<string, unknown>) => ({
  ...CHAT_PREVIEW,
  ...patch,
})
const withPro = (
  pro: Record<string, unknown>,
  patch: Record<string, unknown> = {}
) =>
  preview({
    chat: { ...CHAT_PREVIEW.chat, pro: { ...CHAT_PREVIEW.chat.pro, ...pro } },
    ...patch,
  })

const ITEMS: Record<string, unknown> = {
  "unread, a text": preview({
    notReadMessages: 1,
    lastMessage: message({
      ownerType: "pro",
      text: "Thursday at 10 works, see you then.",
      createdAt: HOURS_AGO(1),
    }),
  }),
  "read, my own text": preview({
    notReadMessages: 0,
    lastMessage: message({
      ownerType: "customer",
      text: "Thank you!",
      createdAt: HOURS_AGO(1),
    }),
  }),
  "unread 120": preview({
    notReadMessages: 120,
    lastMessage: message({
      ownerType: "pro",
      text: "Hello",
      createdAt: HOURS_AGO(1),
    }),
  }),
  "a long text": preview({
    lastMessage: message({
      ownerType: "pro",
      text: "I can come on Thursday at 10 with the parts and a second pair of hands, so it takes under an hour.",
      createdAt: HOURS_AGO(1),
    }),
  }),
  yesterday: preview({
    lastMessage: message({
      ownerType: "pro",
      text: "See you tomorrow",
      createdAt: HOURS_AGO(30),
    }),
  }),
  "last week": preview({
    lastMessage: message({
      ownerType: "pro",
      text: "Done, thanks",
      createdAt: DAYS_AGO(8),
    }),
  }),
  "no photo, a business name": withPro(
    {
      profilePhoto: undefined,
      profilePhoto150: undefined,
      businessName: "Hassan Plumbing",
    },
    {
      lastMessage: message({
        ownerType: "pro",
        text: "Hi",
        createdAt: HOURS_AGO(2),
      }),
    }
  ),
  "no photo, no business name": withPro(
    {
      profilePhoto: undefined,
      profilePhoto150: undefined,
      businessName: undefined,
    },
    {
      lastMessage: message({
        ownerType: "pro",
        text: "Hi",
        createdAt: HOURS_AGO(2),
      }),
    }
  ),
  "one photo": preview({
    lastMessage: message({
      ownerType: "pro",
      files: photos(1),
      createdAt: HOURS_AGO(1),
    }),
  }),
  "three photos": preview({
    lastMessage: message({
      ownerType: "pro",
      files: photos(3),
      createdAt: HOURS_AGO(1),
    }),
  }),
  "five photos with text": preview({
    lastMessage: message({
      ownerType: "pro",
      files: photos(5),
      text: "The parts",
      createdAt: HOURS_AGO(1),
    }),
  }),
  "a document": preview({
    lastMessage: message({
      ownerType: "pro",
      files: [file(90, "application/pdf", "Quote.pdf")],
      createdAt: HOURS_AGO(1),
    }),
  }),
  "a location": preview({
    lastMessage: message({
      ownerType: "pro",
      location: { id: 1, latitude: 30.04, longitude: 31.23 },
      createdAt: HOURS_AGO(1),
    }),
  }),
  "a system line": preview({
    lastMessage: message({
      ownerType: "system",
      text: "job_expired",
      createdAt: HOURS_AGO(5),
    }),
  }),
  "an offer revision": preview({
    lastMessage: message({
      ownerType: "system",
      text: "offer_updated:250:220",
      createdAt: HOURS_AGO(1),
    }),
  }),
  "no message yet": preview({ notReadMessages: 0, lastMessage: undefined }),
  "no category name": preview({
    chat: { ...CHAT_PREVIEW.chat, serviceCategory: undefined },
    lastMessage: message({
      ownerType: "pro",
      text: "Hi",
      createdAt: HOURS_AGO(1),
    }),
  }),
}
const VARIANTS = Object.fromEntries(
  Object.keys(ITEMS).map((name) => [name, name])
)

const rowItem = (variant: string, key: string) => {
  if (key === "item") return ITEMS[variant]
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
    const Component = require("../MessagesComponent").default
    /* eslint-enable global-require, @typescript-eslint/no-var-requires */
    const Harness = () =>
      React.createElement(
        Component,
        buildProps(entry.props, {
          opaque: (key: string) => rowItem(variant, key),
        })
      )
    return { default: Harness }
  }

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases", () => {
      writeHarvest(FILES, "MessagesComponent", OPTIONS, captureCommit())
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
  describe("MessagesComponent draws as before", () => {
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
