/* eslint-disable global-require, @typescript-eslint/no-var-requires,
   no-new-func -- a module's own code, evaluated again for each row, with its
   imports resolved through the current module registry. */
/**
 * Jest only. The per-row reset: module state the app keeps between renders,
 * made fresh before every row, so no row draws what an earlier row of the
 * same file left behind (skeptic M2).
 *
 * The kit loads the app once per registry and reuses it for every row of
 * that platform and window (index.ts), and some app modules keep state at
 * module scope: chatReadRegistry's read chats (a 20 s TTL on the kit's
 * frozen clock never expires, so one MessagesDetails row's mark-all zeroed
 * that chat's unread count in every later Messages row), svgCache's art and
 * requests, chatCache's open chat and applied ids, useAttachments' optimistic
 * ids, layoutAnimation's frame flag, the event buses' listeners, shared's
 * sheet dim stack and its owner. Each of those (PER_ROW below, mocked in
 * setup.ts) is the module's own code, evaluated again from its source for
 * each row: its exports stand behind a proxy that reads the row's copy, and
 * its imports resolve through the registry as they always do (the api, the
 * store, React are the registry's one instance). Nothing is a stand-in.
 *
 * The engine calls resetRowState() before each render; each module's next
 * copy is made when the row first reads it. A module that keeps state but
 * isn't listed still leaks: add it to PER_ROW (and say why). services/api's
 * own `isRefreshing` can't be: the store and the slices hold that module.
 */
import fs from "fs"
import path from "path"

const ROOT = path.resolve(__dirname, "../../..")

/**
 * The modules made fresh per row, as setup.ts names them (paths from src, or
 * tappler-shared's under `@tappler/shared/`), with the state each keeps.
 */
export const PER_ROW: Record<string, string> = {
  "services/chatReadRegistry": "read chats, a TTL on the frozen clock",
  "services/svgCache": "fetched SVG art and its in-flight requests",
  "services/chatCache": "the open chat, applied message ids",
  "hooks/useAttachments": "the optimistic message id counter",
  "helpers/layoutAnimation": "the once-per-frame flag",
  "events/questionFlowEventBus": "listeners",
  "events/messageBannerEventBus": "listeners",
  "@tappler/shared/src/events/AddressBus": "listeners",
  "@tappler/shared/src/components/NativeSheet/dimStore":
    "the dim stack, its listeners and id counter",
  "@tappler/shared/src/components/NativeSheet/dimProgress":
    "the dim's owner and progress values",
}

/** Where a PER_ROW name's source is. */
export const sourceOf = (name: string) => {
  const base = name.startsWith("@tappler/shared/")
    ? path.join(ROOT, "..", "tappler-shared", name.slice("@tappler/shared/".length))
    : path.join(ROOT, "src", name)
  const file = [".ts", ".tsx", ".js"]
    .map((ext) => base + ext)
    .find((candidate) => fs.existsSync(candidate))
  if (!file) throw new Error(`screenKit rowState: no source for ${name}`)
  return file
}

type Exports = Record<string | symbol, unknown>

/** The transformed code by file, shared by every registry (keyed by mtime). */
const CODE = "__screenKitRowStateCode"
const transformed = (file: string): string => {
  const scope = globalThis as Record<string, unknown>
  if (!(scope[CODE] instanceof Map)) scope[CODE] = new Map()
  const cache = scope[CODE] as Map<string, { mtime: number; code: string }>
  const mtime = fs.statSync(file).mtimeMs
  const hit = cache.get(file)
  if (hit && hit.mtime === mtime) return hit.code
  const babel = require("@babel/core") as typeof import("@babel/core")
  const result = babel.transformFileSync(file, {
    cwd: ROOT,
    root: ROOT,
    filename: file,
    // As babel-jest calls it: CommonJS out.
    caller: {
      name: "babel-jest",
      supportsDynamicImport: false,
      supportsStaticESM: false,
      supportsTopLevelAwait: false,
    } as never,
  })
  if (!result?.code) throw new Error(`screenKit rowState: ${file} didn't transform`)
  cache.set(file, { mtime, code: result.code })
  return result.code
}

/** A fresh copy of `file`, its imports from the current registry. */
const evaluate = (file: string): Exports => {
  const dir = path.dirname(file)
  const localRequire = (request: string) =>
    require(request.startsWith(".") ? path.resolve(dir, request) : request)
  const module = { exports: {} as Exports }
  new Function(
    "exports",
    "require",
    "module",
    "__filename",
    "__dirname",
    transformed(file)
  )(module.exports, localRequire, module, file, dir)
  return module.exports
}

const stale = new Set<() => void>()

/**
 * The module setup.ts mocks `name` with: the module's own exports, from a
 * copy made fresh for each row.
 */
export const perRow = (name: string): Exports => {
  const file = sourceOf(name)
  let current: Exports | null = null
  const copy = () => {
    if (current === null) current = evaluate(file)
    return current
  }
  stale.add(() => {
    current = null
  })
  return new Proxy({} as Exports, {
    get: (_target, key) => copy()[key],
    has: (_target, key) => key in copy(),
    ownKeys: () => Reflect.ownKeys(copy()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Object.getOwnPropertyDescriptor(copy(), key)
      return descriptor ? { ...descriptor, configurable: true } : undefined
    },
  })
}

/** Before a row: every PER_ROW module's next read gets a fresh copy. */
export const resetRowState = () => {
  stale.forEach((forget) => forget())
}
