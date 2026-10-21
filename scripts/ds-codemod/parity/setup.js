/* eslint-disable global-require -- jest.mock factories must require lazily */
/**
 * Mocks the parity renders need beyond jest.setup.js. They apply to the
 * original and the converted file alike, so they can be crude; what they must
 * not do is swallow a style: every stand-in here renders a real React Native
 * host and passes `style` (and every other prop) through.
 */

// Reanimated, richer than jest.setup.js's: Animated.View and friends are
// the plain React Native components, and an animated style is the object
// its worklet returns now.
jest.mock("react-native-reanimated", () => {
  const RN = require("react-native")
  const identity = (x) => x
  const easing = new Proxy(
    {},
    {
      get:
        () =>
        (...args) =>
          typeof args[0] === "function" ? args[0] : identity,
    }
  )
  // Reanimated 4's shared values read and write through get()/set() too.
  const mutable = (value) => ({
    value,
    get() {
      return this.value
    },
    set(next) {
      this.value = typeof next === "function" ? next(this.value) : next
    },
  })
  // A layout animation's builder: each step (FadeIn.duration(300).delay(100))
  // gives the builder back. Its methods are all a tree shows of it, which
  // drops them.
  const builder = () => {
    const b = {}
    for (const step of [
      "duration",
      "delay",
      "springify",
      "damping",
      "dampingRatio",
      "mass",
      "stiffness",
      "overshootClamping",
      "easing",
      "randomDelay",
      "reduceMotion",
      "withInitialValues",
      "withCallback",
    ])
      b[step] = () => b
    return b
  }
  const Animated = {
    View: RN.View,
    Text: RN.Text,
    ScrollView: RN.ScrollView,
    Image: RN.Image,
    FlatList: RN.FlatList,
    createAnimatedComponent: (c) => c,
  }
  return {
    __esModule: true,
    default: Animated,
    ...Animated,
    useSharedValue: (value) => mutable(value),
    makeMutable: (value) => mutable(value),
    useAnimatedStyle: (fn) => fn(),
    useAnimatedProps: (fn) => fn(),
    useDerivedValue: (fn) => ({ value: fn() }),
    useAnimatedRef: () => ({ current: null }),
    useAnimatedReaction: () => undefined,
    useAnimatedScrollHandler: () => () => undefined,
    withTiming: (v) => v,
    withSpring: (v) => v,
    withDelay: (_d, v) => v,
    withRepeat: (v) => v,
    withSequence: (...v) => v[v.length - 1],
    cancelAnimation: () => undefined,
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    measure: () => null,
    interpolate: (_v, _input, output) => output[0],
    interpolateColor: (_v, _input, output) => output[0],
    Extrapolation: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
    Extrapolate: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
    Easing: easing,
    ReduceMotion: { System: "system", Always: "always", Never: "never" },
    FadeIn: builder(),
    FadeOut: builder(),
    FadeInUp: builder(),
    FadeInDown: builder(),
    ZoomIn: builder(),
    LinearTransition: builder(),
    Layout: builder(),
    Keyframe: function Keyframe() {
      return builder()
    },
  }
})

// Gesture handler's components as React Native's own.
jest.mock("react-native-gesture-handler", () => {
  const RN = require("react-native")
  const React = require("react")
  return {
    TextInput: RN.TextInput,
    ScrollView: RN.ScrollView,
    FlatList: RN.FlatList,
    TouchableOpacity: RN.TouchableOpacity,
    TouchableWithoutFeedback: RN.TouchableWithoutFeedback,
    Pressable: RN.Pressable,
    GestureHandlerRootView: RN.View,
    GestureDetector: ({ children }) =>
      React.createElement(React.Fragment, null, children),
    // customerapp's MessagesComponent row: its children, as drawn at rest
    Swipeable: ({ children }) => React.createElement(RN.View, null, children),
    Gesture: new Proxy(
      {},
      { get: () => () => new Proxy({}, { get: (_t, _k, r) => () => r }) }
    ),
    State: {},
    Directions: {},
  }
})

jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native")
  const navigation = {
    navigate: () => undefined,
    goBack: () => undefined,
    setOptions: () => undefined,
    dispatch: () => undefined,
    addListener: () => () => undefined,
    canGoBack: () => true,
    getParent: () => undefined,
  }
  return {
    ...actual,
    useNavigation: () => navigation,
    useRoute: () => ({ key: "parity", name: "Parity", params: {} }),
    useFocusEffect: () => undefined,
    useIsFocused: () => true,
  }
})

// MMKV's native half doesn't exist in node; a store that keeps nothing.
jest.mock("react-native-mmkv", () => {
  const storage = () => ({
    getString: () => undefined,
    getNumber: () => undefined,
    getBoolean: () => undefined,
    contains: () => false,
    set: () => undefined,
    delete: () => undefined,
    remove: () => undefined,
    getAllKeys: () => [],
    clearAll: () => undefined,
    addOnValueChangedListener: () => ({ remove: () => undefined }),
  })
  return {
    createMMKV: storage,
    MMKV: function MMKV() {
      return storage()
    },
  }
})

jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)

// The web view comes with tappler-shared's components barrel, which
// customerapp imports MainModal from (DocumentViewerModal); its native half
// is missing in node. A host that keeps its props.
jest.mock("react-native-webview", () => {
  const React = require("react")
  const WebView = (props) => React.createElement("WebView", props)
  return { __esModule: true, WebView, default: WebView }
})

// The app's Latin faces, as index.js registers them before anything
// renders. customerapp's registers none, so shared's Montserrat stands
// (setLatinFontWeights(null) would break every Latin lookup).
const { readLatinRegistry } = require("../../nw-resolve")
const { weights } = readLatinRegistry()
if (weights)
  require("@tappler/shared/src/helpers/helpers").setLatinFontWeights(weights)
