/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"
import type { ReactTestInstance } from "react-test-renderer"

import {
  copy,
  openScreen,
  pressIcon,
  pressText,
  pressTitled,
  renderScreen,
  rowsByPlatform,
  typeInto,
  type BackendFixtures,
  type RenderScreenOptions,
} from "testing/screenKit"
import { screenState } from "testing/screenKit/states"
import { DATA, SERVER_ERROR } from "testing/screenKit/fixtures/api"
import { CHAT } from "testing/screenKit/fixtures/entities"
import {
  PARITY_MATRIX,
  expectParity,
  parityName,
  type ParityEnv,
} from "testing/hostTreeParity"
import { pressContaining } from "testing/pressContaining"
import type { ChatMessageType, ChatPreviewType } from "types/chat"

import {
  ATTACHMENTS,
  DATES_AND_TEXT,
  DIRECT,
  ENDED,
  FOOD,
  FOOD_DELIVERED,
  JOB_DETAILS,
  LONG_THREAD,
  NO_PHOTO,
  SYSTEM_EVENTS,
  THREAD,
  WITH_OFFER,
} from "../__fixtures__/chat"

/*
 * MessagesDetailsScreen (a conversation), captured before its conversion:
 * what the thread draws (text over three days, photos of every count, a
 * document and locations, every system line, empty: a thread still loading draws
 * the same as an empty one, so it has no row of its own), the header
 * (a direct chat, a request with an offer, an ended one with its repost
 * strip, a food order, a pro with no photo), the composer at three bottom
 * insets, and a customer who has typed or has the keyboard up. Then each
 * thing a customer presses: the sheets (attachments, with photos picked;
 * My request; the ••• menu, then cancel, yes, and the reasons), the offer pill's
 * history sheet, the scroll-down button, a send that is blocked, fails or
 * goes, the header, the back chevron.
 */

const load = () => require("../MessagesDetailsScreen")

type Case = {
  name: string
  preview: ChatPreviewType
  messages?: ChatMessageType[] | "loading"
  api?: BackendFixtures
  insets?: { bottom: number }
  window?: { width: number; height: number }
}

/** What the backend answers for a preview and its thread. */
const apiFor = (
  preview: ChatPreviewType,
  messages: ChatMessageType[] | "loading" = THREAD,
  extra: BackendFixtures = {}
): BackendFixtures => ({
  ...DATA,
  // The screen prefers the live chat list's entry over the route's.
  getChats: { data: { data: [preview] } },
  getChatMessages:
    messages === "loading"
      ? "loading"
      : (args: unknown) => {
          const page = Number(
            /[?&]page=(\d+)/.exec(JSON.stringify(args))?.[1] ?? 1
          )
          return {
            data: {
              data: page === 1 ? messages : [],
              page,
              perPage: 20,
              total: messages.length,
            },
          }
        },
  getCustomerJobDetails: { data: JOB_DETAILS },
  ...extra,
})

const SMALL_PHONE = { width: 390, height: 844 }
const CASES: Case[] = [
  { name: "direct chat", preview: DIRECT },
  { name: "request with an offer", preview: WITH_OFFER },
  { name: "ended request", preview: ENDED },
  { name: "food order", preview: FOOD },
  { name: "no photo, no last seen", preview: NO_PHOTO },
  { name: "empty thread", preview: WITH_OFFER, messages: [] },
  {
    name: "text over three days",
    preview: WITH_OFFER,
    messages: DATES_AND_TEXT,
  },
  { name: "attachments", preview: DIRECT, messages: ATTACHMENTS },
  { name: "system lines", preview: FOOD, messages: SYSTEM_EVENTS },
  {
    name: "attachments, small phone",
    preview: DIRECT,
    messages: ATTACHMENTS,
    window: SMALL_PHONE,
  },
  {
    name: "text, small phone",
    preview: WITH_OFFER,
    messages: DATES_AND_TEXT,
    window: SMALL_PHONE,
  },
  {
    name: "no bottom inset",
    preview: WITH_OFFER,
    insets: { bottom: 0 },
  },
  {
    name: "bottom inset 48",
    preview: WITH_OFFER,
    insets: { bottom: 48 },
  },
]
// A window is part of a registry: keep a window's rows together.
const ordered = [
  ...CASES.filter((c) => !c.window),
  ...CASES.filter((c) => c.window),
]
const rows = rowsByPlatform(ordered, PARITY_MATRIX)

const options = (c: Case, env: ParityEnv): RenderScreenOptions => ({
  ...screenState("data"),
  api: c.api ?? apiFor(c.preview, c.messages),
  lang: env.language,
  platform: env.platform,
  route: { name: "MessagesDetailsScreen", params: { chatPreview: c.preview } },
  ...(c.insets ? { insets: c.insets } : {}),
  ...(c.window ? { window: c.window } : {}),
})

