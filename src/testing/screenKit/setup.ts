/* eslint-disable global-require, @typescript-eslint/no-var-requires -- a
   jest.mock factory MUST require lazily:
   it is hoisted above every import and runs when the module is first asked
   for (in whichever module registry asks). */
/**
 * Jest only: jest.parity.config.js's setup, after the app's jest.setup.js
 * (whose true-sheet and keyboard-controller mocks stay; its Reanimated mock
 * is replaced by the fuller one here). Every native module and native view a
 * screen can reach is swapped for a stand-in (nativeMocks.ts); the network
 * is shut (backend.ts answers RTK Query; anything else that tries is
 * refused, loudly); the store is the kit's (store.ts). No component of ours
 * is mocked.
 */
import { jest } from "@jest/globals"

import { shutTheNetwork } from "./backend"

shutTheNetwork()

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
// Libraries' own jest mocks, where they ship one.

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)
jest.mock("react-native-permissions", () =>
  jest.requireActual("react-native-permissions/mock")
)
jest.mock("react-native-device-info", () =>
  jest.requireActual(
    "react-native-device-info/jest/react-native-device-info-mock"
  )
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
jest.mock("react-native-reanimated", () =>
  require("testing/screenKit/nativeMocks").reanimated()
)
jest.mock("react-native-worklets", () =>
  require("testing/screenKit/nativeMocks").worklets()
)
jest.mock("@shopify/flash-list", () =>
  require("testing/screenKit/nativeMocks").flashList()
)
jest.mock("react-native-reanimated-carousel", () =>
  require("testing/screenKit/nativeMocks").carousel()
)
jest.mock("react-native-sortables", () =>
  require("testing/screenKit/nativeMocks").sortables()
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
jest.mock("react-native-date-picker", () =>
  require("testing/screenKit/nativeMocks").datePicker()
)
jest.mock("react-native-color-matrix-image-filters", () =>
  require("testing/screenKit/nativeMocks").colorMatrixFilters()
)
jest.mock("react-native-svg-uri", () =>
  require("testing/screenKit/nativeMocks").svgUri()
)
jest.mock("react-native-image-crop-tools", () =>
  require("testing/screenKit/nativeMocks").cropTools()
)
jest.mock("react-native-gesture-image-viewer", () =>
  require("testing/screenKit/nativeMocks").gestureImageViewer()
)
jest.mock("react-native-vision-camera", () =>
  require("testing/screenKit/nativeMocks").visionCamera()
)
jest.mock("vision-camera-cropper", () =>
  require("testing/screenKit/nativeMocks").visionCameraCropper()
)
jest.mock("paymob-reactnative", () =>
  require("testing/screenKit/nativeMocks").paymob()
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
jest.mock("@react-native-firebase/auth", () =>
  require("testing/screenKit/nativeMocks").firebaseAuth()
)
jest.mock("@react-native-firebase/app", () =>
  require("testing/screenKit/nativeMocks").firebaseApp()
)
jest.mock("@react-native-google-signin/google-signin", () =>
  require("testing/screenKit/nativeMocks").googleSignin()
)
jest.mock("@react-native-community/geolocation", () =>
  require("testing/screenKit/nativeMocks").geolocation()
)
jest.mock("@react-native-community/netinfo", () =>
  require("testing/screenKit/nativeMocks").netinfo()
)
jest.mock("@react-native-clipboard/clipboard", () =>
  require("testing/screenKit/nativeMocks").clipboard()
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
jest.mock("react-native-blob-util", () =>
  require("testing/screenKit/nativeMocks").blobUtil()
)
jest.mock("react-native-compressor", () =>
  require("testing/screenKit/nativeMocks").compressor()
)
jest.mock("react-native-create-thumbnail", () =>
  require("testing/screenKit/nativeMocks").createThumbnail()
)
jest.mock("react-native-pdf-thumbnail", () =>
  require("testing/screenKit/nativeMocks").pdfThumbnail()
)
jest.mock("react-native-haptic-feedback", () =>
  require("testing/screenKit/nativeMocks").hapticFeedback()
)
jest.mock("react-native-orientation-locker", () =>
  require("testing/screenKit/nativeMocks").orientationLocker()
)
jest.mock("react-native-restart", () =>
  require("testing/screenKit/nativeMocks").restart()
)
jest.mock("react-native-bootsplash", () =>
  require("testing/screenKit/nativeMocks").bootsplash()
)
jest.mock("react-native-geocoding", () =>
  require("testing/screenKit/nativeMocks").geocoding()
)
jest.mock("socket.io-client", () =>
  require("testing/screenKit/nativeMocks").socketIo()
)
