import { afterEach, describe, expect, it, jest } from "@jest/globals"
import React, { act } from "react"
import TestRenderer from "react-test-renderer"
import fs from "fs"
import path from "path"
import moment from "moment"
// What BootstrapScreen does once, at the app's start.
import "moment/locale/ar"

/*
 * moment's global locale is the app's language, and drawing a chat bubble
 * must not change it. MessageComponent used to import `moment/locale/ar`,
 * which registers the locale AND makes it moment's global one, so after the
 * first chat every `moment().format()` elsewhere (NotificationItem,
 * OfferHistorySheet, RequestSummaryScreen) printed Arabic, English users
 * included. Now BootstrapScreen registers the locale once and sets the global
 * locale to the app's language (as proapp's does); the bubble formats per call.
 *
 * The real bubble and the real notification row are drawn, one after the
 * other, in each language, with the global locale set as BootstrapScreen's
 * language effect sets it. Native views, the viewers and the sub-bubbles are
 * stand-ins that keep their props.
 */

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)
jest.mock("@tappler/shared/src/components/UI", () => {
  const { createElement } = jest.requireActual("react") as typeof React
  const host =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      createElement(name, props, children)
  return { DmView: host("DmView"), DmText: host("DmText") }
})
jest.mock("react-native-fast-image", () =>
  Object.assign(() => null, { resizeMode: { cover: "cover" } })
)
jest.mock("react-native-maps", () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock("react-native-autolink", () => ({
  __esModule: true,
  default: ({ text }: { text: string }) => text,
}))
jest.mock("@tappler/shared/src/components/MapPinMarker", () => () => null)
jest.mock(
  "@tappler/shared/src/components/DocumentViewerModal",
  () => () => null
)
jest.mock("components/ImageViewerModal/ImageViewerModal", () => () => null)
jest.mock("components/SystemEventBubble/SystemEventBubble", () => () => null)
jest.mock("assets/icons/job-details.svg", () => () => null)

import i18n from "locales/i18n"
import MessageComponent from "../MessageComponent"
import NotificationItem from "screens/dashboardScreens/NotificationsScreen/components/NotificationItem"

const AT = "2026-10-20T08:47:00.000Z"

const message = {
  id: 1,
  chatId: 6001,
  ownerType: "pro",
  createdAt: AT,
  readAt: null,
  text: "On my way",
} as never

const notification = {
  id: 7,
  title: "Offer",
  body: "A new offer",
  createdAt: AT,
  readAt: null,
} as never

const texts = (tree: TestRenderer.ReactTestRenderer): string[] =>
  tree.root
    .findAll(
      (node) =>
        node.children.length > 0 &&
        node.children.every((child) => typeof child === "string")
    )
    .map((node) => node.children.join(""))

const draw = async (element: React.ReactElement) => {
  let tree!: TestRenderer.ReactTestRenderer
  await act(async () => {
    tree = TestRenderer.create(element)
  })
  return tree
}

const chatThenNotification = async () => {
  const chat = await draw(
    <MessageComponent
      item={message}
      isFirstInGroup
      isLastInGroup
      showTimestamp
    />
  )
  const row = await draw(
    <NotificationItem item={notification} onPress={() => undefined} />
  )
  return { chat: texts(chat), row: texts(row) }
}

const setAppLanguage = async (language: "en" | "ar") => {
  await act(async () => {
    await i18n.changeLanguage(language)
  })
  moment.locale(language)
}

afterEach(async () => {
  await setAppLanguage("en")
})

describe("a chat bubble and moment's locale", () => {
  it("English: the bubble reads English, and so does every date drawn after it", async () => {
    await setAppLanguage("en")
    const { chat, row } = await chatThenNotification()

    expect(chat).toContain("11:47 AM")
    expect(row).toContain("20/10/2026")
    expect(moment.locale()).toBe("en")
    expect(moment(AT).format("dddd D MMMM")).toBe("Tuesday 20 October")
  })

  it("Arabic: the bubble, the notification row and a plain format all read Arabic, and the global stays Arabic", async () => {
    await setAppLanguage("ar")
    const { chat, row } = await chatThenNotification()

    expect(chat).toContain("١١:٤٧ ص")
    expect(row).toContain("٢٠/١٠/٢٠٢٦")
    expect(moment.locale()).toBe("ar")
    expect(moment(AT).format("dddd")).toBe("الثلاثاء")
  })

  it("a bubble asks for its own language, whatever the global one is", async () => {
    await setAppLanguage("en")
    expect(moment(AT).locale("ar").format("dddd")).toBe("الثلاثاء")
    expect(moment(AT).locale("en").format("dddd")).toBe("Tuesday")
    expect(moment.locale()).toBe("en")
  })

  it("no component imports a moment locale: only BootstrapScreen registers it", () => {
    // An import of `moment/locale/xx` makes that locale the global one when
    // the file first loads, which on the device is the first time the
    // component is drawn.
    const root = path.join(__dirname, "..", "..", "..")
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__" && entry.name !== "testing") walk(file)
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          if (/moment\/locale\//.test(fs.readFileSync(file, "utf8"))) {
            offenders.push(path.relative(root, file))
          }
        }
      }
    }
    walk(root)
    expect(offenders).toEqual(["screens/BootstrapScreen/BootstrapScreen.tsx"])
  })
})
