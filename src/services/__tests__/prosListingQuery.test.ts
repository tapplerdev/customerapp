import { afterEach, describe, expect, it, jest } from "@jest/globals"
import { configureStore } from "@reduxjs/toolkit"

/*
 * The pros listing request, through the real api over a fake fetch. The
 * response-time filter was removed (the owner's call, 2026-11-18): the URL
 * must never carry maxResponseTimeHours, and the filters that stay are sent.
 */

jest.mock("@react-native-firebase/messaging", () => ({
  __esModule: true,
  getMessaging: () => ({}),
  deleteToken: () => Promise.resolve(),
}))
jest.mock("config", () => ({ API_URL: "https://api.test" }))
jest.mock("store/auth/slice", () => ({
  logout: () => ({ type: "auth/logout" }),
  setTokens: (payload: unknown) => ({ type: "auth/setTokens", payload }),
}))

import { api } from "services/api"

describe("pros listing request", () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
  })

  it("sends the kept filters and no maxResponseTimeHours", async () => {
    const urls: string[] = []
    global.fetch = jest.fn(async (input: any) => {
      urls.push((input as Request).url)
      return new Response(JSON.stringify({ pros: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }) as unknown as typeof fetch
    const store = configureStore({
      reducer: {
        [api.reducerPath]: api.reducer,
        auth: () => ({ token: "t", refreshToken: "r", isAuth: true }),
      },
      middleware: (getDefault) =>
        getDefault({ serializableCheck: false, immutableCheck: false }).concat(
          api.middleware
        ),
      enhancers: (getDefault) => getDefault({ autoBatch: false }),
    })
    await store.dispatch(
      api.endpoints.getProsForCategory.initiate({
        categoryId: 7,
        proType: "company",
        minRating: 4.5,
        creditCardPayment: true,
      })
    )

    expect(urls).toHaveLength(1)
    const url = new URL(urls[0])
    expect(url.pathname).toBe("/pros/category/7")
    expect(url.searchParams.get("minRating")).toBe("4.5")
    expect(url.searchParams.get("proType")).toBe("company")
    expect(url.searchParams.get("creditCardPayment")).toBe("true")
    expect(urls[0]).not.toContain("maxResponseTimeHours")
  })
})
