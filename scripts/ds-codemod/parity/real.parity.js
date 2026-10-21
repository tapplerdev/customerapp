/**
 * One half of the real-file parity run (run-real.js drives it): renders each
 * target in targets.js with the real NativeWind runtime, in English and
 * Arabic, and writes the flattened host trees to
 * $DS_PARITY_OUT/<phase>/<platform>.json. run-real.js runs it on the
 * original files, converts them with the codemod, runs it again, and
 * compares. Mocks stand in for the store, the API and navigation only; every
 * component a target draws is the real one.
 */
const fs = require("fs")
const path = require("path")
const React = require("react")

const { renderTree } = require("./render")
const { RECIPES } = require("./targets")

// Read through globalThis: babel here (react-native-dotenv) inlines a
// literal `process.env.NAME` at transform time, and jest caches the result.
const ENV = globalThis.process.env

const PHASE = ENV.DS_PARITY_PHASE
const OUT = ENV.DS_PARITY_OUT
const PLATFORM = ENV.DS_PARITY_PLATFORM || "ios"
const ROOT = path.resolve(__dirname, "..", "..", "..")

// The signed-in customer the screens read (customerapp's auth and cart
// slices, store/auth/slice.ts and store/cart/slice.ts).
const mockState = {
  auth: {
    isAuth: true,
    token: "x",
    language: "en",
    hasPickedLanguage: true,
    currentScreen: undefined,
    isLogout: false,
    user: {
      id: 9,
      firstName: "Omar",
      lastName: "Gabr",
      email: "customer@example.com",
      mobileNumber: "+201012345678",
      gender: "male",
    },
    guestLocation: { coords: null, address: null },
  },
  cart: { carts: {}, address: null },
}

jest.mock("store", () => ({
  __esModule: true,
  useTypedSelector: (select) => select(mockState),
  useTypedDispatch: () => () => undefined,
  useAppDispatch: () => () => undefined,
  store: {
    getState: () => mockState,
    dispatch: () => undefined,
    subscribe: () => () => undefined,
  },
  default: {
    getState: () => mockState,
    dispatch: () => undefined,
    subscribe: () => () => undefined,
  },
}))

jest.mock("react-redux", () => ({
  __esModule: true,
  useDispatch: () => () => undefined,
  useSelector: (select) => select(mockState),
  Provider: ({ children }) => children,
}))

// WelcomeScreen restarts the app after a language pick; nothing is pressed.
jest.mock("react-native-restart", () => ({
  __esModule: true,
  default: { restart: () => undefined, Restart: () => undefined },
}))

// The job map, without react-native-maps (TypeScript source in its package
// and a native view behind it). No recipe gives coordinates, so it would draw
// nothing anyway.
jest.mock("@tappler/shared/src/components/JobLocationMap", () => ({
  __esModule: true,
  default: () => null,
  isAreaWorthDrawing: () => false,
}))

// What a recipe's case gives a query hook, by hook name, while it draws.
const mockQueryData = {}

// Every RTK Query hook, answering "nothing loaded, nothing loading" unless
// the case being drawn gave it data.
jest.mock("services/api", () => {
  const hook = (name) => {
    if (/^useLazy\w+Query$/.test(name))
      return () => [
        () => ({ unwrap: () => Promise.resolve({}) }),
        { data: undefined, isLoading: false, isFetching: false },
      ]
    if (/^use\w+Mutation$/.test(name))
      return () => [
        () => ({ unwrap: () => Promise.resolve({}) }),
        { isLoading: false, reset: () => undefined },
      ]
    if (/^use\w+Query$/.test(name))
      return () => ({
        data: mockQueryData[name],
        isLoading: false,
        isFetching: false,
        isError: false,
        refetch: () => undefined,
      })
    return () => undefined
  }
  return new Proxy(
    {},
    {
      get: (_t, name) => {
        if (name === "__esModule") return true
        if (typeof name !== "string") return undefined
        if (name.startsWith("use")) return hook(name)
        return new Proxy(() => undefined, { get: () => () => undefined })
      },
    }
  )
})

