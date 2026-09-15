import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"

/*
 * The sign-out order is the whole point of services/session: backend call
 * (bounded), Firebase token delete, THEN the local sign-out — always, once.
 * Mirror of proapp's test; keep the two aligned.
 */
// Every step records itself here, so the tests assert the ORDER, not timing.
const mockOrder: string[] = []
const mockDeleteToken = jest.fn<() => Promise<void>>()
jest.mock("@react-native-firebase/messaging", () => ({
  __esModule: true,
  default: () => ({ deleteToken: mockDeleteToken }),
}))

const mockRemove = jest.fn<() => Promise<void>>()
jest.mock("services/api", () => ({
  api: {
    endpoints: {
      removeNotificationsDevice: {
        initiate: (body: unknown) => ({ type: "remove", body }),
      },
    },
    util: { resetApiState: () => ({ type: "api/resetApiState" }) },
  },
}))

const mockRegistered = { token: "tok-A" as string | null }
jest.mock("services/PushNotificationService", () => ({
  PushNotifications: { getRegisteredToken: () => mockRegistered.token },
}))

const mockDispatch = jest.fn((action: any) => {
  mockOrder.push(action?.type)

  return action?.type === "remove" ? { unwrap: () => mockRemove() } : action
})
// Lazy wrapper: the factory runs when `services/session` is first required,
// which babel hoists above these `const`s (transpiled to `var`, so they are
// undefined, not in TDZ, at that moment). Reading it at call time is safe.
const mockState = {
  auth: {
    token: "jwt" as string | undefined,
    user: { id: 7 } as { id: number } | undefined,
  },
}
jest.mock("store", () => ({
  store: {
    getState: () => mockState,
    dispatch: (action: unknown) => mockDispatch(action),
  },
}))
jest.mock("store/auth/slice", () => ({
  logout: () => ({ type: "auth/logout" }),
}))

import { signOut, REMOVE_TOKEN_TIMEOUT_MS } from "services/session"

const dispatchedTypes = () =>
  mockDispatch.mock.calls.map(([action]) => (action as any)?.type)
const LOCAL = ["auth/logout", "api/resetApiState"]

describe("signOut", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockDispatch.mockClear()
    mockRemove.mockReset()
    mockDeleteToken.mockReset()
    mockOrder.length = 0
    mockRemove.mockResolvedValue(undefined)
    mockDeleteToken.mockImplementation(async () => {
      mockOrder.push("deleteToken")
    })
    mockRegistered.token = "tok-A"
    mockState.auth.token = "jwt"
    mockState.auth.user = { id: 7 }
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it("removes the token on the backend, deletes it at Firebase, then signs out locally", async () => {
    await signOut()
    expect(mockOrder).toEqual(["remove", "deleteToken", ...LOCAL])
    expect((mockDispatch.mock.calls[0][0] as any).body).toEqual({
      registrationToken: "tok-A",
    })
  })

  it("gives the backend call a bounded wait when the phone is offline", async () => {
    mockRemove.mockReturnValue(
      new Promise(() => {
        // never settles: the phone is offline
      })
    )
    const done = signOut()
    await jest.advanceTimersByTimeAsync(REMOVE_TOKEN_TIMEOUT_MS - 1)
    expect(dispatchedTypes()).toEqual(["remove"])
    await jest.advanceTimersByTimeAsync(2)
    await done
    expect(mockOrder).toEqual(["remove", "deleteToken", ...LOCAL])
  })

  it("gives Firebase's delete the same bound", async () => {
    mockDeleteToken.mockImplementation(
      () =>
        new Promise(() => {
          // never settles: black-holed network, Firebase's own timeout is 60 s
        })
    )
    const done = signOut()
    await jest.advanceTimersByTimeAsync(REMOVE_TOKEN_TIMEOUT_MS - 1)
    expect(dispatchedTypes()).toEqual(["remove"])
    await jest.advanceTimersByTimeAsync(2)
    await done
    expect(dispatchedTypes()).toEqual(["remove", ...LOCAL])
  })

  it("still signs out when the backend call and Firebase both fail", async () => {
    mockRemove.mockRejectedValue(new Error("401"))
    mockDeleteToken.mockRejectedValue(new Error("no network"))
    await signOut()
    expect(dispatchedTypes()).toEqual(["remove", ...LOCAL])
  })

  it("skips the backend call when no token was registered this session", async () => {
    mockRegistered.token = null
    await signOut()
    expect(mockOrder).toEqual(["deleteToken", ...LOCAL])
  })

  it("skips the backend call when there is no session to speak for", async () => {
    mockState.auth.token = undefined
    await signOut()
    expect(mockOrder).toEqual(["deleteToken", ...LOCAL])
  })

  it("leaves a different account alone if one signed in mid-flight", async () => {
    mockRemove.mockImplementation(async () => {
      mockState.auth.user = { id: 8 }
    })
    await signOut()
    expect(mockOrder).toEqual(["remove", "deleteToken"])
  })

  it("runs once when called twice before the first finishes, then again", async () => {
    await Promise.all([signOut(), signOut()])
    expect(dispatchedTypes()).toEqual(["remove", ...LOCAL])
    await signOut()
    expect(dispatchedTypes()).toEqual(["remove", ...LOCAL, "remove", ...LOCAL])
  })
})
