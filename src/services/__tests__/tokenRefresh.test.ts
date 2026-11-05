import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { configureStore } from "@reduxjs/toolkit"

/*
 * The 401 path of the REAL base query, in a store with the real api reducer
 * and middleware, over a fake fetch. Pins the refresh (POST /auth/refresh,
 * the token in the body), that only a definitive refusal signs out, and the
 * account-switch guard: a 401 that comes back after the customer signed out,
 * or after another account signed in, is handed back without a refresh, so
 * account A's late answer can neither replay A's request as B nor sign B out.
 * Also that a release build logs nothing.
 */

jest.mock("@react-native-firebase/messaging", () => ({
  __esModule: true,
  getMessaging: () => ({}),
  deleteToken: () => Promise.resolve(),
}))
jest.mock("config", () => ({ API_URL: "https://api.test" }))
// The auth slice persists over MMKV; the base query only needs its action
// creators, and the test's own auth reducer below applies them.
jest.mock("store/auth/slice", () => ({
  logout: () => ({ type: "auth/logout" }),
  setTokens: (payload: unknown) => ({ type: "auth/setTokens", payload }),
}))

/* eslint-disable import/first */
import { api } from "services/api"
/* eslint-enable import/first */

type Auth = {
  token?: string
  refreshToken?: string
  isAuth: boolean
  user?: { id: number }
}

const ACCOUNT_A: Auth = {
  token: "access-1",
  refreshToken: "refresh-1",
  isAuth: true,
  user: { id: 1 },
}

const ACCOUNT_B: Auth = {
  token: "access-B",
  refreshToken: "refresh-B",
  isAuth: true,
  user: { id: 2 },
}

type Seen = { url: string; method: string; authorization: string | null; body: string }

const tick = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

