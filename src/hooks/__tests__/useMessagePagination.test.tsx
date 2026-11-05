import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import React from "react"
import { Provider } from "react-redux"
import TestRenderer, { act } from "react-test-renderer"
import { configureStore } from "@reduxjs/toolkit"

/*
 * An open conversation: useChatSocket and useMessagePagination mounted
 * together, against a real RTK store and the real chatCache, with the network
 * and the socket stubbed. What it pins is what the customer sees after the
 * server, the socket or their own send changes the thread.
 */

jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => true,
}))

jest.mock("@react-native-firebase/messaging", () => ({
  __esModule: true,
  getMessaging: () => ({}),
  deleteToken: () => Promise.resolve(),
}))

// The app's store module builds the persisted store over MMKV; the hooks only
// read the typed selector from it, so the test hands them its own store.
jest.mock("store", () => ({
  useTypedSelector: require("react-redux").useSelector,
}))

jest.mock("helpers/layoutAnimation", () => ({
  scheduleLayoutAnimation: () => undefined,
}))

// Connected, so the open thread's 10 s poll is off, as in the app with a live
// socket. The handlers the hooks register are kept so a test can deliver
// socket events through them.
const mockHandlers: Record<string, Set<(payload: any) => void>> = {}
jest.mock("services/WebSocketService", () => ({
  WebSocketService: {
    on: (name: string, handler: (payload: any) => void) => {
      ;(mockHandlers[name] ??= new Set()).add(handler)
    },
    off: (name: string, handler: (payload: any) => void) => {
      mockHandlers[name]?.delete(handler)
    },
    isConnected: () => true,
    connect: () => undefined,
    disconnect: () => undefined,
  },
}))

const CHAT_ID = 7

type Msg = {
  id: number
  ownerType: "pro" | "customer"
  text: string
  createdAt: string
  readAt?: string | null
  chatId?: number
}

const at = (minute: number) => new Date(Date.UTC(2026, 10, 4, 12, minute)).toISOString()

const msg = (id: number, ownerType: Msg["ownerType"], extra: Partial<Msg> = {}): Msg => ({
  id,
  ownerType,
  text: `m${id}`,
  createdAt: at(Math.abs(id)),
  readAt: null,
  ...extra,
})

const READ_AT = at(30)

/** Each chat's first page, newest first, as the backend pages them. */
let pages: Record<number, Msg[]> = {}

beforeEach(() => {
  pages = { [CHAT_ID]: [msg(2, "customer"), msg(1, "pro")] }
  ;(global as any).fetch = jest.fn(async (input: any) => {
    const url = typeof input === "string" ? input : input.url
    const chat = Number(url.match(/\/chats\/(\d+)\/messages/)?.[1])
    const page = pages[chat] ?? []
    const body = chat
      ? { data: page, meta: { page: 1, perPage: 20, total: page.length } }
      : {}
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  })
})

let cleanup: (() => void) | undefined
afterEach(() => {
  cleanup?.()
  cleanup = undefined
})

const flush = async (rounds = 4) => {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
  }
}

