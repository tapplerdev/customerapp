import { describe, expect, it } from "@jest/globals"

import { chatBlockCodeOf } from "utils/chatBlockCode"

describe("chatBlockCodeOf", () => {
  it("reads the top-level code of the new contract", () => {
    expect(
      chatBlockCodeOf({
        status: 400,
        data: {
          statusCode: 400,
          message: "That message can't be sent.",
          code: "CHAT_BLOCK_PROFANITY",
        },
      })
    ).toBe("CHAT_BLOCK_PROFANITY")
  })

  it("reads validationErrors.text[0] of today's contract", () => {
    expect(
      chatBlockCodeOf({
        status: 400,
        data: { validationErrors: { text: ["CHAT_BLOCK_CONTACT_INFO"] } },
      })
    ).toBe("CHAT_BLOCK_CONTACT_INFO")
  })

  it("prefers the new place when both are present", () => {
    expect(
      chatBlockCodeOf({
        data: {
          code: "CHAT_BLOCK_UNVERIFIED",
          validationErrors: { text: ["CHAT_BLOCK_PROFANITY"] },
        },
      })
    ).toBe("CHAT_BLOCK_UNVERIFIED")
  })

  it("ignores codes that are not chat blocks", () => {
    expect(chatBlockCodeOf({ data: { code: "RATE_LIMITED" } })).toBeUndefined()
    expect(
      chatBlockCodeOf({ data: { validationErrors: { text: ["too long"] } } })
    ).toBeUndefined()
  })

  it("does not throw on a body without validationErrors or on no body", () => {
    expect(chatBlockCodeOf({ status: 429, data: { message: "Slow" } })).toBe(
      undefined
    )
    expect(chatBlockCodeOf({ status: "FETCH_ERROR" })).toBeUndefined()
    expect(chatBlockCodeOf({ data: null })).toBeUndefined()
    expect(chatBlockCodeOf(undefined)).toBeUndefined()
    expect(chatBlockCodeOf(new Error("boom"))).toBeUndefined()
  })
})
