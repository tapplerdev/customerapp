/* eslint-disable global-require, @typescript-eslint/no-var-requires -- the
   guard is installed from jest.mock factories, and withClassGuard reads the
   modules of the registry it runs in. */
/**
 * Jest only. The runtime half of W3's guard (W3 plan §5.3, customerapp-plan.md
 * skeptic H5), ported from proapp's. Since W3.2 customerapp has no
 * NativeWind, so a class string that reaches an element draws nothing, and
 * tappler-shared's DmText and ActionBtn, which draw through classes (DmText
 * its guard: 14/22, black, left; ActionBtn its whole look), draw wrong. Here
 * either fails the run where the element is made, naming the component that
 * made it and the components above it, instead of drawing nothing quietly.
 *
 * An element fails when
 * - a className-family prop (className, className*, *ClassName and
 *   NativeWind's `tw`: the style ratchet's family) holds a non-empty string.
 *   tappler-shared's components still take theirs (for proapp, until W4) and
 *   hand them on as `className={undefined}` or an empty string when a caller
 *   gave none; neither draws anything, so both pass;
 * - its type is tappler-shared's DmText or ActionBtn (registered with
 *   `forbid` as their modules load).
 *
 * The screen kit installs it for every render (screenKit/setup.ts, `yarn
 * test:parity`, so every screen parity file and `ds:parity:screens`): it
 * wraps react/jsx-runtime, react/jsx-dev-runtime, React.createElement and
 * React.cloneElement in place, in each module registry the kit loads,
 * through jest.mock factories. Component tests (`yarn test`) stay out on
 * purpose: their harvested stand-ins carry the props they were harvested
 * with. A test can still run one render under the guard (`withClassGuard`).
 *
 * Every refusal is also kept, on globalThis, so every registry shares one
 * list: a screen whose error boundary catches the throw still fails, in
 * setup.ts's afterEach (`failOnClassGuardViolations`). The kit's tree
 * check, `refuseHostClasses`, is the backstop behind it: a host in a
 * normalized tree that still carries a class fails too.
 */
import type { HostChild, HostNode } from "testing/hostTreeParity"

/** className, a className* slot, a *ClassName slot, and NativeWind's `tw`. */
export const CLASS_FAMILY = /^className|^tw$|ClassName$/

type GuardState = {
  /** DmText and ActionBtn, as each module registry loaded them. */
  forbidden: WeakMap<object, string>
  violations: string[]
}

const KEY = "__dsClassGuard"
const state = (): GuardState => {
  const holder = globalThis as unknown as Record<string, GuardState>
  if (!holder[KEY]) {
    holder[KEY] = { forbidden: new WeakMap(), violations: [] }
  }
  return holder[KEY]
}

// React renders a tree that threw once more before it gives up, and the
// same refusal comes again: it is kept once.
const keep = (message: string) => {
  const { violations } = state()
  if (!violations.includes(message)) violations.push(message)
}

/** Every refusal since the last call, and forget them. */
export const takeClassGuardViolations = (): string[] =>
  state().violations.splice(0)

/**
 * The kit's afterEach (screenKit/setup.ts): fail on any refusal still
 * kept, such as one an error boundary caught (the screen drew its fallback
 * and the render went on).
 */
export const failOnClassGuardViolations = () => {
  const refused = takeClassGuardViolations()
  if (refused.length) {
    throw new Error(
      `class guard: ${refused.length} refusal(s) during this test, caught on the way (an error boundary?):\n\n${refused.join("\n\n")}`
    )
  }
}

/**
 * Refuse a module's default export (DmText or ActionBtn) wherever an
 * element of it is made. Returns the module unchanged, for a mock factory.
 */
export const forbid = <M extends { default?: unknown }>(
  module: M,
  name: string
): M => {
  const component = module?.default
  if (
    component &&
    (typeof component === "function" || typeof component === "object")
  ) {
    state().forbidden.set(component as object, name)
  }
  return module
}

