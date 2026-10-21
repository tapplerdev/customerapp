/* eslint-disable global-require, @typescript-eslint/no-var-requires, no-restricted-syntax --
   the kit loads each render's modules in the render's platform registry,
   so screens are passed as loaders. */
import { describe, expect, it, jest } from "@jest/globals"
import fs from "fs"
import os from "os"
import path from "path"
import { act } from "react"
import ts from "typescript"

import {
  loadedPlatform,
  openScreen,
  renderScreen,
  rowsByPlatform,
  type KitPlatform,
  type ScreenSession,
} from "testing/screenKit"
import { DATA } from "testing/screenKit/fixtures/api"
import { PRO_COMPANY, signedIn } from "testing/screenKit/fixtures/users"
import { screenState } from "testing/screenKit/states"
import {
  expectParity,
  parityFlags,
  withStableShadowIds,
  type HostNode,
} from "testing/hostTreeParity"

/*
 * The screen kit itself: each switch it promises is real, checked against
 * what a screen reads (KitProbe), and a real screen draws its data.
 */

const SRC = path.resolve(__dirname, "../../..")
const probe = () => require("../__fixtures__/KitProbe")

const text = (tree: HostNode | null, testID: string): string => {
  const find = (node: HostNode | string): HostNode | undefined => {
    if (typeof node === "string") return undefined
    if (node.props.testID === testID) return node
    for (const child of node.children) {
      const found = find(child)
      if (found) return found
    }
    return undefined
  }
  const node = tree ? find(tree) : undefined
  return (node?.children ?? []).join("")
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

  it("orders a table platform by platform, so a file switches registries once", () => {
    const matrix = [
      { language: "en", platform: "ios" },
      { language: "en", platform: "android" },
    ] as const
    expect(
      rowsByPlatform([{ id: 1 }, { id: 2 }], matrix).map(
        (row) => `${row.id} ${row.env.platform}`
      )
    ).toEqual(["1 ios", "2 ios", "1 android", "2 android"])
  })
})