// One clock for both runs: a screen that prints the time (BusinessModal's
// hours) would otherwise differ by the minutes between them. Only Date is
// faked; timers and microtasks run as normal.
beforeAll(() => {
  jest.useFakeTimers({
    now: new Date("2026-10-20T09:00:00.000Z"),
    doNotFake: [
      "nextTick",
      "setImmediate",
      "clearImmediate",
      "queueMicrotask",
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "hrtime",
      "performance",
    ],
  })
})
afterAll(() => jest.useRealTimers())

const navigation = {
  navigate: () => undefined,
  goBack: () => undefined,
  replace: () => undefined,
  setOptions: () => undefined,
  dispatch: () => undefined,
  addListener: () => () => undefined,
  canGoBack: () => true,
}
const route = { key: "parity", name: "Parity", params: {} }

const SWEEP = ENV.DS_PARITY_SWEEP
const describeIf = PHASE && OUT && !SWEEP ? describe : describe.skip
const describeSweep = PHASE && OUT && SWEEP ? describe : describe.skip

const errorText = (error) =>
  String(
    error && error.stack
      ? error.stack.split("\n").slice(0, 3).join(" | ")
      : error
  )

// Why a file didn't import: the message and the package file it stopped in
// (an ESM file this config doesn't transform, a native module's guard).
const loadError = (error) => {
  const message = String((error && error.message) || error).split("\n")[0]
  const frame = String((error && error.stack) || "")
    .split("\n")
    .map((line) => line.match(/node_modules\/[^():\s]+(:\d+)?/))
    .find(Boolean)
  return frame ? `${message} (${frame[0]})` : message
}

// The broad check: every file the codemod changes, its default export drawn
// with no props (a screen gets navigation and route). Many need props and
// throw; those are counted, not compared. What draws is compared. A file
// that doesn't import, or has no component to draw, is its own kind
// (sweep.js): nothing in it was checked.
describeSweep(`sweep, ${PHASE}, ${PLATFORM}`, () => {
  // A skipped describe still runs its body to list the tests.
  const files = SWEEP
    ? JSON.parse(fs.readFileSync(SWEEP, "utf8"))
    : ["(no sweep)"]
  const results = {}
  afterAll(() => {
    const dir = path.join(OUT, PHASE)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, `${PLATFORM}.sweep.json`),
      JSON.stringify(results)
    )
  })
  it.each(files)("draws %s with no props", async (file) => {
    const out = []
    let Component
    try {
      // eslint-disable-next-line import/no-dynamic-require
      Component = require(path.join(ROOT, file)).default
    } catch (error) {
      results[file] = [{ kind: "load", error: `import: ${loadError(error)}` }]
      return
    }
    if (typeof Component !== "function" && !(Component && Component.$$typeof)) {
      results[file] = [{ kind: "export", error: "no component export" }]
      return
    }
    const props = file.startsWith("src/screens/") ? { navigation, route } : {}
    for (const lang of ["en", "ar"]) {
      try {
        out.push({
          lang,
          tree: await renderTree(React.createElement(Component, props), lang),
        })
      } catch (error) {
        out.push({ lang, kind: "render", error: errorText(error) })
      }
    }
    results[file] = out
  })
})

describeIf(`real files, ${PHASE}, ${PLATFORM}`, () => {
  const results = {}

  afterAll(() => {
    const dir = path.join(OUT, PHASE)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, `${PLATFORM}.json`),
      JSON.stringify(results, null, 1)
    )
  })

  it.each(RECIPES.map((r) => [r.file, r]))("draws %s", async (file, recipe) => {
    const h = React.createElement
    const icon = h("SvgIcon", { width: 24, height: 24 })
    // eslint-disable-next-line import/no-dynamic-require
    const mod = require(path.join(ROOT, file))
    const Component = mod.default
    const out = []
    for (const c of recipe.cases(h, icon)) {
      const props = recipe.screen ? { navigation, route, ...c.props } : c.props
      for (const k of Object.keys(mockQueryData)) delete mockQueryData[k]
      Object.assign(mockQueryData, c.queries || {})
      for (const lang of ["en", "ar"]) {
        try {
          out.push({
            case: c.name,
            lang,
            tree: await renderTree(h(Component, props), lang),
          })
        } catch (error) {
          out.push({
            case: c.name,
            lang,
            error: String(
              error && error.stack
                ? error.stack.split("\n").slice(0, 4).join(" | ")
                : error
            ),
          })
        }
      }
    }
    results[file] = out
  })
})