describe("MessagesDetailsScreen, captured from the unconverted code", () => {
  it.each(rows)("$name [$env.language $env.platform]", async (c) => {
    expectParity(
      parityName(c.name, c.env),
      await renderScreen(load, options(c, c.env))
    )
  })
})

const envs = rowsByPlatform([{}], PARITY_MATRIX)
const open = (c: Case, env: ParityEnv, loader = load) =>
  openScreen(loader, options(c, env))
const byName = (name: string) => CASES.find((c) => c.name === name)!
const WITH_OFFER_CASE = byName("request with an offer")

const find = (
  root: ReactTestInstance,
  predicate: (n: ReactTestInstance) => boolean
) => root.findAll(predicate, { deep: false })
const requests = (
  session: Awaited<ReturnType<typeof open>>,
  endpoint: string
) => session.requests().filter((r) => r.endpoint === endpoint)
const dots = (root: ReactTestInstance) => {
  const found = find(
    root,
    (n) =>
      typeof n.props.onPress === "function" &&
      typeof n.type !== "string" &&
      (n.props.hitSlop as { top?: number } | undefined)?.top === 12
  )
  expect(found).toHaveLength(1)
  return found[0]
}
// The composer's + draws two bars and no words: with the pro's photo in the
// header the icon-only controls are the back chevron, the ••• (four views),
// the photo and the + (three views).
// Whether the confirm modal (MainModal, titled) is asked to be visible: on iOS
// the kit's modal stays in the tree after it is told to hide (its hide
// animation never completes under the fake clock), so a press on No or Yes
// shows in this prop and not always in the tree.
const confirmVisible = (root: ReactTestInstance, env: ParityEnv) => {
  const found = find(
    root,
    (n) =>
      typeof n.type !== "string" &&
      n.props.title === copy(env, "are_you_sure_cancel") &&
      typeof n.props.isVisible === "boolean"
  )
  expect(found).toHaveLength(1)
  return found[0].props.isVisible as boolean
}
const plus = (root: ReactTestInstance) => pressIcon(root, { nth: 3 })

