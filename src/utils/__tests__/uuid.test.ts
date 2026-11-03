import { describe, expect, it, jest } from "@jest/globals"

import { uuidV4 } from "utils/uuid"

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("uuidV4", () => {
  it("is a version 4 UUID, different each time", () => {
    const keys = new Set(Array.from({ length: 200 }, () => uuidV4()))

    keys.forEach((key) => expect(key).toMatch(UUID_V4))
    expect(keys.size).toBe(200)
  })

  it("works without crypto.getRandomValues (Hermes)", () => {
    const { crypto } = globalThis as { crypto?: unknown }
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
      writable: true,
    })
    const random = jest.spyOn(Math, "random")
    try {
      expect(uuidV4()).toMatch(UUID_V4)
      expect(random).toHaveBeenCalled()
    } finally {
      random.mockRestore()
      Object.defineProperty(globalThis, "crypto", {
        value: crypto,
        configurable: true,
        writable: true,
      })
    }
  })
})
