/**
 * Jest only. A harvested prop set (harvest.ts) as the props a render hands
 * the component: a handler marker becomes a function, an element spec the
 * element (its tag from `elements`, or an SVG stand-in named after it), an
 * opaque value the test's own value for it.
 */
import React from "react"

import { svgStub } from "testing/svgStub"

import type { ElementSpec, PropSet, SpecValue } from "./harvest"

export type BuildOptions = {
  /** The components an element spec may name, by tag (DmText, DmView...). */
  elements?: Record<string, React.ComponentType<any>>
  /**
   * Values for the `{ $opaque: "<source>" }` markers an `any` prop left, by
   * source text, or a function of the source text. A marker with no value
   * stops the build.
   */
  opaque?: Record<string, unknown> | ((source: string) => unknown)
}

const noop = () => undefined

const isElementSpec = (value: SpecValue): value is ElementSpec =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "$el" in value

export const buildValue = (
  value: SpecValue,
  options: BuildOptions
): unknown => {
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const built = buildValue(item, options)
      return React.isValidElement(built)
        ? React.cloneElement(built, { key: String(index) })
        : built
    })
  }
  if ("$fn" in value) return noop
  if ("$opaque" in value) {
    const key = (value as { $opaque: string }).$opaque
    const { opaque } = options
    if (typeof opaque === "function") return opaque(key)
    if (!opaque || !(key in opaque)) {
      throw new Error(
        `no value for "${key}" (a harvested \`any\` prop): give it in buildProps' opaque`
      )
    }
    return opaque[key]
  }
  if (isElementSpec(value)) {
    const Component = options.elements?.[value.$el] ?? svgStub(value.$el)
    const children =
      value.children === undefined
        ? []
        : [buildValue(value.children, options)].flat()
    return React.createElement(
      Component,
      buildProps(value.props ?? {}, options),
      ...(children as React.ReactNode[])
    )
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, buildValue(item, options)])
  )
}

/** The props for a render. */
export const buildProps = (props: PropSet, options: BuildOptions = {}) =>
  Object.fromEntries(
    Object.entries(props).map(([key, value]) => [
      key,
      buildValue(value, options),
    ])
  ) as Record<string, any>
