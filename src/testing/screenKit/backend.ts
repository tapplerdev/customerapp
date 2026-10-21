/**
 * Jest only. The screen kit's backend: RTK Query's network call answered by
 * endpoint name from the render's fixtures, the app's few plain `fetch`es
 * answered by URL, and every other way out of the process shut.
 *
 * services/api.ts builds its baseQuery with fetchBaseQuery; setup.ts swaps
 * that one function for `fetchBaseQuery` below, so everything around it is
 * the app's own (baseQueryWithReauth, transformResponse, the cache, tags,
 * the auth slice's matchers). A request is answered by its endpoint's
 * fixture:
 *
 *   { data }                  fulfilled with a copy of `data`
 *   { error: { status, data } }  rejected, as fetchBaseQuery rejects an HTTP error
 *   "loading"                 never answered: the screen's loading state
 *   (args, request) => ...    any of the above, chosen per call
 *
 * An endpoint the render gives no fixture is "loading" (and listed in the
 * request log, so a test can see what a screen asked for that nothing
 * answered). Mutations default to "loading" as well: a write on mount stays
 * in flight, and the log shows it. The refresh baseQueryWithReauth sends
 * after a 401 (`/auth/refresh/<token>`, through the 401'd endpoint's own
 * baseQuery call) is answered by the `authRefresh` fixture, not the
 * endpoint's.
 *
 * The app's other way out is plain `fetch`: HERE's geocoding
 * (services/here-maps-api.ts) and the SVG art cache (services/svgCache.ts).
 * A render's `http` answers them by URL (httpKey: HERE's `apiKey` taken out,
 * so no fixture holds a key and none depends on the worktree's .env):
 *
 *   { json } or { text }, with an optional status (200)
 *   "loading"                 never answered (the default for an unlisted URL)
 *
 * The app talks to the PRODUCTION backend, so nothing here may reach it:
 * `fetch`, XMLHttpRequest and WebSocket are replaced with versions that go
 * nowhere and say so (shutTheNetwork, from setup.ts); a fetch the render's
 * `http` answers never leaves the process either.
 */

export type EndpointAnswer =
  | { data: unknown }
  | { error: { status: number | string; data?: unknown } }
  | "loading"

export type EndpointFixture =
  | EndpointAnswer
  | ((args: unknown, request: BackendRequest) => EndpointAnswer)

/** Fixtures by endpoint name (services/api.ts), plus `authRefresh`. */
export type BackendFixtures = Record<string, EndpointFixture>

/** The pseudo-endpoint the refresh after a 401 is answered by. */
export const AUTH_REFRESH = "authRefresh"

export type BackendRequest = {
  endpoint: string
  type: "query" | "mutation"
  /** The request as RTK Query built it: a path, or { url, method, body, params }. */
  args: unknown
  answer: "data" | "error" | "loading"
  /** No fixture: answered "loading" by default. */
  unanswered: boolean
}

/** A plain fetch's answer: a body as JSON or text, and a status. */
export type HttpAnswer =
  | { status?: number; json?: unknown; text?: string }
  | "loading"

/** Answers by httpKey, or a function of the key (undefined: not answered). */
export type HttpFixtures =
  | Record<string, HttpAnswer>
  | ((key: string) => HttpAnswer | undefined)

/** One plain fetch the screen made, and whether a fixture answered it. */
export type HttpRequest = { key: string; answered: boolean }

type BaseQueryApi = {
  endpoint: string
  type: "query" | "mutation"
  signal?: AbortSignal
}

let fixtures: BackendFixtures = {}
let log: BackendRequest[] = []
let inFlight = 0

