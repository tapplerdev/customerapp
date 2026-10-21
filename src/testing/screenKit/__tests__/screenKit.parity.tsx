/* eslint-disable global-require, @typescript-eslint/no-var-requires, no-restricted-syntax --
   the kit loads each render's modules in the render's platform registry,
   so screens are passed as loaders. */
import { describe, expect, it, jest } from "@jest/globals"
import fs from "fs"
import path from "path"
import { act } from "react"
import ts from "typescript"

import {
  AUTH_REFRESH,
  PER_ROW,
  closeSheetAsUser,
  fireHost,
  httpKey,
  loadedDirection,
  loadedPlatform,
  openScreen,
  renderScreen,
  rowsByPlatform,
  type KitPlatform,
  type ScreenSession,
} from "testing/screenKit"
import { DATA, QUERY_ENDPOINTS } from "testing/screenKit/fixtures/api"
import { KIT_NOW } from "testing/screenKit/fixtures/entities"
import { CUSTOMER, signedIn } from "testing/screenKit/fixtures/users"
import { screenState } from "testing/screenKit/states"
import type { HostNode } from "testing/hostTreeParity"

/*
 * The screen kit itself: each switch it promises is real, checked against
 * what a screen reads (KitProbe and the other probes), and a real screen
 * draws its data.
 */

const SRC = path.resolve(__dirname, "../../..")
const probe = () => require("../__fixtures__/KitProbe")

const find = (tree: HostNode | null, testID: string): HostNode | undefined => {
  const visit = (node: HostNode | string): HostNode | undefined => {
    if (typeof node === "string") return undefined
    if (node.props.testID === testID) return node
    for (const child of node.children) {
      const found = visit(child)
      if (found) return found
    }
    return undefined
  }
  return tree ? visit(tree) : undefined
}

const text = (tree: HostNode | null, testID: string): string =>
  (find(tree, testID)?.children ?? []).join("")

const press = (session: ScreenSession, testID: string) =>
  (session.root.findByProps({ testID }).props as { onPress: () => void })
    .onPress()

const hosts = (tree: HostNode | null, type: string): HostNode[] => {
  const out: HostNode[] = []
  const visit = (node: HostNode | string) => {
    if (typeof node === "string") return
    if (node.type === type) out.push(node)
    node.children.forEach(visit)
  }
  if (tree) visit(tree)
  return out
}

describe("a render's platform is decided before its modules load", () => {
  const rows: { platform: KitPlatform; drawn: string }[] = [
    { platform: "ios", drawn: "ios ios i 18.4" },
    { platform: "android", drawn: "android android a 35" },
    { platform: "ios", drawn: "ios ios i 18.4" },
  ]
  it.each(rows)("$platform", async ({ platform, drawn }) => {
    const tree = await renderScreen(
      () => require("../__fixtures__/PlatformAtImport"),
      { platform, navigation: "none" }
    )
    expect(loadedPlatform()).toBe(platform)
    expect(tree?.children).toEqual([drawn])
  })

  it("orders a table by platform, then English before Arabic, so a file switches registries once each", () => {
    const matrix = [
      { language: "en", platform: "ios" },
      { language: "ar", platform: "ios" },
      { language: "en", platform: "android" },
      { language: "ar", platform: "android" },
    ] as const
    expect(
      rowsByPlatform([{ id: 1 }, { id: 2 }], matrix).map(
        (row) => `${row.id} ${row.env.language} ${row.env.platform}`
      )
    ).toEqual([
      "1 en ios",
      "2 en ios",
      "1 ar ios",
      "2 ar ios",
      "1 en android",
      "2 en android",
      "1 ar android",
      "2 ar android",
    ])
  })
})

