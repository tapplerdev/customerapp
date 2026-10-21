import { describe, expect, it, jest } from "@jest/globals"
import fs from "fs"
import path from "path"

/*
 * `@env` under jest is the stub jest.config.js sets, never the worktree's
 * .env: react-native-dotenv inlines it at transform time, so a test's answer
 * (a HERE URL keyed by its query, the API base) would otherwise depend on the
 * .env of whichever worktree filled the transform cache. Checked through the
 * app's own readers of it, as they were transformed for this run. Failures
 * print no value read from .env.
 */

import { API_URL } from "config"
import { searchAddressByPosition } from "services/here-maps-api"

const ROOT = path.resolve(__dirname, "../../..")
const STUB = (globalThis as Record<string, unknown>).__PARITY_ENV_STUB__ as
  | Record<string, string>
  | undefined

describe("@env is stubbed in jest", () => {
  it("stubs every key src/types/env.d.ts declares", () => {
    const declared = [
      ...fs
        .readFileSync(path.join(ROOT, "src/types/env.d.ts"), "utf8")
        .matchAll(/export const (\w+):/g),
    ].map((match) => match[1])
    expect(declared.length).toBeGreaterThan(0)
    expect(Object.keys(STUB ?? {}).sort()).toEqual([...declared].sort())
  })

  it("config.ts reads the stub's API_URL", () => {
    expect(API_URL).toBe(STUB?.API_URL)
  })

  it("HERE's requests carry the stub's key", async () => {
    const urls: string[] = []
    const scope = globalThis as { fetch?: unknown }
    const saved = scope.fetch
    scope.fetch = jest.fn(async (url: string) => {
      urls.push(url)
      return { json: async () => ({ items: [] }) }
    })
    try {
      await searchAddressByPosition({ lat: 30.0444, lng: 31.2357 })
    } finally {
      scope.fetch = saved
    }
    expect(urls).toHaveLength(1)
    const key = new URL(urls[0]).searchParams.get("apiKey")
    expect(key === STUB?.HERE_MAPS_API_KEY).toBe(true)
  })
})
