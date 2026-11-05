import { describe, expect, it, jest } from "@jest/globals"

import i18n from "locales/i18n"
import {
  describeSignInFailure,
  isServerFailure,
  isTooManyAttempts,
  isUnreachable,
  retryAfterMinutes,
  withRetryAfter,
} from "utils/authErrors"

/*
 * The sign-in and sign-up failures that are not about what was typed. The
 * 429 is backend #413's: { message, validationErrors: { email: [message] } }
 * with Retry-After in seconds. It must never read as "check your
 * credentials", and it is told in the app's language, since the server's
 * message is English only. Read through the app's real i18n setup, so a
 * missing key or plural form would show up as the key echoed back.
 */
jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

const en = i18n.getFixedT("en")
const ar = i18n.getFixedT("ar")

const RATE_LIMITED = {
  status: 429,
  data: {
    message: "Too many attempts. Please try again in 15 minutes.",
    validationErrors: {
      email: ["Too many attempts. Please try again in 15 minutes."],
    },
  },
}

const metaWith = (headers: Record<string, string>) => ({
  response: {
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  },
})

describe("withRetryAfter", () => {
  it("copies a 429's Retry-After seconds onto the error", () => {
    expect(
      withRetryAfter(RATE_LIMITED, metaWith({ "retry-after": "840" }))
    ).toEqual({ ...RATE_LIMITED, retryAfterSeconds: 840 })
  })

  it("leaves a 429 without a usable header, and any other error, alone", () => {
    expect(withRetryAfter(RATE_LIMITED, metaWith({}))).toBe(RATE_LIMITED)
    expect(
      withRetryAfter(RATE_LIMITED, metaWith({ "retry-after": "soon" }))
    ).toBe(RATE_LIMITED)
    const refused = { status: 400, data: {} }
    expect(withRetryAfter(refused, metaWith({ "retry-after": "60" }))).toBe(
      refused
    )
  })
})

describe("the error kinds", () => {
  it("tells a 429, a 5xx (or a gateway's page) and no answer apart", () => {
    expect(isTooManyAttempts(RATE_LIMITED)).toBe(true)
    expect(isServerFailure({ status: 502 })).toBe(true)
    expect(
      isServerFailure({ status: "PARSING_ERROR", originalStatus: 503 })
    ).toBe(true)
    expect(isServerFailure({ status: 400 })).toBe(false)
    expect(isUnreachable({ status: "FETCH_ERROR" })).toBe(true)
    expect(isUnreachable({ status: "TIMEOUT_ERROR" })).toBe(true)
    expect(isUnreachable({ status: 500 })).toBe(false)
  })

  it("rounds the wait up to whole minutes", () => {
    expect(retryAfterMinutes({ retryAfterSeconds: 840 })).toBe(14)
    expect(retryAfterMinutes({ retryAfterSeconds: 841 })).toBe(15)
    expect(retryAfterMinutes({ retryAfterSeconds: 5 })).toBe(1)
    expect(retryAfterMinutes({})).toBeUndefined()
  })
})

describe("describeSignInFailure", () => {
  it("a 429 with its wait, in both languages, with the Arabic plurals", () => {
    const wait = (minutes: number) => ({
      ...RATE_LIMITED,
      retryAfterSeconds: minutes * 60,
    })
    expect(describeSignInFailure(wait(15), en)).toBe(
      "Too many attempts. Please try again in 15 minutes."
    )
    expect(describeSignInFailure(wait(1), en)).toBe(
      "Too many attempts. Please try again in 1 minute."
    )
    expect(describeSignInFailure(wait(1), ar)).toBe(
      "محاولات كثيرة جدًا. يرجى المحاولة مرة أخرى بعد دقيقة واحدة."
    )
    expect(describeSignInFailure(wait(2), ar)).toBe(
      "محاولات كثيرة جدًا. يرجى المحاولة مرة أخرى بعد دقيقتين."
    )
    expect(describeSignInFailure(wait(5), ar)).toBe(
      "محاولات كثيرة جدًا. يرجى المحاولة مرة أخرى بعد 5 دقائق."
    )
    expect(describeSignInFailure(wait(15), ar)).toBe(
      "محاولات كثيرة جدًا. يرجى المحاولة مرة أخرى بعد 15 دقيقة."
    )
  })

  it("a 429 without Retry-After says try again later", () => {
    expect(describeSignInFailure(RATE_LIMITED, en)).toBe(
      "Too many attempts. Please try again later."
    )
    expect(describeSignInFailure(RATE_LIMITED, ar)).toBe(
      "محاولات كثيرة جدًا. يرجى المحاولة مرة أخرى لاحقًا."
    )
  })

  it("a 5xx says Tappler is having trouble; no answer says so", () => {
    expect(describeSignInFailure({ status: 500, data: {} }, en)).toBe(
      "Tappler is having trouble right now. Please try again in a moment."
    )
    expect(describeSignInFailure({ status: 503 }, ar)).toBe(
      "يواجه تابلر مشكلة حاليًا. يرجى المحاولة مرة أخرى بعد قليل."
    )
    expect(describeSignInFailure({ status: "FETCH_ERROR" }, en)).toBe(
      "No internet connection"
    )
  })

  it("a refusal about what was typed is left to the caller", () => {
    expect(
      describeSignInFailure(
        {
          status: 400,
          data: {
            validationErrors: { password: ["Password does not match!"] },
          },
        },
        en
      )
    ).toBeUndefined()
  })
})
