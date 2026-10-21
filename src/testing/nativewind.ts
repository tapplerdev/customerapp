/**
 * Jest only (it runs tailwind and postcss; never import it from app code).
 *
 * What NativeWind 2.0.11 makes of a class string with this app's
 * tailwind.config.js: each class compiled the way NativeWind's Babel plugin
 * compiles a file (resolveConfig with its nativePlugin, then extractStyles),
 * then composed the way its runtime composes a className (runtime.js
 * `prepare`): in string order, later classes winning per property, every
 * transform gathered into one list appended last.
 *
 * It refuses what a plain composition can't express, so a test can't pass
 * against a style NativeWind would only apply conditionally: a class with a
 * mask (dark:, rtl:, ios:...), with runtime units, or with child classes.
 * A class NativeWind drops (unitless leading-[20], font-custom500, a typo)
 * is reported in `dropped`.
 */
import resolveConfig from "tailwindcss/resolveConfig"
import { nativePlugin } from "nativewind/dist/tailwind/native"
import { extractStyles } from "nativewind/dist/postcss/extract-styles"

// eslint-disable-next-line @typescript-eslint/no-var-requires
const userConfig = require("../../tailwind.config.js")

type Style = Record<string, unknown>

type Compiled = {
  style: Style | undefined
  isTransform: boolean
}

const compiled = new Map<string, Compiled>()

const compile = (classNames: string[]) => {
  const missing = classNames.filter((name) => !compiled.has(name))
  if (missing.length === 0) return
  const userPlugins = userConfig.plugins ?? []
  const config = resolveConfig({
    ...userConfig,
    plugins: [nativePlugin({}), ...userPlugins],
  })
  const { raw } = extractStyles({
    ...config,
    content: [{ raw: missing.join(" "), extension: "html" }],
    safelist: [],
  })
  missing.forEach((name) => {
    if (raw.masks?.[name]) {
      throw new Error(`${name} has a mask (a variant): not composable`)
    }
    if (raw.units?.[name]) {
      throw new Error(`${name} has runtime units: not composable`)
    }
    if (raw.childClasses?.[name]) {
      throw new Error(`${name} styles its children: not composable`)
    }
    compiled.set(name, {
      style: raw.styles?.[name] as Style | undefined,
      isTransform: !!raw.transforms?.[name],
    })
  })
}

/** NativeWind's output for one class, or undefined when it emits nothing. */
export const nativewindClass = (className: string): Style | undefined => {
  compile([className])
  return compiled.get(className)!.style
}

/** The same for many classes, compiled in one tailwind run. */
export const nativewindClasses = (classNames: string[]) => {
  compile(classNames)
  return Object.fromEntries(
    classNames.map((name) => [name, compiled.get(name)!.style])
  )
}

/** A whole className, composed as NativeWind's runtime composes it. */
export const nativewindStyle = (className: string) => {
  const names = className.split(/\s+/).filter(Boolean)
  compile(names)
  const style: Style = {}
  const transform: unknown[] = []
  const dropped: string[] = []
  names.forEach((name) => {
    const entry = compiled.get(name)!
    if (!entry.style) {
      dropped.push(name)
    } else if (entry.isTransform) {
      transform.push(...(entry.style.transform as unknown[]))
    } else {
      Object.assign(style, entry.style)
    }
  })
  if (transform.length > 0) style.transform = transform
  return { style, dropped }
}