describe("a render's layout direction is decided before its modules load", () => {
  const rows: {
    lang: "en" | "ar"
    platform: KitPlatform
    drawn: string
    textAlign: string
  }[] = [
    { lang: "en", platform: "ios", drawn: "ltr ltr", textAlign: "left" },
    { lang: "ar", platform: "ios", drawn: "rtl rtl", textAlign: "right" },
    { lang: "ar", platform: "android", drawn: "rtl rtl", textAlign: "right" },
    { lang: "en", platform: "android", drawn: "ltr ltr", textAlign: "left" },
  ]
  it.each(rows)("$lang $platform", async ({ lang, platform, drawn, textAlign }) => {
    const tree = await renderScreen(
      () => require("../__fixtures__/RtlAtImport"),
      { lang, platform, navigation: "none" }
    )
    expect(loadedDirection()).toBe(lang === "ar" ? "rtl" : "ltr")
    expect(tree?.children).toEqual([drawn])
    expect(tree?.props.style).toEqual({ textAlign })
    const { I18nManager } = require("react-native") as {
      I18nManager: { isRTL: boolean }
    }
    // put back to the registry's after the render
    expect(I18nManager.isRTL).toBe(lang === "ar")
  })
})

describe("what a render sets up", () => {
  it("the language: i18next, RTL and the store's", async () => {
    const en = await renderScreen(probe, screenState("data"))
    const ar = await renderScreen(probe, { ...screenState("data"), lang: "ar" })
    expect(text(en, "language")).toBe("en en ltr Messages")
    expect(text(ar, "language")).toBe("ar ar rtl الرسائل")
  })

  // customerapp's BootstrapScreen sets i18next and RTL but never moment:
  // moment keeps the device locale shared's setupI18n gave it (skeptic M2).
  it("moment on the device's locale in both languages, as the app leaves it", async () => {
    const en = await renderScreen(probe, screenState("data"))
    const ar = await renderScreen(probe, { ...screenState("data"), lang: "ar" })
    expect(text(en, "moment")).toBe("en 20 October")
    expect(text(ar, "moment")).toBe("en 20 October")
  })

  it("moment back on the device's locale after a module imported moment/locale/ar", async () => {
    const tree = await renderScreen(
      () => require("../__fixtures__/MomentProbe"),
      { navigation: "none", lang: "ar" }
    )
    expect(text(tree, "moment")).toBe("en Tuesday")
  })

  it("the Latin faces customerapp draws (Montserrat), and NativeWind compiling", async () => {
    const tree = await renderScreen(probe, screenState("data"))
    const face = tree?.children.find(
      (child) => typeof child !== "string" && child.children[0] === "face"
    ) as HostNode
    expect(face.props.style).toMatchObject({
      fontSize: 20,
      fontFamily: "Montserrat-SemiBold",
    })
  })

  it("a frozen clock, moved only by the settle loop, the fixtures' clock", async () => {
    const at = await renderScreen(probe, {
      ...screenState("data"),
      now: "2026-01-01T00:00:00.000Z",
      settleMs: 0,
    })
    expect(text(at, "clock")).toBe("2026-01-01T00:00:00.000Z")
    expect(Date.now()).not.toBe(Date.parse("2026-01-01T00:00:00.000Z"))
    const { DEFAULT_NOW } = require("../engine") as { DEFAULT_NOW: string }
    expect(KIT_NOW).toBe(Date.parse(DEFAULT_NOW))
  })

  it("the platform's insets by default, the test's when given", async () => {
    const ios = await renderScreen(probe, screenState("data"))
    const android = await renderScreen(probe, {
      ...screenState("data"),
      platform: "android",
    })
    const given = await renderScreen(probe, {
      ...screenState("data"),
      insets: { top: 0, bottom: 0 },
    })
    expect(text(ios, "insets")).toBe("62 34")
    expect(text(android, "insets")).toBe("24 24")
    expect(text(given, "insets")).toBe("0 0")
  })

  it("a fresh store per render, from the render's state, behind `store` too", async () => {
    const mona = await renderScreen(probe, screenState("data"))
    const other = await renderScreen(probe, {
      state: { auth: signedIn({ ...CUSTOMER, firstName: "Sara", lastName: "Nabil" }) },
    })
    expect(text(mona, "user")).toBe("Mona Adel")
    expect(text(other, "user")).toBe("Sara Nabil")
    const withCart = await renderScreen(probe, {
      ...screenState("data"),
      state: {
        ...screenState("data").state,
        cart: { carts: { 1003: { proId: 1003 } as never }, address: null },
      },
    })
    expect(text(withCart, "cart")).toBe("drafts 1003")
    expect(text(mona, "cart")).toBe("drafts ")
  })

  it("the store is built from the same reducers and middleware as src/store/index.ts", () => {
    const file = path.join(SRC, "store", "index.ts")
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true
    )
    let keys: string[] = []
    let tags: string[] = []
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText()
        const [first, second] = node.arguments
        if (
          callee === "combineReducers" &&
          first &&
          ts.isObjectLiteralExpression(first)
        ) {
          keys = first.properties.map((property) => {
            const name = property.name!
            return ts.isComputedPropertyName(name)
              ? "api"
              : name.getText().replace(/"/g, "")
          })
        }
        if (
          callee === "createAppStateMiddleware" &&
          second &&
          ts.isArrayLiteralExpression(second)
        ) {
          tags = second.elements.map((tag) => tag.getText().replace(/"/g, ""))
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    const { REDUCER_KEYS, APP_STATE_TAGS } = require("../store") as {
      REDUCER_KEYS: readonly string[]
      APP_STATE_TAGS: readonly string[]
    }
    expect([...REDUCER_KEYS].sort()).toEqual(keys.sort())
    expect([...APP_STATE_TAGS]).toEqual(tags)
  })

  it("fixtures/api answers every query services/api.ts defines, and only those", () => {
    const file = path.join(SRC, "services", "api.ts")
    const queries = [
      ...fs
        .readFileSync(file, "utf8")
        .matchAll(/^ {4}(\w+): builder\.query</gm),
    ].map((match) => match[1])
    expect(queries).toHaveLength(18)
    expect(QUERY_ENDPOINTS).toEqual([...queries].sort())
  })

  it("the backend answers by endpoint, logs every request, and leaves the rest loading", async () => {
    const session = await openScreen(probe, {
      ...screenState("data"),
      api: { getChats: DATA.getChats },
    })
    try {
      const tree = session.tree()
      expect(text(tree, "chats")).toBe("chats 1 unread 1")
      expect(text(tree, "notifications")).toBe("loading")
      const requests = session.requests()
      expect(requests.find((r) => r.endpoint === "getChats")).toMatchObject({
        answer: "data",
        unanswered: false,
      })
      expect(
        requests.find((r) => r.endpoint === "getNotifications")
      ).toMatchObject({ answer: "loading", unanswered: true })
    } finally {
      session.unmount()
    }
  })

  it("an error answer is an error, as fetchBaseQuery would give it", async () => {
    const tree = await renderScreen(probe, {
      ...screenState("data"),
      api: { getChats: { error: { status: 500 } } },
    })
    expect(text(tree, "chats")).toBe("error")
  })

  it("a 401 goes through the app's refresh, answered by authRefresh", async () => {
    let calls = 0
    const session = await openScreen(probe, {
      ...screenState("data"),
      api: {
        getChats: () => {
          calls += 1
          return calls === 1 ? { error: { status: 401 } } : DATA.getChats
        },
        [AUTH_REFRESH]: {
          data: { token: "parity-token-2", refreshToken: "parity-refresh-2" },
        },
      },
    })
    try {
      expect(text(session.tree(), "chats")).toBe("chats 1 unread 1")
      expect(
        session.requests().map((r) => r.endpoint).filter((e) => e !== "getNotifications")
      ).toEqual(["getChats", AUTH_REFRESH, "getChats"])
      expect(session.store.getState().auth.token).toBe("parity-token-2")
    } finally {
      session.unmount()
    }
  })

  it("nothing reaches the network: a fetch nothing answers goes nowhere and is listed", async () => {
    const { networkAttempts } = require("../backend") as {
      networkAttempts: () => string[]
    }
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined)
    try {
      let settled = false
      void fetch("https://api.example.com/customers/me").then(() => {
        settled = true
      })
      await new Promise((resolve) => {
        setImmediate(resolve)
      })
      expect(settled).toBe(false)
      expect(networkAttempts()).toContain(
        "fetch https://api.example.com/customers/me"
      )
    } finally {
      warn.mockRestore()
    }
  })

  it("keys a plain fetch by its URL without HERE's apiKey", () => {
    expect(
      httpKey(
        "https://revgeocode.search.hereapi.com/v1/revgeocode?at=30.0444,31.2357&lang=en-US&apiKey=SECRET&limit=5"
      )
    ).toBe(
      "https://revgeocode.search.hereapi.com/v1/revgeocode?at=30.0444,31.2357&lang=en-US&limit=5"
    )
    expect(httpKey("https://x.example/a?apiKey=SECRET")).toBe("https://x.example/a")
    expect(httpKey("https://x.example/a?q=1&apiKey=SECRET")).toBe(
      "https://x.example/a?q=1"
    )
    expect(httpKey("https://example.com/parity/badge.svg")).toBe(
      "https://example.com/parity/badge.svg"
    )
  })

  it("answers HERE's geocoding and the SVG cache by URL, per render", async () => {
    const REVERSE =
      "https://revgeocode.search.hereapi.com/v1/revgeocode?at=30.0444,31.2357&lang=en-US&limit=5"
    const BADGE = "https://example.com/parity/badge.svg"
    const session = await openScreen(probe, {
      ...screenState("data"),
      http: {
        [REVERSE]: { json: { items: [{ title: "12 Tahrir Street, Dokki" }] } },
        [BADGE]: { text: "<svg viewBox='0 0 1 1'/>" },
      },
    })
    try {
      const here = require("services/here-maps-api") as {
        searchAddressByPosition: (p: object) => Promise<{ title: string }[]>
      }
      const svg = require("services/svgCache") as {
        loadSvg: (uri: string) => Promise<string | null>
        peekSvg: (uri: string) => string | null
      }
      let found: { title: string }[] = []
      let art: string | null = null
      await session.act(async () => {
        found = await here.searchAddressByPosition({ lat: 30.0444, lng: 31.2357 })
        art = await svg.loadSvg(BADGE)
      })
      expect(found).toEqual([{ title: "12 Tahrir Street, Dokki" }])
      expect(art).toContain("<svg")
      expect(svg.peekSvg(BADGE)).toContain("<svg")
      expect(session.fetches()).toEqual([
        { key: REVERSE, answered: true },
        { key: BADGE, answered: true },
      ])
      // the stub key never reaches a fixture key or the log
      expect(JSON.stringify(session.fetches())).not.toContain("apiKey")
    } finally {
      session.unmount()
    }
    // and the next row's cache starts empty (rowState)
    const next = await openScreen(probe, screenState("data"))
    try {
      const svg = require("services/svgCache") as {
        peekSvg: (uri: string) => string | null
      }
      expect(svg.peekSvg(BADGE)).toBeNull()
    } finally {
      next.unmount()
    }
  })

  it("a real navigator: route params, focus effects, and an action it can't handle recorded", async () => {
    const session = await openScreen(probe, {
      ...screenState("data"),
      route: { name: "HomeTabs", params: { screen: "home" } },
    })
    try {
      expect(text(session.tree(), "route")).toBe('HomeTabs {"screen":"home"}')
      expect(text(session.tree(), "focused")).toBe("focused 1")
      await session.act(() => {
        press(session, "go")
      })
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({
          type: "NAVIGATE",
          payload: expect.objectContaining({ name: "JobDetailScreen" }),
        }),
      ])
    } finally {
      session.unmount()
    }
  })

  it("native views are hosts that keep their props; a FlashList draws every row", async () => {
    const tree = await renderScreen(probe, screenState("data"))
    const json = JSON.stringify(tree)
    expect(json).toContain(
      '"type":"LinearGradient","props":{"colors":["#000000","#FFFFFF"],"style":{"height":4}}'
    )
    expect(json).toContain(
      '"type":"FlashList","props":{"contentContainerStyle":{"paddingTop":8}}'
    )
    expect(json).toContain('"row a"')
    expect(json).toContain('"row b"')
  })
})