/** A fiber, as React's dev build hangs one on an element (`_owner`). */
type FiberLike = { type?: unknown; return?: FiberLike | null }

type AnyElement = {
  type?: unknown
  props?: Record<string, unknown>
  _owner?: FiberLike | null
}

type Named = {
  displayName?: string
  name?: string
  render?: Named
  type?: Named
}

const nameOf = (type: unknown): string => {
  if (typeof type === "string") return type
  if (!type || (typeof type !== "function" && typeof type !== "object")) {
    return String(type)
  }
  const named = type as Named
  return (
    named.displayName ||
    named.name ||
    (named.render && nameOf(named.render)) ||
    (named.type && nameOf(named.type)) ||
    "Anonymous"
  )
}

// A component's type: a function or class, or a memo or forwardRef of one
// (a context, a host or a fragment is none).
const isComponent = (type: unknown) =>
  typeof type === "function" ||
  (typeof type === "object" &&
    type !== null &&
    (typeof (type as Named).render === "function" ||
      typeof (type as Named).type === "function"))

const forbiddenName = (type: unknown): string | undefined =>
  type && (typeof type === "function" || typeof type === "object")
    ? state().forbidden.get(type as object)
    : undefined

const WHY: Record<string, string> = {
  DmText: "it draws its guard (14/22, black, left) through classes",
  ActionBtn: "it draws its whole look through classes",
}

/** What is wrong with an element, if anything. */
const problemsOf = (element: AnyElement): string[] => {
  const problems: string[] = []
  const banned = forbiddenName(element.type)
  if (banned) {
    problems.push(
      `<${banned}> is rendered: tappler-shared's ${banned} can't draw in customerapp, ${WHY[banned] ?? "through classes"}`
    )
  }
  const props = element.props ?? {}
  Object.keys(props).forEach((key) => {
    const value = props[key]
    if (
      CLASS_FAMILY.test(key) &&
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      problems.push(
        `${key}=${JSON.stringify(value)} reaches <${nameOf(element.type)}>, and draws nothing`
      )
    }
  })
  return problems
}

const STACK_DEPTH = 12

/**
 * Who made the element: the component rendering it (the element's owner, a
 * fiber in React's dev build) and the components above it, innermost first,
 * as React prints a component stack. The JS stack of the error says where
 * in the file.
 */
const madeBy = (element: AnyElement) => {
  const owner = element._owner
  if (!owner) return "  made outside a render (the JS stack below says where)"
  const stack: string[] = []
  for (
    let fiber: FiberLike | null | undefined = owner;
    fiber && stack.length < STACK_DEPTH;
    fiber = fiber.return
  ) {
    if (isComponent(fiber.type)) {
      const name = nameOf(fiber.type)
      if (stack[stack.length - 1] !== name) stack.push(name)
    }
  }
  return [
    `  made by <${nameOf(owner.type)}>`,
    ...stack.map((name) => `    at ${name}`),
  ].join("\n")
}

/**
 * React's dev build calls a component that threw once more, outside any
 * render and with the console switched off (its logs marked
 * `__reactDisabledLog`), only to find the component's frame for the error's
 * component stack. That call isn't a render: the guard leaves it be.
 */
const probingAFrame = () =>
  (console.log as { __reactDisabledLog?: boolean }).__reactDisabledLog === true

const check = <T>(element: T, how: string): T => {
  if (!element || typeof element !== "object") return element
  const problems = problemsOf(element as AnyElement)
  if (problems.length === 0 || probingAFrame()) return element
  const message =
    `class guard (${how}): ${problems.join("; ")}. customerapp has had no ` +
    "NativeWind since W3.2, so this would draw nothing (or wrong); give it " +
    "the style or the ds component instead.\n" +
    madeBy(element as AnyElement)
  keep(message)
  throw new Error(message)
}

const WRAPPED = Symbol.for("ds.classGuard.wrapped")
type Wrappable = ((...args: never[]) => unknown) & { [WRAPPED]?: true }