describe("MessagesDetailsScreen, the composer", () => {
  it.each(envs)(
    "typed text enables Send, which sends it and shows the bubble at once [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(WITH_OFFER_CASE, env)
      try {
        await session.act(() => {
          typeInto(session.root, 0, "On my way")
        })
        expectParity(parityName("typed", env), session.tree())
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:sendArrow" })
        })
        // sendMessage has no answer here: the bubble is the optimistic one.
        expect(requests(session, "sendMessage")).toHaveLength(1)
        expect(requests(session, "sendMessage")[0].args).toMatchObject({
          method: "POST",
          body: { text: "On my way" },
        })
        expectParity(parityName("sent, optimistic bubble", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a refused send brings the text back with the banner, which a tap dismisses [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(
        {
          ...WITH_OFFER_CASE,
          api: apiFor(WITH_OFFER, THREAD, { sendMessage: SERVER_ERROR }),
        },
        env
      )
      try {
        await session.act(() => {
          typeInto(session.root, 0, "On my way")
        })
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:sendArrow" })
        })
        expectParity(parityName("send failed", env), session.tree())
        await session.act(() => {
          pressContaining(session.root, copy(env, "tap_to_dismiss"))
        })
        expectParity(parityName("banner dismissed", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a message the community rules block opens the blocked sheet [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(WITH_OFFER_CASE, env)
      try {
        await session.act(() => {
          typeInto(session.root, 0, "what the fuck")
        })
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:sendArrow" })
        })
        expect(requests(session, "sendMessage")).toHaveLength(0)
        expectParity(parityName("blocked", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the keyboard swaps the bar's bottom padding for 12 [$env.language $env.platform]",
    async ({ env }) => {
      // The screen listens to the keyboard's show event: catch its handler as it
      // registers (React Native's jest setup draws no keyboard of its own).
      const handlers: Record<string, () => void> = {}
      const spying = () => {
        const { Keyboard } = require("react-native")
        const original = Keyboard.addListener
        Keyboard.addListener = (name: string, handler: () => void) => {
          handlers[name] = handler
          return original.call(Keyboard, name, handler)
        }
        return load()
      }
      const event =
        env.platform === "android" ? "keyboardDidShow" : "keyboardWillShow"
      const session = await open(WITH_OFFER_CASE, env, spying)
      try {
        expect(typeof handlers[event]).toBe("function")
        await session.act(() => {
          handlers[event]()
        })
        expectParity(parityName("keyboard up", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )
})

// Photos the camera roll holds, for the attachment sheet's strip. The loader
// sets them in the row's registry before the screen loads.
const PHOTOS = [1, 2, 3].map((n) => `file:///parity/roll${n}.jpg`)
const withCameraRoll = () => {
  const { CameraRoll } = require("@react-native-camera-roll/camera-roll")
  CameraRoll.getPhotos = () =>
    Promise.resolve({
      edges: PHOTOS.map((uri) => ({ node: { image: { uri } } })),
      page_info: { has_next_page: false },
    })
  return load()
}
const photoTile = (root: ReactTestInstance, uri: string) => {
  const found = find(
    root,
    (n) =>
      typeof n.props.onPress === "function" &&
      typeof n.type !== "string" &&
      n.findAll(
        (inner) =>
          (inner.type as unknown) === "Image" && inner.props.source?.uri === uri
      ).length > 0
  )
  expect(found).toHaveLength(1)
  return found[0]
}

describe("MessagesDetailsScreen, the sheets", () => {
  it.each(envs)(
    "+ opens the attachment sheet, photos can be picked and taken off again [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(WITH_OFFER_CASE, env, withCameraRoll)
      try {
        await session.act(() => {
          plus(session.root)
        }, 400)
        expectParity(parityName("attachment sheet", env), session.tree())
        await session.act(() => {
          photoTile(session.root, PHOTOS[0]).props.onPress()
          photoTile(session.root, PHOTOS[2]).props.onPress()
        })
        expectParity(parityName("two photos picked", env), session.tree())
        // The pending strip's own X takes the first one off again.
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:close", nth: 0 })
        })
        expectParity(parityName("one photo left", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "Upload file takes a document into the composer, which can be taken off [$env.language $env.platform]",
    async ({ env }) => {
      const withPicker = () => {
        const documents = require("@react-native-documents/picker")
        documents.pick = () =>
          Promise.resolve([
            {
              uri: "file:///parity/quote.pdf",
              type: "application/pdf",
              name: "quote.pdf",
            },
          ])
        return withCameraRoll()
      }
      const session = await open(WITH_OFFER_CASE, env, withPicker)
      try {
        await session.act(() => {
          plus(session.root)
        }, 400)
        await session.act(() => {
          pressContaining(session.root, copy(env, "upload_file"))
        })
        expectParity(parityName("document pending", env), session.tree())
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:close", nth: 0 })
        })
        expectParity(parityName("document taken off", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "Location goes to the address picker; the camera tile and View library open their pickers [$env.language $env.platform]",
    async ({ env }) => {
      const opened: string[] = []
      const withPickers = () => {
        const crop = require("react-native-image-crop-picker")
        crop.default.openCamera = () => {
          opened.push("camera")
          return new Promise(() => {})
        }
        crop.default.openPicker = () => {
          opened.push("library")
          return new Promise(() => {})
        }
        return withCameraRoll()
      }
      // Each control closes the sheet as it works: one session for each.
      const press = async (act: (root: ReactTestInstance) => void) => {
        const session = await open(WITH_OFFER_CASE, env, withPickers)
        try {
          await session.act(() => {
            plus(session.root)
          }, 400)
          await session.act(() => {
            act(session.root)
          }, 600)
          return session.navigation.actions
        } finally {
          session.unmount()
        }
      }
      await press((root) => pressText(root, copy(env, "view_library")))
      expect(opened).toEqual(["library"])
      // The camera tile draws the camera icon and nothing else.
      await press((root) => pressIcon(root, { icon: "svg:camera-icon" }))
      expect(opened).toEqual(["library", "camera"])
      const actions = await press((root) =>
        pressText(root, copy(env, "location"))
      )
      expect(actions).toMatchObject([
        { type: "NAVIGATE", payload: { name: "PickAddressScreen" } },
      ])
    }
  )

  it.each(envs)(
    "on an ended request the attachment sheet is dimmed and dead [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(byName("ended request"), env, withCameraRoll)
      try {
        await session.act(() => {
          plus(session.root)
        }, 400)
        expectParity(parityName("attachment sheet, ended", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "a delivered food order keeps its attachments live [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(
        {
          ...byName("food order"),
          preview: FOOD_DELIVERED,
          api: apiFor(FOOD_DELIVERED),
        },
        env,
        withCameraRoll
      )
      try {
        await session.act(() => {
          plus(session.root)
        }, 400)
        expectParity(
          parityName("attachment sheet, delivered food", env),
          session.tree()
        )
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "My Request opens the request sheet, with its map [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(WITH_OFFER_CASE, env)
      try {
        await session.act(() => {
          pressContaining(session.root, copy(env, "my_request"))
        })
        expectParity(parityName("request sheet", env), session.tree())
        // Its close button.
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:close" })
        })
        expectParity(parityName("request sheet closed", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the offer pill opens the offer history sheet [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(WITH_OFFER_CASE, env)
      try {
        await session.act(() => {
          pressContaining(session.root, `${copy(env, "offer")}150`)
        })
        expectParity(parityName("offer history", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the ••• menu: the sheet, then My request details, then Cancel through its two steps [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(WITH_OFFER_CASE, env)
      try {
        await session.act(() => {
          dots(session.root).props.onPress()
        })
        expectParity(parityName("menu", env), session.tree())
        await session.act(() => {
          pressContaining(session.root, copy(env, "my_request_details"))
        }, 800)
        expectParity(parityName("menu, details", env), session.tree())
      } finally {
        session.unmount()
      }
      const cancel = await open(WITH_OFFER_CASE, env)
      try {
        await cancel.act(() => {
          dots(cancel.root).props.onPress()
        })
        await cancel.act(() => {
          pressContaining(cancel.root, copy(env, "cancel_service_request"))
        }, 800)
        expectParity(parityName("cancel, are you sure", env), cancel.tree())
        expect(confirmVisible(cancel.root, env)).toBe(true)
        await cancel.act(() => {
          pressTitled(cancel.root, copy(env, "no"))
        }, 800)
        expect(confirmVisible(cancel.root, env)).toBe(false)
        expectParity(parityName("cancel, no", env), cancel.tree())
      } finally {
        cancel.unmount()
      }
      const yes = await open(WITH_OFFER_CASE, env)
      try {
        await yes.act(() => {
          dots(yes.root).props.onPress()
        })
        await yes.act(() => {
          pressContaining(yes.root, copy(env, "cancel_service_request"))
        }, 800)
        expect(confirmVisible(yes.root, env)).toBe(true)
        await yes.act(() => {
          pressTitled(yes.root, copy(env, "yes"))
        }, 1200)
        expect(confirmVisible(yes.root, env)).toBe(false)
        expectParity(parityName("cancel, yes", env), yes.tree())
      } finally {
        yes.unmount()
      }
    }
  )

  it.each(envs)(
    "an ended request's menu has no Cancel [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(byName("ended request"), env)
      try {
        await session.act(() => {
          dots(session.root).props.onPress()
        })
        expectParity(parityName("menu, ended", env), session.tree())
      } finally {
        session.unmount()
      }
    }
  )
})

describe("MessagesDetailsScreen, the list and the header", () => {
  it.each(envs)(
    "scrolling up shows the scroll-down button, which scrolls back [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(byName("text over three days"), env)
      const { FlatList } = require("react-native")
      const scrollToOffset = jest
        .spyOn(FlatList.prototype, "scrollToOffset")
        .mockImplementation(() => {})
      try {
        const list = find(
          session.root,
          (n) =>
            typeof n.props.onScroll === "function" && typeof n.type !== "string"
        )[0]
        await session.act(() => {
          list.props.onScroll({ nativeEvent: { contentOffset: { y: 400 } } })
        })
        expectParity(parityName("scroll-down button", env), session.tree())
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:chevron-down" })
        })
        expect(scrollToOffset).toHaveBeenCalledWith({
          offset: 0,
          animated: true,
        })
      } finally {
        scrollToOffset.mockRestore()
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "reaching the top of a full page asks for the next one and shows the spinner [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(
        {
          ...WITH_OFFER_CASE,
          messages: LONG_THREAD,
          api: apiFor(WITH_OFFER, LONG_THREAD),
        },
        env
      )
      try {
        const list = find(
          session.root,
          (n) =>
            typeof n.props.onEndReached === "function" &&
            typeof n.type !== "string"
        )[0]
        await session.act(() => {
          list.props.onEndReached()
        }, 200)
        expectParity(parityName("loading older", env), session.tree())
        expect(
          requests(session, "getChatMessages").some((r) =>
            JSON.stringify(r.args).includes("page=2")
          )
        ).toBe(true)
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the back chevron goes back [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(WITH_OFFER_CASE, env)
      try {
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:chevron-left" })
        })
        expect(session.navigation.actions).toMatchObject([{ type: "GO_BACK" }])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the pro's name opens their profile once it has loaded [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(WITH_OFFER_CASE, env)
      try {
        await session.act(() => {
          pressContaining(session.root, CHAT.pro.registeredName)
        })
        expect(session.navigation.actions).toMatchObject([
          {
            type: "NAVIGATE",
            payload: {
              name: "ProProfileScreen",
              params: {
                proId: CHAT.pro.id,
                serviceCategoryId: CHAT.serviceCategoryId,
              },
            },
          },
        ])
      } finally {
        session.unmount()
      }
    }
  )

  it.each(envs)(
    "the ended strip's repost goes through the search animation [$env.language $env.platform]",
    async ({ env }) => {
      const session = await open(byName("ended request"), env)
      try {
        await session.act(() => {
          pressContaining(session.root, copy(env, "repost_request"))
        })
        expect(session.navigation.actions).toMatchObject([
          { type: "NAVIGATE", payload: { name: "SearchAnimationScreen" } },
        ])
      } finally {
        session.unmount()
      }
    }
  )
})
