/* eslint-disable global-require, @typescript-eslint/no-var-requires -- a
   jest.mock factory MUST require lazily:
   it is hoisted above every import and runs when the module is first asked
   for (in whichever module registry asks). */
/**
 * Jest only: jest.parity.config.js's setup, after the app's jest.setup.js
 * (whose true-sheet stand-in, true-sheet/reanimated mock and Reanimated and
 * worklets stand-ins stay). Every native module and native view a screen can
 * reach is swapped for a stand-in (nativeMocks.ts); the network is shut
 * (backend.ts answers RTK Query and the render's `http` answers; anything
 * else that tries is refused, loudly); the store is the kit's (store.ts); the
 * app's module state is fresh per row (rowState.ts); every element is checked
 * for a class or a DmText/ActionBtn (testing/classGuard). No component of
 * ours is mocked.
 */
import { afterEach, jest } from "@jest/globals"

import { failOnClassGuardViolations } from "testing/classGuard"

import { shutTheNetwork } from "./backend"

shutTheNetwork()

// ---------------------------------------------------------------------------
// The class guard (testing/classGuard, W3 plan §5.3, ported from proapp's
// W3.4): in every registry the kit loads, an element made with a non-empty
// class string throws where it is made, with the component that made it.
// Nothing is mocked away: React and the JSX runtimes are the real ones with
// their element functions wrapped in place.

jest.mock("react", () =>
  require("testing/classGuard").guardReact(jest.requireActual("react"))
)
jest.mock("react/jsx-runtime", () =>
  require("testing/classGuard").guardJsxRuntime(
    jest.requireActual("react/jsx-runtime")
  )
)
jest.mock("react/jsx-dev-runtime", () =>
  require("testing/classGuard").guardJsxRuntime(
    jest.requireActual("react/jsx-dev-runtime")
  )
)

// A refusal an error boundary swallowed (the screen drew its fallback) still
// fails the test that caused it.
afterEach(failOnClassGuardViolations)

// ---------------------------------------------------------------------------
// The test file's own module registry has no layout direction. A module the
// test imports at its top loads here, in no row's registry: always LTR, so a
// styles file that reads I18nManager.isRTL as it loads
// (FoodCheckoutScreen/styles.ts:15) kept its English branch in every Arabic
// row, capture and compare alike (review, Low K). Every row's registry
// (index.ts, after jest.resetModules) has an I18nManager of its own, which
// the kit sets; this one refuses to be read, and says what to do.

const TOP_LEVEL_DIRECTION =
  "screenKit: I18nManager.isRTL read in the test file's own registry, which is no row's (always LTR): " +
  "a module imported at the top of a *.parity.tsx (a styles file, a component, a harness) loads there, " +
  "so an Arabic row would draw its English branch. Load it inside the loader " +
  '(`() => require("../MyScreen")`, a harness defined in it) or in a step, where it loads in the row\'s ' +
  "registry, with the row's direction."
Object.defineProperty(
  (require("react-native") as { I18nManager: object }).I18nManager,
  "isRTL",
  {
    configurable: true,
    enumerable: true,
    get: () => {
      throw new Error(TOP_LEVEL_DIRECTION)
    },
    set: () => {
      throw new Error(TOP_LEVEL_DIRECTION)
    },
  }
)

// ---------------------------------------------------------------------------
// The app's own data layer: a real Redux store from the app's reducers, made
// fresh for each render (store.ts says how, and pins the reducer list).

jest.mock("store", () => require("testing/screenKit/storeModule").storeModule())

// RTK Query's network call: the kit's fake backend answers by endpoint name.
jest.mock("@reduxjs/toolkit/query/react", () => {
  const actual = jest.requireActual("@reduxjs/toolkit/query/react") as Record<
    string,
    unknown
  >
  return {
    ...actual,
    fetchBaseQuery: require("testing/screenKit/backend").fetchBaseQuery,
  }
})

// ---------------------------------------------------------------------------
// Module state, fresh for each row (rowState.ts): each module's own code,
// evaluated again per row. The names match rowState's PER_ROW (pinned by
// screenKit.parity.tsx).

