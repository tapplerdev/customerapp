/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads the app in each render's registry, so App is a loader. */
import { describe, expect, it } from "@jest/globals"

import { networkAttempts, openScreen, type ScreenSession } from "testing/screenKit"
import { DATA } from "testing/screenKit/fixtures/api"
import {
  freshInstallState,
  guestState,
  screenState,
} from "testing/screenKit/states"
import type { HostNode } from "testing/hostTreeParity"

/*
 * The app's root, as index.js registers it, booting in the jest kit: the
 * store, the persist gate, the realtime manager (socket and push), the
 * navigator and BootstrapScreen's effects, on each persona's first screen.
 * It replaces React Native's template test, which rendered <App /> with no
 * native module mocked and never got past React Navigation's ESM. It runs
 * under the kit's config (`yarn test:parity`) because App reaches every
 * native module the kit stands in for.
 */

const load = () => require("../src/App")

const json = (session: ScreenSession) => JSON.stringify(session.tree())

/** The native stack's screens, by route name (their screenId, trimmed by the normaliser). */
const stackScreens = (tree: HostNode | null): string[] => {
  const out: string[] = []
  const visit = (node: HostNode | string) => {
    if (typeof node === "string") return
    if (node.type === "RNSScreen" && typeof node.props.screenId === "string") {
      out.push(node.props.screenId)
    }
    node.children.forEach(visit)
  }
  if (tree) visit(tree)
  return out
}

const open = (options: Parameters<typeof openScreen>[1]) =>
  openScreen(load, { ...options, navigation: "none", settleMs: 1500 })

describe("the app boots on each persona's first screen", () => {
  it("a fresh install: the language picker, and nothing asked of the backend", async () => {
    const session = await open(freshInstallState())
    try {
      expect(json(session)).toContain("Please Select Your Language")
      expect(stackScreens(session.tree())).toEqual([
        expect.stringMatching(/^WelcomeScreen/),
      ])
      expect(session.requests()).toEqual([])
      expect(networkAttempts()).toEqual([])
    } finally {
      session.unmount()
    }
  })

  it("a guest with a location: Home, from anonymous requests only", async () => {
    const session = await open(guestState("data"))
    try {
      expect(stackScreens(session.tree())).toEqual([
        expect.stringMatching(/^HomeTabs/),
      ])
      expect(json(session)).toContain("Popular services")
      const endpoints = session.requests().map((r) => r.endpoint)
      expect(endpoints).toContain("getActivePreset")
      // signed out: no account, no chats, no push registration
      expect(endpoints).not.toContain("getCustomerMe")
      expect(endpoints).not.toContain("getChats")
      expect(endpoints).not.toContain("registerNotificationsDevice")
      expect(networkAttempts()).toEqual([])
    } finally {
      session.unmount()
    }
  })

  it("a signed-in customer: Home, the account asked for, no language PATCH when the server agrees", async () => {
    const session = await open(screenState("data"))
    try {
      expect(stackScreens(session.tree())).toEqual([
        expect.stringMatching(/^HomeTabs/),
      ])
      expect(json(session)).toContain("Popular services")
      const endpoints = session.requests().map((r) => r.endpoint)
      expect(endpoints).toContain("getCustomerMe")
      expect(endpoints).toContain("getChats")
      // CUSTOMER.preferredLanguage is "en", the app's too
      expect(endpoints).not.toContain("updateCustomer")
      expect(networkAttempts()).toEqual([])
    } finally {
      session.unmount()
    }
  })

  // BootstrapScreen.tsx:49-60: the server's language differs, so the boot
  // PATCHes it (the device rig's proxy answers that PATCH with a 503).
  it("a signed-in customer in Arabic: the boot PATCHes preferredLanguage, and the app draws on", async () => {
    const session = await open({
      ...screenState("data"),
      lang: "ar",
      api: { ...DATA, updateCustomer: { error: { status: 503 } } },
    })
    try {
      expect(stackScreens(session.tree())).toEqual([
        expect.stringMatching(/^HomeTabs/),
      ])
      const patches = session
        .requests()
        .filter((r) => r.endpoint === "updateCustomer")
      expect(patches).toHaveLength(1)
      expect(patches[0].args).toMatchObject({
        method: "PATCH",
        body: { preferredLanguage: "ar" },
      })
      expect(json(session)).toContain("الخدمات الشائعة")
    } finally {
      session.unmount()
    }
  })
})
