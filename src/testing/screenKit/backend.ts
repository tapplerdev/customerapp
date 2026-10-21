/**
 * Jest only. The screen kit's backend: RTK Query's network call answered by
 * endpoint name from the render's fixtures, and every other way out of the
 * process shut.
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
 * in flight, and the log shows it.
 *
 * The app talks to the PRODUCTION backend, so nothing here may reach it:
 * `fetch`, XMLHttpRequest and WebSocket are replaced with versions that go
 * nowhere and say so (shutTheNetwork, from setup.ts).
 */

export type EndpointAnswer =
  | { data: unknown }
  | { error: { status: number | string; data?: unknown } }
  | "loading"

export type EndpointFixture =
  | EndpointAnswer
  | ((args: unknown, request: BackendRequest) => EndpointAnswer)

/** Fixtures by endpoint name (services/api.ts). */
export type BackendFixtures = Record<string, EndpointFixture>

export type BackendRequest = {
  endpoint: string
  type: "query" | "mutation"
  /** The request as RTK Query built it: a path, or { url, method, body, params }. */
  args: unknown
  answer: "data" | "error" | "loading"
  /** No fixture: answered "loading" by default. */
  unanswered: boolean
}

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

/** The fixtures the next render answers with (the kit calls this per render). */
export const configureBackend = (next: BackendFixtures = {}) => {
  fixtures = next
  log = []
  inFlight = 0
  clearNetworkAttempts()
}

/** Every request since configureBackend, in order. */
export const backendLog = () => log.slice()

/** True while an answer is on its way (the kit's settle loop waits for it). */
export const backendBusy = () => inFlight > 0

const noop = () => undefined

const never = () =>
  new Promise<never>(() => {
    // never answered: the loading state
  })

/**
 * The stand-in for RTK Query's fetchBaseQuery: same signature, answers from
 * the fixtures. Its options (baseUrl, prepareHeaders, timeout) are ignored:
 * nothing is sent.
 */
export const fetchBaseQuery =
  (_options?: unknown) =>
  async (args: unknown, api: BaseQueryApi): Promise<unknown> => {
    const fixture = fixtures[api.endpoint]
    const request: BackendRequest = {
      endpoint: api.endpoint,
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
 * per test file): a fetch never settles, an XHR never sends, a socket never
 * opens, and each attempt is listed in networkAttempts() with a warning.
 */
export const shutTheNetwork = () => {
  const scope = globalThis as Record<string, unknown>
  scope.fetch = (input: unknown) => {
    blocked(
      `fetch ${String(
        typeof input === "object" && input && "url" in input
          ? (input as { url: string }).url
          : input
      )}`
    )
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