const plain = (value: unknown) => {
  if (value === undefined) return undefined
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

/*
 * The plain-fetch answers and log, kept on the global like the guards: the
 * fetch stand-in comes from setup.ts's copy of this module, while each
 * platform's registry configures its own copy.
 */
const HTTP = "__screenKitHttp"
type HttpState = { fixtures: HttpFixtures; log: HttpRequest[] }
const http = (): HttpState => {
  const scope = globalThis as Record<string, unknown>
  if (!scope[HTTP]) scope[HTTP] = { fixtures: {}, log: [] }
  return scope[HTTP] as HttpState
}

/** The fixtures the next render answers with (the kit calls this per render). */
export const configureBackend = (
  next: BackendFixtures = {},
  nextHttp: HttpFixtures = {}
) => {
  fixtures = next
  log = []
  inFlight = 0
  http().fixtures = nextHttp
  http().log = []
  clearNetworkAttempts()
}

/** Every request since configureBackend, in order. */
export const backendLog = () => log.slice()

/** Every plain fetch since configureBackend, in order. */
export const httpLog = () => http().log.slice()

/** True while an answer is on its way (the kit's settle loop waits for it). */
export const backendBusy = () => inFlight > 0

const noop = () => undefined

const never = () =>
  new Promise<never>(() => {
    // never answered: the loading state
  })

/** The path an RTK request asked for (a string, or the url of { url, ... }). */
const pathOf = (args: unknown) =>
  typeof args === "string"
    ? args
    : String((args as { url?: unknown } | null)?.url ?? "")

/**
 * The stand-in for RTK Query's fetchBaseQuery: same signature, answers from
 * the fixtures. Its options (baseUrl, prepareHeaders, timeout) are ignored:
 * nothing is sent.
 */
export const fetchBaseQuery =
  (_options?: unknown) =>
  async (args: unknown, api: BaseQueryApi): Promise<unknown> => {
    const endpoint = pathOf(args).startsWith("/auth/refresh/")
      ? AUTH_REFRESH
      : api.endpoint
    const fixture = fixtures[endpoint]
    const request: BackendRequest = {
      endpoint,
      type: api.type,
      args: plain(args),
      answer: "loading",
      unanswered: fixture === undefined,
    }
    log.push(request)
    const answer: EndpointAnswer =
      fixture === undefined
        ? "loading"
        : typeof fixture === "function"
          ? fixture(plain(args), request)
          : fixture
    if (answer === "loading") return never()
    request.answer = "data" in answer ? "data" : "error"
    inFlight += 1
    try {
      // One turn, like a response arriving.
      await Promise.resolve()
    } finally {
      inFlight -= 1
    }
    if ("error" in answer) return { error: plain(answer.error) }
    return { data: plain(answer.data) }
  }

/**
 * A plain fetch's fixture key: the URL with any `apiKey` parameter taken out
 * (HERE puts its key in the query), everything else as the app wrote it.
 */
export const httpKey = (url: string) =>
  url
    .replace(/([?&])apiKey=[^&]*(&?)/, (_match, before: string, after: string) =>
      after ? before : ""
    )
    .replace(/[?&]$/, "")

const answerFetch = (url: string): Promise<unknown> | null => {
  const key = httpKey(url)
  const state = http()
  const found =
    typeof state.fixtures === "function"
      ? state.fixtures(key)
      : state.fixtures[key]
  state.log.push({ key, answered: found !== undefined && found !== "loading" })
  if (found === undefined) return null
  if (found === "loading") return never()
  const status = found.status ?? 200
  const body = found.text ?? JSON.stringify(found.json ?? null)
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: { get: () => null },
    json: () => Promise.resolve(JSON.parse(body)),
    text: () => Promise.resolve(body),
  })
}

/*
 * What tried to reach the network since the last render (fetch, XHR,
 * WebSocket). Kept on the global, like the guards themselves: setup.ts
 * installs them once per test file, from its own copy of this module, and
 * each platform's registry loads another copy.
 */
const ATTEMPTS = "__screenKitNetworkAttempts"
const attempts = () => {
  const scope = globalThis as Record<string, unknown>
  if (!Array.isArray(scope[ATTEMPTS])) scope[ATTEMPTS] = []
  return scope[ATTEMPTS] as string[]
}

export const networkAttempts = () => attempts().slice()

const blocked = (what: string) => {
  attempts().push(what)
  // eslint-disable-next-line no-console
  console.warn(
    `screenKit: ${what} blocked (the network is shut under the parity config; the app's backend is production)`
  )
}

/**
 * fetch, XMLHttpRequest and WebSocket go nowhere (setup.ts calls this once
 * per test file): a fetch the render's `http` doesn't answer never settles,
 * an XHR never sends, a socket never opens, and each attempt is listed in
 * networkAttempts() with a warning.
 */
export const shutTheNetwork = () => {
  const scope = globalThis as Record<string, unknown>
  scope.fetch = (input: unknown) => {
    const url = String(
      typeof input === "object" && input && "url" in input
        ? (input as { url: string }).url
        : input
    )
    const answered = answerFetch(url)
    if (answered) return answered
    blocked(`fetch ${httpKey(url)}`)
    return never()
  }
  // Shaped like the real classes (`new` gives the object); nothing is sent.
  function ShutXMLHttpRequest() {
    return {
      readyState: 0,
      open: (method: string, url: string) => {
        blocked(`XMLHttpRequest ${method} ${url}`)
      },
      send: noop,
      setRequestHeader: noop,
      abort: noop,
      addEventListener: noop,
      removeEventListener: noop,
    }
  }
  function ShutWebSocket(url: string) {
    blocked(`WebSocket ${url}`)
    return {
      readyState: 0,
      send: noop,
      close: noop,
      addEventListener: noop,
      removeEventListener: noop,
    }
  }
  scope.XMLHttpRequest = ShutXMLHttpRequest
  scope.WebSocket = ShutWebSocket
}

/** Forget the attempts (the kit calls it per render, with configureBackend). */
export const clearNetworkAttempts = () => {
  attempts().length = 0
}