jest.mock("services/chatReadRegistry", () =>
  require("testing/screenKit/rowState").perRow("services/chatReadRegistry")
)
jest.mock("services/svgCache", () =>
  require("testing/screenKit/rowState").perRow("services/svgCache")
)
jest.mock("services/chatCache", () =>
  require("testing/screenKit/rowState").perRow("services/chatCache")
)
jest.mock("hooks/useAttachments", () =>
  require("testing/screenKit/rowState").perRow("hooks/useAttachments")
)
jest.mock("helpers/layoutAnimation", () =>
  require("testing/screenKit/rowState").perRow("helpers/layoutAnimation")
)
jest.mock("events/questionFlowEventBus", () =>
  require("testing/screenKit/rowState").perRow("events/questionFlowEventBus")
)
jest.mock("events/messageBannerEventBus", () =>
  require("testing/screenKit/rowState").perRow("events/messageBannerEventBus")
)
jest.mock("@tappler/shared/src/events/AddressBus", () =>
  require("testing/screenKit/rowState").perRow(
    "@tappler/shared/src/events/AddressBus"
  )
)
jest.mock("@tappler/shared/src/components/NativeSheet/dimStore", () =>
  require("testing/screenKit/rowState").perRow(
    "@tappler/shared/src/components/NativeSheet/dimStore"
  )
)
jest.mock("@tappler/shared/src/components/NativeSheet/dimProgress", () =>
  require("testing/screenKit/rowState").perRow(
    "@tappler/shared/src/components/NativeSheet/dimProgress"
  )
)

// ---------------------------------------------------------------------------
// Libraries' own jest mocks, where they ship one.

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)
// check/request answer "granted" unless the render says otherwise (the
// engine's `permissions` option sets them per row).
jest.mock("react-native-permissions", () =>
  jest.requireActual("react-native-permissions/mock")
)
// Gesture handler's documented jest setup: its native module and buttons
// mocked, the rest its real JS.
require("react-native-gesture-handler/jestSetup")

// ---------------------------------------------------------------------------
// Native modules and views (nativeMocks.ts).

// React Native's own Modal mock, which on iOS also reports a dismissal.
jest.mock("react-native/Libraries/Modal/Modal", () =>
  require("testing/screenKit/nativeMocks").modal(
    jest.requireActual("@react-native/jest-preset/jest/mocks/Modal")
  )
)
jest.mock("@shopify/flash-list", () =>
  require("testing/screenKit/nativeMocks").flashList()
)
jest.mock("react-native-reanimated-carousel", () =>
  require("testing/screenKit/nativeMocks").carousel()
)
jest.mock("react-native-maps", () =>
  require("testing/screenKit/nativeMocks").maps()
)
jest.mock("react-native-linear-gradient", () =>
  require("testing/screenKit/nativeMocks").linearGradient()
)
jest.mock("lottie-react-native", () =>
  require("testing/screenKit/nativeMocks").lottie()
)
jest.mock("react-native-fast-image", () =>
  require("testing/screenKit/nativeMocks").fastImage()
)
jest.mock("react-native-video", () =>
  require("testing/screenKit/nativeMocks").video()
)
jest.mock("react-native-webview", () =>
  require("testing/screenKit/nativeMocks").webview()
)
jest.mock("react-native-drop-shadow", () =>
  require("testing/screenKit/nativeMocks").dropShadow()
)
jest.mock("@react-native-community/slider", () =>
  require("testing/screenKit/nativeMocks").slider()
)
jest.mock("react-native-gesture-image-viewer", () =>
  require("testing/screenKit/nativeMocks").gestureImageViewer()
)
jest.mock("react-native-mmkv", () =>
  require("testing/screenKit/nativeMocks").mmkv()
)
jest.mock("@notifee/react-native", () =>
  require("testing/screenKit/nativeMocks").notifee()
)
jest.mock("@react-native-firebase/messaging", () =>
  require("testing/screenKit/nativeMocks").firebaseMessaging()
)
jest.mock("@react-native-firebase/app", () =>
  require("testing/screenKit/nativeMocks").firebaseApp()
)
jest.mock("@react-native-community/geolocation", () =>
  require("testing/screenKit/nativeMocks").geolocation()
)
jest.mock("@react-native-camera-roll/camera-roll", () =>
  require("testing/screenKit/nativeMocks").cameraRoll()
)
jest.mock("@react-native-documents/picker", () =>
  require("testing/screenKit/nativeMocks").documentPicker()
)
jest.mock("react-native-image-crop-picker", () =>
  require("testing/screenKit/nativeMocks").imageCropPicker()
)
jest.mock("react-native-compressor", () =>
  require("testing/screenKit/nativeMocks").compressor()
)
jest.mock("react-native-create-thumbnail", () =>
  require("testing/screenKit/nativeMocks").createThumbnail()
)
jest.mock("react-native-orientation-locker", () =>
  require("testing/screenKit/nativeMocks").orientationLocker()
)
jest.mock("react-native-restart", () =>
  require("testing/screenKit/nativeMocks").restart()
)
jest.mock("socket.io-client", () =>
  require("testing/screenKit/nativeMocks").socketIo()
)