describe("module state is fresh for every row (rowState)", () => {
  const rowProbe = () => require("../__fixtures__/RowStateProbe")

  it("a chat read in one row isn't read in the next", async () => {
    const reading = await renderScreen(rowProbe, {
      ...screenState("data"),
      navigation: "none",
      props: { read: true },
    })
    expect(text(reading, "unread")).toBe("unread 0")
    expect(text(reading, "registry")).toBe("registry has 6001")
    const next = await renderScreen(rowProbe, {
      ...screenState("data"),
      navigation: "none",
    })
    expect(text(next, "registry")).toBe("registry lacks 6001")
    expect(text(next, "unread")).toBe("unread 1")
  })

  it("every PER_ROW module is a new copy per row and one copy within a row", async () => {
    const copies = async () => {
      const session = await openScreen(probe, screenState("data"))
      try {
        return Object.keys(PER_ROW).map((name) => {
          const module = require(
            name.startsWith("@tappler/shared/")
              ? path.join(SRC, "..", "..", "tappler-shared", name.slice(16))
              : path.join(SRC, name)
          ) as Record<string, unknown>
          const first = Object.keys(module).map((key) => module[key])
          const again = Object.keys(module).map((key) => module[key])
          expect(again).toEqual(first)
          return first
        })
      } finally {
        session.unmount()
      }
    }
    const one = await copies()
    const two = await copies()
    Object.keys(PER_ROW).forEach((name, index) => {
      const objects = one[index].filter(
        (value) => typeof value === "object" || typeof value === "function"
      )
      expect([name, objects.length > 0]).toEqual([name, true])
      objects.forEach((value) => {
        expect([name, two[index].includes(value)]).toEqual([name, false])
      })
    })
  })

  it("setup.ts mocks exactly the PER_ROW modules", () => {
    const setup = fs.readFileSync(path.join(__dirname, "..", "setup.ts"), "utf8")
    const mocked = [...setup.matchAll(/perRow\(\s*"([^"]+)"\s*\)/g)].map(
      (match) => match[1]
    )
    const named = [...setup.matchAll(/jest\.mock\("([^"]+)", \(\) =>\s*require\("testing\/screenKit\/rowState"\)/g)].map(
      (match) => match[1]
    )
    expect(mocked.sort()).toEqual(Object.keys(PER_ROW).sort())
    expect(named.sort()).toEqual(Object.keys(PER_ROW).sort())
  })
})