const open = async () => {
  const { api } = require("services/api") as typeof import("services/api")
  const authReducer = (require("store/auth/slice") as typeof import("store/auth/slice")).default
  const auth = authReducer(undefined, { type: "@@init" })
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer, auth: authReducer },
    preloadedState: {
      auth: { ...auth, isAuth: true, token: "t", user: { ...(auth.user ?? {}), id: 1 } as any },
    },
    middleware: (gdm) =>
      gdm({ serializableCheck: false, immutableCheck: false }).concat(api.middleware),
    // RTK batches query notifications on requestAnimationFrame by default,
    // a timer that outlives the test; notify synchronously instead.
    enhancers: (gde) => gde({ autoBatch: false }),
  })
  const useMessagePagination = require("hooks/useMessagePagination").default
  const { useChatSocket } = require("hooks/useChatSocket")
  const latest: { current: any } = { current: undefined }
  const Harness = ({ chatId }: { chatId: number }) => {
    useChatSocket()
    latest.current = useMessagePagination(chatId)
    return null
  }
  let renderer: TestRenderer.ReactTestRenderer | undefined
  const draw = (chatId: number) => (
    <Provider store={store}>
      <Harness chatId={chatId} />
    </Provider>
  )
  await act(async () => {
    renderer = TestRenderer.create(draw(CHAT_ID))
  })
  await flush()
  cleanup = () => {
    act(() => renderer?.unmount())
    store.dispatch(api.util.resetApiState())
  }

  const socketEvent = async (eventName: string, body: unknown) => {
    await act(async () => {
      mockHandlers.event?.forEach((h) => h({ eventName, args: [{ body }] }))
    })
    await flush()
  }
  return {
    ids: () => latest.current.messages.map((m: Msg) => m.id),
    readAt: (id: number) =>
      latest.current.messages.find((m: Msg) => m.id === id)?.readAt ?? null,
    send: async (optimisticId: number, real?: Msg) => {
      await act(async () => {
        latest.current.addOptimisticMessage(msg(optimisticId, "customer"))
      })
      if (real) {
        await act(async () => {
          latest.current.replaceOptimisticMessage(optimisticId, real)
        })
      }
      await flush()
    },
    proReplies: (id: number) =>
      socketEvent("message.created", { ...msg(id, "pro"), chatId: CHAT_ID }),
    receipts: (batch: Partial<Msg>[]) => socketEvent("message.updatedMany", batch),
    /** The same screen handed another chat (the in-app banner does this). */
    switchTo: async (chatId: number) => {
      await act(async () => {
        renderer?.update(draw(chatId))
      })
      await flush()
    },
  }
}

describe("an open conversation", () => {
  it("shows the first page", async () => {
    const chat = await open()
    expect(chat.ids()).toEqual([2, 1])
  })

  it("keeps the customer's sent message when the pro replies", async () => {
    const chat = await open()
    await chat.send(-3, msg(3, "customer"))
    expect(chat.ids()).toEqual([3, 2, 1])

    await chat.proReplies(4)

    expect(chat.ids()).toEqual([4, 3, 2, 1])
  })

  it("keeps a send still in flight when the pro replies", async () => {
    const chat = await open()
    await chat.send(-3)

    // Not 4: chatCache remembers delivered ids module-wide (its dedup), and
    // the test above already delivered 4.
    await chat.proReplies(5)

    expect(chat.ids()).toEqual([-3, 5, 2, 1])
  })

  it("shows the pro reading a message from the first page", async () => {
    const chat = await open()
    expect(chat.readAt(2)).toBeNull()

    await chat.receipts([{ ...msg(2, "customer"), readAt: READ_AT }])

    expect(chat.readAt(2)).toBe(READ_AT)
  })

  it("shows the pro reading a message the customer just sent", async () => {
    const chat = await open()
    await chat.send(-3, msg(3, "customer"))

    await chat.receipts([
      { ...msg(2, "customer"), readAt: READ_AT },
      { ...msg(3, "customer"), readAt: READ_AT },
    ])

    expect(chat.readAt(2)).toBe(READ_AT)
    expect(chat.readAt(3)).toBe(READ_AT)
    expect(chat.ids()).toEqual([3, 2, 1])
  })

  it("ignores the echo of the customer's own mark-as-read", async () => {
    const chat = await open()

    await chat.receipts([{ ...msg(1, "pro"), readAt: READ_AT }])

    expect(chat.readAt(1)).toBeNull()
  })

  it("starts the next chat from its own page when the screen switches chats", async () => {
    pages[8] = [msg(40, "pro"), msg(39, "customer")]
    const chat = await open()
    await chat.send(-45)
    await chat.proReplies(50)
    expect(chat.ids()).toEqual([-45, 50, 2, 1])

    await chat.switchTo(8)

    expect(chat.ids()).toEqual([40, 39])
  })

  it("survives a receipt body that isn't a list", async () => {
    const chat = await open()

    await chat.receipts({ id: 2, readAt: READ_AT } as any)
    await chat.receipts([null, { id: "2" }, { id: 2 }] as any)

    expect(chat.readAt(2)).toBeNull()
    expect(chat.ids()).toEqual([2, 1])
  })
})
