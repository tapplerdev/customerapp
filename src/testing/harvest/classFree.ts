/**
 * Jest only. The check a harvest test of a component that takes no class
 * makes before it compares anything: its cases hand the component no class
 * string, and no element built inside them is a DmText or an ActionBtn.
 *
 * Its fixture was captured with NativeWind on. A class in a case drew then
 * and draws nothing once NativeWind is gone, and DmText and ActionBtn draw
 * their looks through it; either would make the comparison meaningless (or
 * pass for the wrong reason). A component whose cases do hand it a class
 * is proven by its frozen twins instead (frozenTwins).
 */
import { expect } from "@jest/globals"

import type { HarvestedCase, SpecValue } from "./harvest"

/** A prop that carries class names, NativeWind's `tw` included. */
const CLASS_PROP = /^className|ClassName$|^tw$/

const NATIVEWIND_ONLY = new Set(["DmText", "ActionBtn"])

/** Every class string and every DmText or ActionBtn the cases hold, by case and path. */
export const classesIn = (cases: Record<string, HarvestedCase>): string[] => {
  const out: string[] = []
  const visit = (value: SpecValue, where: string, key: string) => {
    if (typeof value === "string") {
      if (CLASS_PROP.test(key) && value.trim()) out.push(`${where}: "${value}"`)
      return
    }
    if (!value || typeof value !== "object") return
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${where}[${index}]`, key))
      return
    }
    if ("$el" in value && typeof value.$el === "string") {
      if (NATIVEWIND_ONLY.has(value.$el)) out.push(`${where}: a <${value.$el}>`)
      Object.entries(value.props ?? {}).forEach(([name, item]) =>
        visit(item, `${where}.${name}`, name)
      )
      if (value.children !== undefined) {
        visit(value.children, `${where}.children`, "children")
      }
      return
    }
    Object.entries(value).forEach(([name, item]) =>
      visit(item as SpecValue, `${where}.${name}`, name)
    )
  }
  Object.entries(cases).forEach(([id, entry]) =>
    Object.entries(entry.props).forEach(([key, value]) =>
      visit(value, `${id} ${key}`, key)
    )
  )
  return out
}

/** Fails on any non-empty class string (className, *ClassName, tw) or DmText/ActionBtn in the cases. */
export const expectClassFree = (cases: Record<string, HarvestedCase>) => {
  expect(classesIn(cases)).toEqual([])
}