// The wrapper is one frame between React's element function and the
// component calling it, so React's dev owner stacks (in its warnings) show
// a classGuard frame above each real one: noise, not a different stack.
const wrap = <F extends Wrappable>(fn: F, how: string): F => {
  if (typeof fn !== "function" || fn[WRAPPED]) return fn
  const guarded = function classGuard(this: unknown, ...args: never[]) {
    return check(fn.apply(this, args), how)
  } as unknown as F
  Object.defineProperty(guarded, WRAPPED, { value: true })
  return guarded
}

type ReactLike = { createElement: Wrappable; cloneElement: Wrappable }
type JsxRuntimeLike = { jsx?: Wrappable; jsxs?: Wrappable; jsxDEV?: Wrappable }
const JSX_FUNCTIONS = ["jsx", "jsxs", "jsxDEV"] as const

/** React with createElement and cloneElement guarded, in place. */
export const guardReact = <R>(react: R): R => {
  const target = react as unknown as ReactLike
  target.createElement = wrap(target.createElement, "createElement")
  target.cloneElement = wrap(target.cloneElement, "cloneElement")
  return react
}

/**
 * react/jsx-runtime or react/jsx-dev-runtime with its element functions
 * guarded, in place.
 */
export const guardJsxRuntime = <J>(runtime: J): J => {
  const target = runtime as unknown as JsxRuntimeLike
  JSX_FUNCTIONS.forEach((name) => {
    const fn = target[name]
    if (fn) target[name] = wrap(fn, name)
  })
  return runtime
}

/**
 * The kit's tree check: a host that still carries a className-family prop
 * fails. The normalizer has already left out an empty class string (it
 * draws nothing), so what is left is a class that would draw nothing, or
 * one the element check can't read (not a string).
 */
export const refuseHostClasses = (tree: HostNode | null): HostNode | null => {
  const found: string[] = []
  const visit = (node: HostChild, at: string) => {
    if (typeof node === "string") return
    const here = `${at} > ${node.type}`
    Object.keys(node.props).forEach((key) => {
      if (CLASS_FAMILY.test(key)) {
        found.push(`${here}: ${key}=${JSON.stringify(node.props[key])}`)
      }
    })
    node.children.forEach((child, index) => visit(child, `${here}[${index}]`))
  }
  if (tree) visit(tree, "root")
  if (found.length) {
    const message = `class guard (host tree): a host still carries a class, which draws nothing:\n  ${found.join("\n  ")}`
    keep(message)
    throw new Error(message)
  }
  return tree
}

/**
 * Run `fn` with the guard on in this module registry (a component test's,
 * outside the kit): React's and the JSX runtimes' element functions wrapped
 * in place, and tappler-shared's DmText and ActionBtn refused. Everything is
 * put back afterwards, and the refusals `fn` caused are dropped with it, so
 * the caller asserts on the throw.
 */
export const withClassGuard = <T>(fn: () => T): T => {
  const react = require("react") as ReactLike
  const runtimes = [
    require("react/jsx-runtime"),
    require("react/jsx-dev-runtime"),
  ] as JsxRuntimeLike[]
  forbid(require("@tappler/shared/src/components/UI/DmText/DmText"), "DmText")
  forbid(
    require("@tappler/shared/src/components/UI/ActionBtn/ActionBtn"),
    "ActionBtn"
  )
  const saved = {
    createElement: react.createElement,
    cloneElement: react.cloneElement,
    runtimes: runtimes.map((runtime) => ({ ...runtime })),
  }
  guardReact(react)
  runtimes.forEach((runtime) => guardJsxRuntime(runtime))
  try {
    return fn()
  } finally {
    react.createElement = saved.createElement
    react.cloneElement = saved.cloneElement
    runtimes.forEach((runtime, index) => {
      JSX_FUNCTIONS.forEach((name) => {
        const original = saved.runtimes[index][name]
        if (original) Object.assign(runtime, { [name]: original })
      })
    })
    takeClassGuardViolations()
  }
}