describe("what a render sets up", () => {
  it("the language: i18next, RTL, moment's locale and the store's", async () => {
    const en = await renderScreen(probe, screenState("data"))
    const ar = await renderScreen(probe, { ...screenState("data"), lang: "ar" })
    expect(text(en, "language")).toBe("en en ltr Leads")
    expect(text(ar, "language")).toMatch(/^ar ar rtl \S/)
    expect(text(ar, "language")).not.toContain("Leads")
    expect(text(en, "moment")).toBe("20 October")
    expect(text(ar, "moment")).toBe("٢٠ أكتوبر")
  })

  it("the Latin faces index.js registers (Poppins), and NativeWind compiling", async () => {
    const tree = await renderScreen(probe, screenState("data"))
    const face = tree?.children.find(
      (child) => typeof child !== "string" && child.children[0] === "face"
    ) as HostNode
    expect(face.props.style).toMatchObject({
      fontSize: 20,
      fontFamily: "Poppins-SemiBold",
    })
  })

  it("a frozen clock, moved only by the settle loop", async () => {
    const at = await renderScreen(probe, {
      ...screenState("data"),
      now: "2026-01-01T00:00:00.000Z",
      settleMs: 0,
    })
    expect(text(at, "clock")).toBe("2026-01-01T00:00:00.000Z")
    expect(Date.now()).not.toBe(Date.parse("2026-01-01T00:00:00.000Z"))
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
    const individual = await renderScreen(probe, screenState("data"))
    const company = await renderScreen(probe, {
      state: { auth: signedIn(PRO_COMPANY) },
    })
    expect(text(individual, "user")).toBe("Omar Hassan")
    expect(text(company, "user")).toBe(
      `${PRO_COMPANY.firstName} ${PRO_COMPANY.lastName}`
    )
  })

  it("the store is built from the same reducers as src/store/index.ts", () => {
    const file = path.join(SRC, "store", "index.ts")
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true
    )
    let keys: string[] = []
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText() === "combineReducers" &&
        node.arguments[0] &&
        ts.isObjectLiteralExpression(node.arguments[0])
      ) {
        keys = node.arguments[0].properties.map((property) => {
          const name = property.name!
          return ts.isComputedPropertyName(name)
            ? "api"
            : name.getText().replace(/"/g, "")
        })
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
    const { REDUCER_KEYS } = require("../store") as {
      REDUCER_KEYS: readonly string[]
    }
    expect([...REDUCER_KEYS].sort()).toEqual(keys.sort())
  })

  it("the backend answers by endpoint, logs every request, and leaves the rest loading", async () => {
    const session = await openScreen(probe, {
      ...screenState("data"),
      api: { getBadgeCounts: DATA.getBadgeCounts },
    })
    try {
      const tree = session.tree()
      expect(text(tree, "badges")).toBe("leads 2")
      expect(text(tree, "history")).toBe("loading")
      const requests = session.requests()
      expect(
        requests.find((r) => r.endpoint === "getBadgeCounts")
      ).toMatchObject({ answer: "data", unanswered: false })
      expect(
        requests.find((r) => r.endpoint === "getPointsHistory")
      ).toMatchObject({ answer: "loading", unanswered: true })
    } finally {
      session.unmount()
    }
  })

  it("an error answer is an error, as fetchBaseQuery would give it", async () => {
    const tree = await renderScreen(probe, {
      ...screenState("data"),
      api: { getBadgeCounts: { error: { status: 500 } } },
    })
    expect(text(tree, "badges")).toBe("error")
  })

  it("nothing reaches the network: fetch goes nowhere and is listed", async () => {
    const { networkAttempts } = require("../backend") as {
      networkAttempts: () => string[]
    }
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined)
    try {
      let settled = false
      void fetch("https://api.example.com/pros/me").then(() => {
        settled = true
      })
      await new Promise((resolve) => {
        setImmediate(resolve)
      })
      expect(settled).toBe(false)
      expect(networkAttempts()).toContain(
        "fetch https://api.example.com/pros/me"
      )
    } finally {
      warn.mockRestore()
    }
  })

  it("a real navigator: route params, focus effects, and an action it can't handle recorded", async () => {
    const session = await openScreen(probe, {
      ...screenState("data"),
      route: { name: "home", params: { userParams: { id: 1 } } },
    })
    try {
      expect(text(session.tree(), "route")).toBe('home {"userParams":{"id":1}}')
      expect(text(session.tree(), "focused")).toBe("focused 1")
      const go = session.root.findByProps({ testID: "go" })
      await session.act(() => {
        ;(go.props as { onPress: () => void }).onPress()
      })
      expect(session.navigation.actions).toEqual([
        expect.objectContaining({
          type: "NAVIGATE",
          payload: expect.objectContaining({ name: "leads" }),
        }),
      ])
    } finally {
      session.unmount()
    }
  })

  it("Paymob's stand-in has the SDK's exports, as its src/index.js writes them", () => {
    const source = fs.readFileSync(
      path.join(
        path.dirname(require.resolve("paymob-reactnative/package.json")),
        "src",
        "index.js"
      ),
      "utf8"
    )
    const block = (opening: string) => {
      const start = source.indexOf(`${opening} = {`)
      expect(start).toBeGreaterThanOrEqual(0)
      return source.slice(start, source.indexOf("\n};", start))
    }
    const methods = (opening: string) =>
      [...block(opening).matchAll(/^ {2}(\w+)\(/gm)].map((m) => m[1]).sort()
    const values = (opening: string) =>
      Object.fromEntries(
        [...block(opening).matchAll(/(\w+): '([^']*)'/g)].map((m) => [m[1], m[2]])
      )
    const stub = require("../nativeMocks").paymob() as Record<string, unknown>
    const named = [...source.matchAll(/^export const (\w+)/gm)].map((m) => m[1])
    expect(Object.keys(stub).sort()).toEqual(
      ["__esModule", "default", ...named].sort()
    )
    expect(Object.keys(stub.default as object).sort()).toEqual(
      methods("const Paymob")
    )
    expect(Object.keys(stub.PaymobCheckout as object).sort()).toEqual(
      methods("export const PaymobCheckout")
    )
    expect(stub.PaymentStatus).toEqual(values("export const PaymentStatus"))
    expect(stub.FailureCallBackVersion).toEqual(
      values("export const FailureCallBackVersion")
    )
    // the form is a native view: a host under its name
    expect(source).toContain(
      "export const PaymobCheckoutView = requireNativeComponent('PaymobCheckoutView')"
    )
  })

  it("Paymob's card form opens and takes its commands, with no override in the test", async () => {
    const session = await openScreen(
      () => require("components/PaymobCardEntrySheet/PaymobCardEntrySheet"),
      {
        navigation: "none",
        props: {
          clientSecret: "cs_test_parity",
          publicKey: "pk_test_parity",
          onClose: () => undefined,
          onSuccess: () => undefined,
          onPending: () => undefined,
        },
      }
    )
    try {
      // mounted, it was configured and keyed (configure, setPaymentKeys)
      expect(JSON.stringify(session.tree())).toContain(
        '"type":"PaymobCheckoutView"'
      )
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

describe("a real screen", () => {
  it("draws the signed-in pro's data, and the same tree every time", async () => {
    const load = () =>
      require("screens/dashboardScreens/myAccountScreens/MyAccountScreen/MyAccountScreen")
    const first = await renderScreen(load, screenState("data"))
    const again = await renderScreen(load, screenState("data"))
    expect(JSON.stringify(first)).toContain("Omar Hassan")
    expect(again).toEqual(first)
  })

  it("draws Arabic on Android as its own tree", async () => {
    const load = () =>
      require("screens/dashboardScreens/myAccountScreens/MyAccountScreen/MyAccountScreen")
    const iosEn = await renderScreen(load, screenState("data"))
    const androidAr = await renderScreen(load, {
      ...screenState("data"),
      lang: "ar",
      platform: "android",
    })
    expect(androidAr).not.toEqual(iosEn)
    expect(JSON.stringify(androidAr)).toMatch(/[؀-ۿ]/)
  })

  it("react-native-shadow-2's ids compare by appearance, not by how many Shadows mounted before", async () => {
    const load = () => require("../__fixtures__/ShadowProbe")
    const first = await renderScreen(load, { navigation: "none" })
    const again = await renderScreen(load, { navigation: "none" })
    const ids = (tree: HostNode | null) =>
      JSON.stringify(tree).match(/"(name|brushRef)":"\w+\.#?\d+"/g) ?? []
    // the library's counter ran on between the two renders
    expect(ids(first).length).toBeGreaterThan(0)
    expect(ids(again)).not.toEqual(ids(first))
    expect(withStableShadowIds(again)).toEqual(withStableShadowIds(first))
    // a fixture captured from the first render holds for the second
    const file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "kit-shadow-")),
      "shadow.json"
    )
    const saved = parityFlags.DS_PARITY_CAPTURE
    try {
      parityFlags.DS_PARITY_CAPTURE = "1"
      expectParity("shadows", first, { file })
    } finally {
      if (saved === undefined) delete parityFlags.DS_PARITY_CAPTURE
      else parityFlags.DS_PARITY_CAPTURE = saved
    }
    expectParity("shadows", again, { file })
  })

  it("the act helper settles an interaction", async () => {
    const session = await openScreen(probe, screenState("data"))
    try {
      await session.act(() => undefined)
      expect(text(session.tree(), "badges")).toBe("leads 2")
    } finally {
      session.unmount()
    }
    expect(act).toBeDefined()
  })
})

describe("React Native's Modal reports its dismissal on iOS, as the device does", () => {
  const modalProbe = () => require("../__fixtures__/ModalProbe")
  const press = (session: ScreenSession, testID: string) =>
    (session.root.findByProps({ testID }).props as { onPress: () => void })
      .onPress()
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
  const resets = (session: ScreenSession) =>
    session
      .requests()
      .filter((request) => request.endpoint === "authResetPassword")
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
      expect(resets(session)).toEqual(["loading", "loading"])
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
      api: { authResetPassword: { data: null } },
    })
    try {
      await session.act(() => save(session).onPress())
      expect(resets(session)).toEqual(["data"])
      expect(text(session.tree(), "saved")).toBe("saved")
    } finally {
      session.unmount()
    }
  })
})