/** A promise and the function that settles it. */
const deferred = <T,>() => {
  let settle!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

describe("token refresh (the real base query)", () => {
  const realFetch = global.fetch
  let seen: Seen[] = []
  let actions: string[] = []
  // What the refresh call answers; set per test.
  let refreshAnswer: () => Promise<Response>
  // What the profile answers; by default 401 to access-1 only.
  let profileAnswer: (authorization: string | null) => Promise<Response>

  const makeStore = (initial: Auth = ACCOUNT_A) =>
    configureStore({
      reducer: {
        [api.reducerPath]: api.reducer,
        auth: (state: Auth | undefined, action: any): Auth => {
          if (!state) return initial
          if (action.type === "auth/setTokens") {
            return {
              ...state,
              token: action.payload.token,
              refreshToken: action.payload.refreshToken,
            }
          }
          if (action.type === "auth/logout") return { isAuth: false }
          if (action.type === "test/signIn") return action.payload
          return state
        },
      },
      middleware: (getDefault) =>
        getDefault({ serializableCheck: false, immutableCheck: false })
          .prepend(
            () => (next: (action: unknown) => unknown) => (action: any) => {
              if (action?.type?.startsWith("auth/")) actions.push(action.type)
              // Recorded and stopped: the real one aborts the request still in
              // flight, which jest's AbortSignal and Node's Request disagree
              // on. What is pinned is that a sign-out asks for it.
              if (api.util.resetApiState.match(action)) {
                actions.push(action.type)
                return action
              }
              return next(action)
            }
          )
          .concat(api.middleware),
      enhancers: (getDefault) => getDefault({ autoBatch: false }),
    })

  const refreshCalls = () => seen.filter((entry) => entry.url.endsWith("/auth/refresh"))

  beforeEach(() => {
    seen = []
    actions = []
    refreshAnswer = async () => json(200, { token: "access-2", refreshToken: "refresh-2" })
    profileAnswer = async (authorization) =>
      authorization === "Bearer access-1"
        ? json(401, { message: "Unauthorized" })
        : json(200, { id: 1 })
    global.fetch = jest.fn(async (input: any) => {
      const request = input as Request
      const entry: Seen = {
        url: request.url,
        method: request.method,
        authorization: request.headers.get("Authorization"),
        body: request.method === "GET" ? "" : await request.text(),
      }
      seen.push(entry)
      if (entry.url.endsWith("/auth/refresh")) return refreshAnswer()
      return profileAnswer(entry.authorization)
    }) as unknown as typeof fetch
  })
  afterEach(() => {
    global.fetch = realFetch
  })

  it("refreshes with POST and the token in the body, stores both new tokens, and retries", async () => {
    const store = makeStore()
    const result = await store.dispatch(api.endpoints.getCustomerMe.initiate(undefined))

    expect(result.data).toEqual({ id: 1 })
    expect(refreshCalls()).toEqual([
      {
        url: "https://api.test/auth/refresh",
        method: "POST",
        authorization: "Bearer access-1",
        body: JSON.stringify({ refreshToken: "refresh-1" }),
      },
    ])
    expect((store.getState() as any).auth).toMatchObject({
      token: "access-2",
      refreshToken: "refresh-2",
    })
    expect(seen[seen.length - 1].authorization).toBe("Bearer access-2")
    expect(actions).not.toContain("auth/logout")
  })

  it.each([401, 403, 404])("signs out when the refresh is refused with %s", async (status) => {
    refreshAnswer = async () => json(status, { message: "Specified refresh token not found!" })
    const store = makeStore()
    await store.dispatch(api.endpoints.getCustomerMe.initiate(undefined))

    expect(actions).toEqual(
      expect.arrayContaining(["auth/logout", api.util.resetApiState().type])
    )
  })

  it("keeps the session when the refresh fails for any other reason", async () => {
    refreshAnswer = async () => json(500, { message: "boom" })
    const store = makeStore()
    await store.dispatch(api.endpoints.getCustomerMe.initiate(undefined))

    expect(actions).not.toContain("auth/logout")
    expect((store.getState() as any).auth).toEqual(ACCOUNT_A)
  })

  it("hands back A's late 401 after B signed in: no refresh, no replay as B", async () => {
    const answer = deferred<Response>()
    profileAnswer = () => answer.promise
    const store = makeStore()
    const pending = store.dispatch(api.endpoints.getCustomerMe.initiate(undefined))
    await tick()

    store.dispatch({ type: "test/signIn", payload: ACCOUNT_B })
    answer.settle(json(401, { message: "Unauthorized" }))
    const result = await pending

    expect((result.error as any)?.status).toBe(401)
    expect(refreshCalls()).toEqual([])
    expect(seen.map((entry) => entry.authorization)).toEqual(["Bearer access-1"])
    expect(actions).not.toContain("auth/logout")
    expect((store.getState() as any).auth).toEqual(ACCOUNT_B)
  })

  it("hands back a 401 that lands after sign-out, without a refresh", async () => {
    const answer = deferred<Response>()
    profileAnswer = () => answer.promise
    const store = makeStore()
    const pending = store.dispatch(api.endpoints.getCustomerMe.initiate(undefined))
    await tick()

    store.dispatch({ type: "test/signIn", payload: { isAuth: false } })
    answer.settle(json(401, { message: "Unauthorized" }))
    await pending

    expect(refreshCalls()).toEqual([])
    expect(actions).not.toContain("auth/logout")
  })

  it("retries without a second refresh when the token was already refreshed meanwhile", async () => {
    const answer = deferred<Response>()
    let first = true
    profileAnswer = async (authorization) => {
      if (first) {
        first = false
        return answer.promise
      }
      return authorization === "Bearer access-1"
        ? json(401, { message: "Unauthorized" })
        : json(200, { id: 1 })
    }
    const store = makeStore()
    const pending = store.dispatch(api.endpoints.getCustomerMe.initiate(undefined))
    await tick()

    // Another request refreshed for the same account while this one was out.
    store.dispatch({ type: "auth/setTokens", payload: { token: "access-2", refreshToken: "refresh-2" } })
    answer.settle(json(401, { message: "Unauthorized" }))
    const result = await pending

    expect(result.data).toEqual({ id: 1 })
    expect(refreshCalls()).toEqual([])
    expect(seen[seen.length - 1].authorization).toBe("Bearer access-2")
  })

  it("keeps B's session when A's refresh is refused after B signed in", async () => {
    const refresh = deferred<Response>()
    refreshAnswer = () => refresh.promise
    const store = makeStore()
    const pending = store.dispatch(api.endpoints.getCustomerMe.initiate(undefined))
    for (let i = 0; i < 4 && refreshCalls().length === 0; i++) await tick()
    expect(refreshCalls()).toHaveLength(1)

    store.dispatch({ type: "test/signIn", payload: ACCOUNT_B })
    refresh.settle(json(404, { message: "Specified refresh token not found!" }))
    await pending

    expect(actions).not.toContain("auth/logout")
    expect((store.getState() as any).auth).toEqual(ACCOUNT_B)
  })

  it("doesn't store A's refreshed tokens over B's", async () => {
    const refresh = deferred<Response>()
    refreshAnswer = () => refresh.promise
    const store = makeStore()
    const pending = store.dispatch(api.endpoints.getCustomerMe.initiate(undefined))
    for (let i = 0; i < 4 && refreshCalls().length === 0; i++) await tick()

    store.dispatch({ type: "test/signIn", payload: ACCOUNT_B })
    refresh.settle(json(200, { token: "access-2", refreshToken: "refresh-2" }))
    await pending

    expect((store.getState() as any).auth).toEqual(ACCOUNT_B)
    expect(seen.filter((entry) => entry.authorization === "Bearer access-B")).toEqual([])
  })

  describe("in a release build", () => {
    const g = global as unknown as { __DEV__: boolean }
    const wasDev = g.__DEV__
    afterEach(() => {
      g.__DEV__ = wasDev
    })

    it("logs no request, response or auth state", async () => {
      g.__DEV__ = false
      const log = jest.spyOn(console, "log").mockImplementation(() => undefined)
      try {
        const store = makeStore()
        await store.dispatch(api.endpoints.getCustomerMe.initiate(undefined))
        expect(log).not.toHaveBeenCalled()
      } finally {
        log.mockRestore()
      }
    })
  })
})
