import { describe, expect, it, jest } from "@jest/globals"

// The slice reads only the endpoints' matchers off the api; the real module
// pulls in react-redux's ESM, which this config doesn't transform.
jest.mock("services/api", () => {
  const never = { matchFulfilled: () => false }
  return {
    api: {
      endpoints: { auth: never, getCustomerMe: never, updateCustomer: never },
    },
  }
})

import reducer, { logout, setIsAuth, setTokens } from "store/auth/slice"

/*
 * setTokens after a sign-out: a token refresh in flight when the customer
 * signed out answers after logout() and must not bring back the pair
 * POST /auth/logout just revoked.
 */
const PAIR = { token: "t-2", refreshToken: "r-2" }

describe("setTokens", () => {
  it("stores the pair while signed in", () => {
    const signedIn = reducer(undefined, setIsAuth(true))
    const after = reducer(signedIn, setTokens(PAIR))
    expect(after.token).toBe("t-2")
    expect(after.refreshToken).toBe("r-2")
  })

  it("is ignored once signed out (a refresh landing after logout)", () => {
    const signedIn = reducer(
      reducer(undefined, setIsAuth(true)),
      setTokens({ token: "t-1", refreshToken: "r-1" })
    )
    const signedOut = reducer(signedIn, logout())
    const after = reducer(signedOut, setTokens(PAIR))
    expect(after.isAuth).toBe(false)
    expect(after.token).toBeUndefined()
    expect(after.refreshToken).toBeUndefined()
  })
})
