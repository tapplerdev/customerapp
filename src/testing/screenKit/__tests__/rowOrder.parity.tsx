import { describe, expect, it } from "@jest/globals"

/*
 * The order a parity file's rows run in: as written under `yarn test:parity`,
 * and reversed under `yarn test:parity:reverse` (reverseEnvironment.js), in
 * every describe block, the file's top level included. Each row checks which
 * rows ran before it, so the reverse pass is proved to reverse, and the
 * normal one not to.
 */

const reversed =
  (globalThis as { __screenKitRowOrder?: string }).__screenKitRowOrder ===
  "reverse"

const ran: string[] = []

/** The rows `name` comes after, in the order this pass runs them. */
const before = (written: string[], name: string) => {
  const order = reversed ? [...written].reverse() : written
  return order.slice(0, order.indexOf(name))
}

const ROWS = ["first", "second", "third"]
const NESTED = ["inner first", "inner second"]

describe("rows", () => {
  it.each(ROWS)("%s", (name) => {
    const block = ran.filter((row) => ROWS.includes(row))
    expect(block).toEqual(before(ROWS, name))
    ran.push(name)
  })

  describe("a nested block", () => {
    it.each(NESTED)("%s", (name) => {
      const block = ran.filter((row) => NESTED.includes(row))
      expect(block).toEqual(before(NESTED, name))
      ran.push(name)
    })
  })
})

// The top level is a block too: this runs last as written, first reversed.
it("the file's top level", () => {
  expect(ran).toEqual(reversed ? [] : [...ROWS, ...NESTED])
})
