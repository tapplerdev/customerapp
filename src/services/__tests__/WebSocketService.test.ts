import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"

/*
 * The socket's reconnect fixes: every connect attempt presents the token as
 * it is now (an auth callback, not an object captured at connect), a
 * server-side disconnect is reconnected after a backoff instead of never,
 * and a connect while a socket is still down replaces it rather than adding
 * a second one.
 */

type Handler = (...args: unknown[]) => void

class MockSocket {
  connected = false

  handlers = new Map<string, Handler[]>()

  managerHandlers = new Map<string, Handler[]>()

  connect = jest.fn(() => this)

  disconnect = jest.fn(() => {
    this.connected = false
    return this
  })

  removeAllListeners = jest.fn()

  onAny = jest.fn()

  io = {
    on: (event: string, handler: Handler) => {
      this.managerHandlers.set(event, [
        ...(this.managerHandlers.get(event) ?? []),
        handler,
      ])
    },
    engine: { transport: { name: "websocket" } },
    opts: {},
    uri: "wss://example.test",
  }

  opts: { auth: (cb: (data: unknown) => void) => void }

  constructor(opts: { auth: (cb: (data: unknown) => void) => void }) {
    this.opts = opts
  }

  on(event: string, handler: Handler) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
    return this
  }

  fire(event: string, ...args: unknown[]) {
    ;(this.handlers.get(event) ?? []).forEach((handler) => handler(...args))
  }

  /** What the auth callback hands socket.io for this attempt. */
  authPayload() {
    let payload: unknown
    this.opts.auth((data) => {
      payload = data
    })
    return payload
  }
}

const mockSockets: MockSocket[] = []

jest.mock("socket.io-client", () => ({
  io: (_url: string, opts: ConstructorParameters<typeof MockSocket>[0]) => {
    const socket = new MockSocket(opts)
    mockSockets.push(socket)
    return socket
  },
}))
jest.mock("../../config", () => ({ API_URL: "https://example.test/api" }))

import { WebSocketService } from "services/WebSocketService"

describe("WebSocketService", () => {
  beforeEach(() => {
    mockSockets.length = 0
    jest.useFakeTimers()
    jest.spyOn(console, "log").mockImplementation(() => undefined)
    jest.spyOn(console, "error").mockImplementation(() => undefined)
    jest.spyOn(Math, "random").mockReturnValue(0)
  })
  afterEach(() => {
    WebSocketService.disconnect()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("presents the current token on each attempt, not the one it connected with", () => {
    let token = "first"
    WebSocketService.connect({
      token: "first",
      getToken: () => token,
      userId: 1,
    })
    const socket = mockSockets[0]

    expect(socket.authPayload()).toEqual({ token: "Bearer first" })
    // A refresh happened during an outage: the manager's reconnect reads it.
    token = "refreshed"
    expect(socket.authPayload()).toEqual({ token: "Bearer refreshed" })
  })

  it("uses the token it was given only without a getter", () => {
    WebSocketService.connect({ token: "Bearer given", userId: 1 })
    expect(mockSockets[0].authPayload()).toEqual({ token: "Bearer given" })
  })

  it("never presents the old token once the store has none (a logout)", () => {
    let token: string | undefined = "live"
    WebSocketService.connect({
      token: "live",
      getToken: () => token,
      userId: 1,
    })
    token = undefined

    expect(mockSockets[0].authPayload()).toEqual({})
  })

  it("a disconnect() cancels reconnect()'s delayed connect", () => {
    WebSocketService.connect({ token: "t", userId: 1 })
    WebSocketService.reconnect()
    expect(mockSockets).toHaveLength(1)

    WebSocketService.disconnect()
    jest.advanceTimersByTime(5_000)

    expect(mockSockets).toHaveLength(1)
  })

  it("reconnect() connects again after its delay when nothing cancels it", () => {
    WebSocketService.connect({ token: "t", userId: 1 })
    WebSocketService.reconnect()
    jest.advanceTimersByTime(500)

    expect(mockSockets).toHaveLength(2)
  })

  it("reconnects after a server disconnect, after a backoff", () => {
    WebSocketService.connect({ token: "t", userId: 1 })
    const socket = mockSockets[0]
    socket.connected = true
    socket.fire("connect")
    socket.connected = false

    socket.fire("disconnect", "io server disconnect")
    expect(socket.connect).not.toHaveBeenCalled()

    jest.advanceTimersByTime(999)
    expect(socket.connect).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(socket.connect).toHaveBeenCalledTimes(1)
  })

  it("backs off further when the server keeps kicking it right after a connect", () => {
    WebSocketService.connect({ token: "t", userId: 1 })
    const socket = mockSockets[0]
    const kick = () => {
      socket.connected = true
      socket.fire("connect")
      socket.connected = false
      socket.fire("disconnect", "io server disconnect")
    }

    kick()
    jest.advanceTimersByTime(1000)
    expect(socket.connect).toHaveBeenCalledTimes(1)

    kick()
    jest.advanceTimersByTime(1999)
    expect(socket.connect).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(1)
    expect(socket.connect).toHaveBeenCalledTimes(2)
  })

  it("a disconnect() cancels a pending server-disconnect retry", () => {
    WebSocketService.connect({ token: "t", userId: 1 })
    const socket = mockSockets[0]
    socket.fire("disconnect", "io server disconnect")

    WebSocketService.disconnect()
    jest.advanceTimersByTime(120_000)

    expect(socket.connect).not.toHaveBeenCalled()
  })

  it("network drops are left to socket.io's own reconnection", () => {
    WebSocketService.connect({ token: "t", userId: 1 })
    const socket = mockSockets[0]

    socket.fire("disconnect", "transport close")
    jest.advanceTimersByTime(120_000)

    expect(socket.connect).not.toHaveBeenCalled()
  })

  it("a connect while the socket is down replaces it instead of adding a second", () => {
    WebSocketService.connect({ token: "t", userId: 1 })
    const first = mockSockets[0]
    first.fire("disconnect", "transport close")

    WebSocketService.connect({ token: "t2", userId: 1 })

    expect(mockSockets).toHaveLength(2)
    expect(first.removeAllListeners).toHaveBeenCalled()
    expect(first.disconnect).toHaveBeenCalled()
  })
})