describe("the device's answers, per row", () => {
  const deviceProbe = () => require("../__fixtures__/DeviceProbe")

  it("permissions granted and no location fix, unless a row says otherwise", async () => {
    const plain = await renderScreen(deviceProbe, { navigation: "none" })
    expect(text(plain, "permission")).toBe("granted")
    expect(text(plain, "push")).toBe("push 1")
    expect(text(plain, "fix")).toBe("waiting")
    const denied = await renderScreen(deviceProbe, {
      navigation: "none",
      permissions: {
        "ios.permission.LOCATION_WHEN_IN_USE": "blocked",
        notifications: "denied",
      },
      location: { latitude: 30.0444, longitude: 31.2357 },
    })
    expect(text(denied, "permission")).toBe("blocked")
    expect(text(denied, "push")).toBe("push 0")
    expect(text(denied, "fix")).toBe("30.0444,31.2357")
    const failed = await renderScreen(deviceProbe, {
      navigation: "none",
      location: { error: { code: 3, message: "timeout" } },
    })
    expect(text(failed, "fix")).toBe("error 3")
    // nothing leaks into the next row
    const again = await renderScreen(deviceProbe, { navigation: "none" })
    expect(text(again, "permission")).toBe("granted")
    expect(text(again, "push")).toBe("push 1")
    expect(text(again, "fix")).toBe("waiting")
  })

  it("fireHost calls a native view's callback as the device does", async () => {
    const session = await openScreen(deviceProbe, { navigation: "none" })
    try {
      await session.act(() => {
        fireHost(session.root, "MapView", "onRegionChangeComplete", [
          { latitude: 30.05, longitude: 31.23, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        ])
        fireHost(session.root, "LottieView", "onAnimationFinish", [false])
      })
      expect(text(session.tree(), "region")).toBe("settled 30.05")
      expect(text(session.tree(), "animation")).toBe("finished")
      expect(() =>
        fireHost(session.root, "MapView", "onPress")
      ).toThrow(/no MapView holds it/)
      // Lottie's animation JSON is named, not drawn
      expect(hosts(session.tree(), "LottieView")[0].props.source).toBe("searching")
    } finally {
      session.unmount()
    }
  })
})

describe("the sheet stand-in draws what true-sheet hands its native views", () => {
  const sheetProbe = () => require("../__fixtures__/SheetProbe")
  const sheetOf = (session: ScreenSession) =>
    hosts(session.tree(), "TrueSheet")[0]

  it("closed: the host alone, presented false; open: presented, with its content", async () => {
    const session = await openScreen(sheetProbe, { navigation: "none" })
    try {
      const closed = sheetOf(session)
      expect(closed.props).toMatchObject({
        presented: false,
        detentIndex: -1,
        cornerRadius: 40,
        backgroundColor: "#FFFFFF",
        dimmed: false,
      })
      expect(closed.children).toEqual([])
      await session.act(() => {
        press(session, "open")
      })
      const open = sheetOf(session)
      expect(open.props).toMatchObject({ presented: true, detentIndex: 0 })
      expect(JSON.stringify(open)).toContain("sheet content")
      expect(hosts(session.tree(), "TrueSheetContent")).toHaveLength(1)
      // a programmatic close reports onClosed only
      await session.act(() => {
        press(session, "close")
      })
      expect(sheetOf(session).props.presented).toBe(false)
      expect(text(session.tree(), "counts")).toBe("dismissed 0 closed 1")
    } finally {
      session.unmount()
    }
  })

  it("a customer's swipe reports onDismissed and onClosed", async () => {
    const session = await openScreen(sheetProbe, {
      navigation: "none",
      props: { open: true },
    })
    try {
      expect(sheetOf(session).props.presented).toBe(true)
      await session.act(() => {
        closeSheetAsUser(session.root)
      })
      expect(sheetOf(session).props.presented).toBe(false)
      expect(text(session.tree(), "counts")).toBe("dismissed 1 closed 1")
      expect(() => closeSheetAsUser(session.root)).toThrow(/none is presented/)
    } finally {
      session.unmount()
    }
  })

  it("a sheet prop that changes changes the tree", async () => {
    const at = (cornerRadius?: number) =>
      renderScreen(sheetProbe, {
        navigation: "none",
        props: { open: true, cornerRadius },
      })
    const round = await at()
    const square = await at(12)
    expect(square).not.toEqual(round)
    expect(JSON.stringify(square)).toContain('"cornerRadius":12')
  })
})

describe("a real screen", () => {
  const load = () =>
    require("screens/dashboardScreens/MyInformationScreen/MyInformationScreen")

  it("draws the signed-in customer's data, and the same tree every time", async () => {
    const first = await renderScreen(load, screenState("data"))
    const again = await renderScreen(load, screenState("data"))
    expect(JSON.stringify(first)).toContain("Mona")
    expect(again).toEqual(first)
  })

  it("draws Arabic on Android as its own tree", async () => {
    const iosEn = await renderScreen(load, screenState("data"))
    const androidAr = await renderScreen(load, {
      ...screenState("data"),
      lang: "ar",
      platform: "android",
    })
    expect(androidAr).not.toEqual(iosEn)
    expect(JSON.stringify(androidAr)).toMatch(/[؀-ۿ]/)
  })

  it("the act helper settles an interaction", async () => {
    const session = await openScreen(probe, screenState("data"))
    try {
      await session.act(() => undefined)
      expect(text(session.tree(), "chats")).toBe("chats 1 unread 1")
    } finally {
      session.unmount()
    }
    expect(act).toBeDefined()
  })
})

describe("React Native's Modal reports its dismissal on iOS, as the device does", () => {
  const modalProbe = () => require("../__fixtures__/ModalProbe")
  const shows = (session: ScreenSession, words: string) =>
    JSON.stringify(session.tree()).includes(words)
  const PLATFORMS: KitPlatform[] = ["ios", "android"]

  it.each(PLATFORMS)(
    "a closed Modal calls onDismiss on iOS only [%s]",
    async (platform) => {
      const session = await openScreen(modalProbe, {
        platform,
        navigation: "none",
      })
      try {
        expect(shows(session, "plain modal")).toBe(true)
        await session.act(() => {
          press(session, "close-plain")
        })
        expect(shows(session, "plain modal")).toBe(false)
        expect(text(session.tree(), "dismissed")).toBe(
          platform === "ios" ? "dismissed 1" : "dismissed 0"
        )
      } finally {
        session.unmount()
      }
    }
  )

  it.each(PLATFORMS)(
    "the next card opens once the closed one is gone, with no backstop to wait out [%s]",
    async (platform) => {
      // Past the first card's own 2 s present backstop (its onShow isn't
      // reported either), so the close starts at once.
      const session = await openScreen(modalProbe, {
        platform,
        navigation: "none",
        settleMs: 2500,
      })
      try {
        expect(shows(session, "First card")).toBe(true)
        expect(shows(session, "Second card")).toBe(false)
        // one settle (500 ms), a quarter of the close backstop
        await session.act(() => {
          press(session, "close-first")
        })
        expect(shows(session, "First card")).toBe(false)
        expect(shows(session, "Second card")).toBe(true)
      } finally {
        session.unmount()
      }
    }
  )
})

describe("session.act and a press's promise", () => {
  const saveProbe = () => require("../__fixtures__/SaveProbe")
  const save = (session: ScreenSession) =>
    session.root.findByProps({ testID: "save" }).props as {
      onPress: () => Promise<void>
    }
  const updates = (session: ScreenSession) =>
    session
      .requests()
      .filter((request) => request.endpoint === "updateCustomer")
      .map((request) => request.answer)

  it("fails at once, naming the press, when a press hands act a promise that never settles", async () => {
    // the mutation has no fixture: its request stays loading, as a save's does
    const session = await openScreen(saveProbe, {
      ...screenState("data"),
      navigation: "none",
    })
    try {
      await expect(session.act(() => save(session).onPress())).rejects.toThrow(
        /still pending after 1000 turns[^]*save\(session\)\.onPress\(\)[^]*`\(\) => \{ onPress\(\) \}`/
      )
      // braces: the press is made, its request stays in flight, the row goes on
      await session.act(() => {
        void save(session).onPress()
      })
      expect(updates(session)).toEqual(["loading", "loading"])
      expect(text(session.tree(), "saved")).toBe("not saved")
      // a label names the press instead of the function's source
      await expect(
        session.act(() => save(session).onPress(), 0, 'press "Save"')
      ).rejects.toThrow(/pending after 1000 turns[^]*: press "Save"\n/)
    } finally {
      session.unmount()
    }
  })

  it("waits for a press's promise that settles, as it always has", async () => {
    const session = await openScreen(saveProbe, {
      ...screenState("data"),
      navigation: "none",
      api: { updateCustomer: { data: CUSTOMER } },
    })
    try {
      await session.act(() => save(session).onPress())
      expect(updates(session)).toEqual(["data"])
      expect(text(session.tree(), "saved")).toBe("saved")
    } finally {
      session.unmount()
    }
  })
})
