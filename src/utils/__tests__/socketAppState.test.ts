import { describe, expect, it } from "@jest/globals"

import { createSocketAppStatePlanner } from "utils/socketAppState"

/*
 * The chat socket on AppState changes: disconnect on `background` only, and
 * refetch on a real return from it, never on the iOS `inactive` round trip.
 */
describe("createSocketAppStatePlanner", () => {
  it("an inactive round trip (Control Center, Face ID, a 3DS sheet) neither drops nor refetches", () => {
    const plan = createSocketAppStatePlanner()
    expect(plan("inactive")).toEqual({
      connectIfDown: false,
      refetch: false,
      disconnect: false,
    })
    expect(plan("active")).toEqual({
      connectIfDown: true,
      refetch: false,
      disconnect: false,
    })
  })

  it("the background disconnects, and coming back reconnects and refetches", () => {
    const plan = createSocketAppStatePlanner()
    expect(plan("inactive").disconnect).toBe(false)
    expect(plan("background")).toEqual({
      connectIfDown: false,
      refetch: false,
      disconnect: true,
    })
    expect(plan("active")).toEqual({
      connectIfDown: true,
      refetch: true,
      disconnect: false,
    })
  })

  it("background, then inactive on the way back, still counts as a return", () => {
    const plan = createSocketAppStatePlanner()
    plan("background")
    expect(plan("inactive").refetch).toBe(false)
    expect(plan("active").refetch).toBe(true)
  })

  it("refetches once per return", () => {
    const plan = createSocketAppStatePlanner()
    plan("background")
    expect(plan("active").refetch).toBe(true)
    plan("inactive")
    expect(plan("active").refetch).toBe(false)
  })
})
